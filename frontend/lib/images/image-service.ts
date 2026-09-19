import type PocketBase from 'pocketbase';
import { getImageConfig } from './config';
import {
  detectMagicBytes,
  processImage,
  validateImage,
} from './image-processor';
import {
  buildVersionedUrl,
  createWebpFileFromBuffer,
  defaultStorageProvider,
  generateSafeFileName,
} from './image-storage';
import {
  ImagePurpose,
  ImagePurposeConfig,
  ImageValidationResult,
  ProcessImageOptions,
  ProcessedImageResult,
} from './types';

export interface ProcessUploadResult {
  /** The processed WebP binary data and metadata */
  processed: ProcessedImageResult;
  /** Ready-to-append File object for FormData */
  file: File;
  /** Generated safe filename */
  filename: string;
}

/**
 * Central Image Service for Zarfolio.
 * Orchestrates image validation, processing, WebP conversion,
 * secure filename generation, and URL construction with cache busting.
 */
export class ImageService {
  private storage = defaultStorageProvider;

  /**
   * Get configuration rules for a given image purpose.
   */
  getConfig(
    purpose: ImagePurpose,
    overrides?: Partial<ImagePurposeConfig>,
  ): ImagePurposeConfig {
    return getImageConfig(purpose, overrides);
  }

  /**
   * Validates an image buffer or file before processing.
   */
  async validate(
    input: Buffer | Uint8Array | ArrayBuffer | File | Blob,
    options: {
      purpose: ImagePurpose;
      declaredMimeType?: string;
      overrides?: Partial<ImagePurposeConfig>;
    },
  ): Promise<ImageValidationResult> {
    const buffer = await this.toBuffer(input);
    return validateImage(buffer, {
      purpose: options.purpose,
      declaredMimeType: options.declaredMimeType,
      overrides: options.overrides,
    });
  }

  /**
   * Processes a raw image buffer or File into an optimized WebP image.
   */
  async process(options: ProcessImageOptions): Promise<ProcessedImageResult> {
    const buffer = await this.toBuffer(options.input);
    return processImage({
      ...options,
      input: buffer,
    });
  }

  /**
   * High-level entry point for uploading an image:
   * 1. Validates magic bytes, size, and decodability.
   * 2. Auto-rotates according to EXIF orientation.
   * 3. Resizes and smart-crops (256x256 square for avatar).
   * 4. Converts to WebP (quality 85) and strips EXIF/metadata.
   * 5. Packages into a safe, collision-resistant File ready for FormData.
   */
  async processUpload(options: {
    file: File | Blob | Buffer | Uint8Array | ArrayBuffer;
    purpose: ImagePurpose;
    entityId?: string;
    declaredMimeType?: string;
    overrides?: Partial<ImagePurposeConfig>;
  }): Promise<ProcessUploadResult> {
    const buffer = await this.toBuffer(options.file);
    const declaredMimeType =
      options.declaredMimeType ??
      (options.file instanceof File || options.file instanceof Blob
        ? options.file.type
        : undefined);

    const processed = await this.process({
      input: buffer,
      purpose: options.purpose,
      entityId: options.entityId,
      declaredMimeType,
      overrides: options.overrides,
    });

    const file = createWebpFileFromBuffer(
      processed.buffer,
      processed.filename,
      processed.mimeType,
    );

    return {
      processed,
      file,
      filename: processed.filename,
    };
  }

  /**
   * Constructs a cache-busting, versioned avatar URL for a user record.
   */
  buildAvatarUrl(
    userRecord: {
      id?: string;
      avatar?: string;
      updated?: string;
      collectionId?: string;
      collectionName?: string;
    },
    pbClient: PocketBase,
  ): string | undefined {
    if (!userRecord || !userRecord.avatar) {
      return undefined;
    }

    try {
      const rawUrl = pbClient.files.getURL(
        userRecord as unknown as Parameters<typeof pbClient.files.getURL>[0],
        userRecord.avatar,
      );
      return this.storage.buildVersionedUrl(rawUrl, userRecord.updated);
    } catch {
      return undefined;
    }
  }

  /**
   * Convert various binary inputs to a Node.js Buffer.
   */
  private async toBuffer(
    input: Buffer | Uint8Array | ArrayBuffer | File | Blob,
  ): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
      return input;
    }
    if (input instanceof Uint8Array) {
      return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    }
    if (input instanceof ArrayBuffer) {
      return Buffer.from(input);
    }
    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      const arrayBuffer = await input.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    throw new Error('فرمت ورودی داده تصویر پشتیبانی نمی‌شود.');
  }
}

export const imageService = new ImageService();
