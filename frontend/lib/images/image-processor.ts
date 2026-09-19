import sharp from 'sharp';
import { getImageConfig } from './config';
import { generateSafeFileName } from './image-storage';
import {
  ImageCropPosition,
  ImageValidationResult,
  ProcessImageOptions,
  ProcessedImageResult,
} from './types';

/**
 * Validates file magic bytes to verify actual image content (prevent file spoofing).
 */
export function detectMagicBytes(buffer: Buffer): {
  valid: boolean;
  detectedMime?: string;
  detectedFormat?: 'jpeg' | 'png' | 'webp';
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg', detectedFormat: 'jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png', detectedFormat: 'png' };
  }

  // WebP: RIFF ... WEBP (Bytes 0-3: 'RIFF', Bytes 8-11: 'WEBP')
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: 'image/webp', detectedFormat: 'webp' };
  }

  return { valid: false };
}

/**
 * Safely converts input binary data to a Buffer.
 */
function toBufferSafe(input: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  return Buffer.from(new Uint8Array(input));
}

/**
 * Map high-level crop position string to Sharp position / strategy
 */
function resolveSharpPosition(position: ImageCropPosition): number | string {
  switch (position) {
    case 'entropy':
      return sharp.strategy.entropy;
    case 'attention':
      return sharp.strategy.attention;
    case 'top':
      return 'top';
    case 'right':
      return 'right';
    case 'bottom':
      return 'bottom';
    case 'left':
      return 'left';
    case 'center':
    default:
      return 'center';
  }
}

/**
 * Validates an image buffer against business purpose constraints,
 * magic bytes, file size limits, and stream decodability.
 */
export async function validateImage(
  input: Buffer | Uint8Array | ArrayBuffer,
  options: {
    purpose: ProcessImageOptions['purpose'];
    declaredMimeType?: string;
    overrides?: ProcessImageOptions['overrides'];
  },
): Promise<ImageValidationResult> {
  const buffer = toBufferSafe(input);
  const config = getImageConfig(options.purpose, options.overrides);

  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: 'فایل ارسالی خالی است.',
    };
  }

  // 1. File size validation
  if (buffer.length > config.maxSizeBytes) {
    const maxMb = Math.round(config.maxSizeBytes / (1024 * 1024));
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const maxMbFa = String(maxMb).replace(/[0-9]/g, (d) => farsiDigits[+d]);
    return {
      valid: false,
      sizeBytes: buffer.length,
      error: `حجم فایل نباید بیشتر از ${maxMbFa} مگابایت باشد.`,
    };
  }

  // 2. Magic byte / Signature validation
  const magic = detectMagicBytes(buffer);
  if (!magic.valid || !magic.detectedMime) {
    return {
      valid: false,
      sizeBytes: buffer.length,
      error: 'فایل انتخابی یک تصویر معتبر (JPG, PNG, WebP) نیست.',
    };
  }

  if (!config.allowedMimeTypes.includes(magic.detectedMime)) {
    return {
      valid: false,
      detectedMimeType: magic.detectedMime,
      error: 'فرمت تصویر ارسال شده برای این بخش مجاز نیست.',
    };
  }

  // 3. Prevent MIME type spoofing (e.g. declared as PNG but magic bytes are JPEG or vice versa)
  if (
    options.declaredMimeType &&
    options.declaredMimeType !== magic.detectedMime &&
    // Some browsers send image/x-png or image/pjpeg
    !(
      options.declaredMimeType === 'image/x-png' &&
      magic.detectedMime === 'image/png'
    ) &&
    !(
      options.declaredMimeType === 'image/pjpeg' &&
      magic.detectedMime === 'image/jpeg'
    )
  ) {
    return {
      valid: false,
      detectedMimeType: magic.detectedMime,
      error: 'نوع فایل اعلام شده با محتوای واقعی تصویر مطابقت ندارد.',
    };
  }

  // 4. Bitstream verification using Sharp (ensures the file is genuinely decodeable by libvips)
  try {
    const metadata = await sharp(buffer, { failOn: 'truncated' }).metadata();
    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'ابعاد تصویر نامعتبر است.',
      };
    }

    return {
      valid: true,
      detectedMimeType: magic.detectedMime,
      detectedFormat: magic.detectedFormat,
      width: metadata.width,
      height: metadata.height,
      sizeBytes: buffer.length,
    };
  } catch {
    return {
      valid: false,
      error: 'تصویر ارسالی مخدوش یا غیرقابل پردازش است.',
    };
  }
}

/**
 * Central image processor: validates, auto-rotates, smart-crops/resizes,
 * converts to WebP, strips metadata/EXIF for privacy, and generates safe filename.
 */
export async function processImage(
  options: ProcessImageOptions,
): Promise<ProcessedImageResult> {
  const buffer = toBufferSafe(options.input);

  const config = getImageConfig(options.purpose, options.overrides);

  // Validate before proceeding
  const validation = await validateImage(buffer, {
    purpose: options.purpose,
    declaredMimeType: options.declaredMimeType,
    overrides: options.overrides,
  });

  if (!validation.valid) {
    throw new Error(validation.error ?? 'اعتبارسنجی تصویر با خطا مواجه شد.');
  }

  const sharpPosition = resolveSharpPosition(config.position);

  // Auto-rotate by EXIF orientation BEFORE stripping EXIF tags
  let transformer = sharp(buffer, { failOn: 'none' }).rotate();

  // Resize and Smart Crop
  transformer = transformer.resize({
    width: config.targetWidth,
    height: config.targetHeight,
    fit: config.fit,
    position: sharpPosition,
  });

  // Convert to WebP with target quality (82-85)
  // Sharp by default strips all EXIF, GPS, and metadata unless .withMetadata() is invoked.
  transformer = transformer.webp({
    quality: config.quality,
    effort: 4, // Good balance between CPU compression time and output size
  });

  const outputBuffer = await transformer.toBuffer();
  const outputMetadata = await sharp(outputBuffer).metadata();

  const filename = generateSafeFileName(
    options.purpose,
    options.entityId,
    config.format,
  );

  return {
    buffer: outputBuffer,
    format: config.format,
    mimeType: 'image/webp',
    width: outputMetadata.width ?? config.targetWidth,
    height: outputMetadata.height ?? config.targetHeight,
    size: outputBuffer.length,
    originalSize: buffer.length,
    filename,
  };
}
