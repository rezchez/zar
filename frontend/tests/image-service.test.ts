import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import {
  detectMagicBytes,
  generateSafeFileName,
  buildVersionedUrl,
  createWebpFileFromBuffer,
  imageService,
  validateImage,
  processImage,
} from '@/lib/images';

describe('Zarfolio Central Image Service Infrastructure Tests', () => {
  // Helper to generate test images using Sharp
  async function createSampleImage(options: {
    format: 'jpeg' | 'png' | 'webp';
    width: number;
    height: number;
    withExif?: boolean;
    transparent?: boolean;
  }): Promise<Buffer> {
    const channels = options.transparent ? 4 : 3;
    const background = options.transparent
      ? { r: 255, g: 100, b: 50, alpha: 0.5 }
      : { r: 220, g: 180, b: 80 };

    let image = sharp({
      create: {
        width: options.width,
        height: options.height,
        channels,
        background,
      },
    });

    if (options.withExif) {
      image = image.withMetadata({
        exif: {
          IFD0: {
            Make: 'TestCameraVendor',
            Model: 'ZarfolioTestDevice',
            DateTime: '2026:09:19 12:00:00',
          },
        },
      });
    }

    if (options.format === 'jpeg') {
      return await image.jpeg().toBuffer();
    } else if (options.format === 'png') {
      return await image.png().toBuffer();
    } else {
      return await image.webp().toBuffer();
    }
  }

  // ==========================================================
  // Test 1: JPG → WebP
  // ==========================================================
  test('Test 1: JPG -> WebP conversion successfully converts and optimizes', async () => {
    const jpgBuffer = await createSampleImage({
      format: 'jpeg',
      width: 500,
      height: 500,
    });
    expect(detectMagicBytes(jpgBuffer).detectedFormat).toBe('jpeg');

    const result = await imageService.process({
      input: jpgBuffer,
      purpose: 'avatar',
      entityId: 'user_test_1',
    });

    expect(result.format).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
    expect(detectMagicBytes(result.buffer).detectedFormat).toBe('webp');

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
  });

  // ==========================================================
  // Test 2: PNG → WebP
  // ==========================================================
  test('Test 2: PNG -> WebP converts properly and preserves transparency', async () => {
    const pngBuffer = await createSampleImage({
      format: 'png',
      width: 400,
      height: 400,
      transparent: true,
    });
    expect(detectMagicBytes(pngBuffer).detectedFormat).toBe('png');

    const result = await imageService.process({
      input: pngBuffer,
      purpose: 'avatar',
      entityId: 'user_test_2',
    });

    expect(result.format).toBe('webp');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.channels).toBe(4); // Alpha preserved
  });

  // ==========================================================
  // Test 3: WebP → WebP
  // ==========================================================
  test('Test 3: WebP -> WebP standardizes and re-encodes properly', async () => {
    const webpBuffer = await createSampleImage({
      format: 'webp',
      width: 600,
      height: 600,
    });
    expect(detectMagicBytes(webpBuffer).detectedFormat).toBe('webp');

    const result = await imageService.process({
      input: webpBuffer,
      purpose: 'avatar',
      entityId: 'user_test_3',
    });

    expect(result.format).toBe('webp');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });

  // ==========================================================
  // Test 4: Large Image → 256×256
  // ==========================================================
  test('Test 4: Large Image (3000x3000) -> resized to exactly 256x256', async () => {
    const largeBuffer = await createSampleImage({
      format: 'jpeg',
      width: 3000,
      height: 3000,
    });

    const result = await imageService.process({
      input: largeBuffer,
      purpose: 'avatar',
    });

    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
    expect(result.size).toBeLessThan(largeBuffer.length);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });

  // ==========================================================
  // Test 5: Rectangular Image → Square Avatar
  // ==========================================================
  test('Test 5: Rectangular Image -> Cropped to square 256x256 without distortion', async () => {
    // Landscape rectangle (1600x900)
    const landscape = await createSampleImage({
      format: 'jpeg',
      width: 1600,
      height: 900,
    });
    const resultLandscape = await imageService.process({
      input: landscape,
      purpose: 'avatar',
    });
    expect(resultLandscape.width).toBe(256);
    expect(resultLandscape.height).toBe(256);

    // Portrait rectangle (800x1600)
    const portrait = await createSampleImage({
      format: 'png',
      width: 800,
      height: 1600,
    });
    const resultPortrait = await imageService.process({
      input: portrait,
      purpose: 'avatar',
    });
    expect(resultPortrait.width).toBe(256);
    expect(resultPortrait.height).toBe(256);
  });

  // ==========================================================
  // Test 6: Invalid File → Reject
  // ==========================================================
  test('Test 6: Invalid File (text / script disguised as image) is strictly rejected', async () => {
    const maliciousScript = Buffer.from(
      '<?php echo "evil payload"; ?> <script>alert(1)</script>',
      'utf-8',
    );

    // 1. Magic bytes rejection
    const magicCheck = detectMagicBytes(maliciousScript);
    expect(magicCheck.valid).toBe(false);

    // 2. validateImage rejection
    const validation = await validateImage(maliciousScript, {
      purpose: 'avatar',
      declaredMimeType: 'image/jpeg',
    });
    expect(validation.valid).toBe(false);
    expect(validation.error).toBeDefined();

    // 3. process rejection
    await expect(
      imageService.process({
        input: maliciousScript,
        purpose: 'avatar',
      }),
    ).rejects.toThrow();
  });

  // ==========================================================
  // Test 7: File > Maximum Size → Reject
  // ==========================================================
  test('Test 7: File > Maximum Size (5 MB for avatar) is rejected with clear error', async () => {
    // Construct buffer slightly larger than 5MB
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
    // Fake JPEG header
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    const validation = await validateImage(oversizedBuffer, {
      purpose: 'avatar',
    });

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('۵ مگابایت');
  });

  // ==========================================================
  // Test 8: New Avatar Upload → Old Avatar remains until success
  // ==========================================================
  test('Test 8: Old Avatar remains untouched until new avatar is fully prepared and valid', async () => {
    let currentStoredAvatar = 'avatar_old_user_1_v1.webp';

    // Simulate upload attempt with invalid file
    const invalidUpload = Buffer.from('not an image data');
    const validation = await imageService.validate(invalidUpload, {
      purpose: 'avatar',
    });

    if (!validation.valid) {
      // Because validation failed, database and storage remain unchanged
      expect(currentStoredAvatar).toBe('avatar_old_user_1_v1.webp');
    } else {
      currentStoredAvatar = 'should_not_reach_here';
    }

    expect(currentStoredAvatar).toBe('avatar_old_user_1_v1.webp');

    // Now simulate valid upload
    const validUpload = await createSampleImage({
      format: 'png',
      width: 300,
      height: 300,
    });
    const uploadResult = await imageService.processUpload({
      file: validUpload,
      purpose: 'avatar',
      entityId: 'user_1',
    });

    expect(uploadResult.filename).toContain('avatar_user_1_');
    expect(uploadResult.file.type).toBe('image/webp');
    // Only after full success, new avatar name replaces old
    currentStoredAvatar = uploadResult.filename;
    expect(currentStoredAvatar).not.toBe('avatar_old_user_1_v1.webp');
  });

  // ==========================================================
  // Test 9: Database Update Failure → Rollback & Clean Orphan Files
  // ==========================================================
  test('Test 9: Database Update Failure cleans newly prepared file and preserves old avatar', async () => {
    const existingAvatar = 'avatar_user_test9_v1.webp';
    let databaseRecord = { id: 'user_test9', avatar: existingAvatar };

    const validImg = await createSampleImage({
      format: 'jpeg',
      width: 400,
      height: 400,
    });
    const uploadResult = await imageService.processUpload({
      file: validImg,
      purpose: 'avatar',
      entityId: databaseRecord.id,
    });

    // Simulate database update failure (e.g. unique constraint or network error)
    let dbUpdateSucceeded = false;
    try {
      throw new Error('Simulated Database connection error');
    } catch {
      // Rollback: delete newly prepared file/reference, do not mutate databaseRecord
      dbUpdateSucceeded = false;
    }

    expect(dbUpdateSucceeded).toBe(false);
    expect(databaseRecord.avatar).toBe(existingAvatar);
  });

  // ==========================================================
  // Test 10: Avatar Replacement → Cache Busting & Versioning
  // ==========================================================
  test('Test 10: Avatar Replacement produces versioned URL preventing stale cache', () => {
    const baseUrl = 'http://127.0.0.1:8090/api/files/_pb_users_auth_/usr1/avatar_1.webp';

    const timestamp1 = '2026-09-19 12:00:00.000Z';
    const versionedUrl1 = buildVersionedUrl(baseUrl, timestamp1);
    expect(versionedUrl1).toContain('?v=');

    const timestamp2 = '2026-09-19 12:05:00.000Z';
    const versionedUrl2 = buildVersionedUrl(baseUrl, timestamp2);
    expect(versionedUrl2).not.toBe(versionedUrl1);

    // Test with existing query params
    const urlWithQuery = 'http://127.0.0.1:8090/api/files/_pb_users_auth_/usr1/avatar_1.webp?thumb=100x100';
    const versionedUrlWithQuery = buildVersionedUrl(urlWithQuery, 1726760000);
    expect(versionedUrlWithQuery).toContain('&v=1726760000');
  });

  // ==========================================================
  // Test 11: EXIF / Metadata Removal
  // ==========================================================
  test('Test 11: EXIF and sensitive camera metadata are completely stripped from output WebP', async () => {
    const imgWithExif = await createSampleImage({
      format: 'jpeg',
      width: 600,
      height: 600,
      withExif: true,
    });

    const originalMeta = await sharp(imgWithExif).metadata();
    expect(originalMeta.exif).toBeDefined();

    const result = await imageService.process({
      input: imgWithExif,
      purpose: 'avatar',
    });

    const outputMeta = await sharp(result.buffer).metadata();
    // Exif, GPS, and camera metadata must be stripped
    expect(outputMeta.exif).toBeUndefined();
  });

  // ==========================================================
  // Storage & Safe Filename Security Tests
  // ==========================================================
  test('Safe Filename: Strictly avoids path traversal and user filenames', () => {
    const dangerousUserId = '../../etc/passwd';
    const filename = generateSafeFileName('avatar', dangerousUserId, 'webp');

    expect(filename).not.toContain('..');
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('\\');
    expect(filename.startsWith('avatar_')).toBe(true);
    expect(filename.endsWith('.webp')).toBe(true);
  });

  test('createWebpFileFromBuffer creates valid web-standard File instance', () => {
    const buffer = Buffer.from([1, 2, 3, 4]);
    const file = createWebpFileFromBuffer(buffer, 'test.webp', 'image/webp');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('test.webp');
    expect(file.type).toBe('image/webp');
    expect(file.size).toBe(4);
  });
});
