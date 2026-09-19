/**
 * Central Image Infrastructure Types for Zarfolio
 */

export type ImagePurpose =
  | 'avatar'
  | 'customer'
  | 'product'
  | 'jewelry'
  | 'stone'
  | 'diamond'
  | 'document'
  | 'invoice'
  | 'gallery';

export type SupportedImageFormat = 'webp' | 'jpeg' | 'png';

export type ImageFitMode = 'cover' | 'contain' | 'inside' | 'outside' | 'fill';

export type ImageCropPosition =
  | 'center'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'entropy'
  | 'attention';

export interface ImagePurposeConfig {
  /** Maximum allowed file size in bytes */
  maxSizeBytes: number;
  /** Target width after resize */
  targetWidth: number;
  /** Target height after resize */
  targetHeight: number;
  /** Output format */
  format: SupportedImageFormat;
  /** Compression quality (e.g. 82-85 for WebP) */
  quality: number;
  /** Crop / fit behavior */
  fit: ImageFitMode;
  /** Position or strategy for crop */
  position: ImageCropPosition;
  /** Whether to strip EXIF, GPS and other camera metadata */
  stripMetadata: boolean;
  /** Supported input MIME types */
  allowedMimeTypes: string[];
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
  detectedFormat?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface ProcessedImageResult {
  /** Processed image binary buffer */
  buffer: Buffer;
  /** Output format */
  format: SupportedImageFormat;
  /** Output MIME type */
  mimeType: string;
  /** Output width in pixels */
  width: number;
  /** Output height in pixels */
  height: number;
  /** Output size in bytes */
  size: number;
  /** Original input size in bytes */
  originalSize: number;
  /** Generated collision-resistant, path-safe filename */
  filename: string;
}

export interface ProcessImageOptions {
  /** Raw buffer or binary input */
  input: Buffer | Uint8Array | ArrayBuffer;
  /** The business purpose of the image (avatar, customer, etc.) */
  purpose: ImagePurpose;
  /** Optional associated entity ID (e.g. userId) for filename generation */
  entityId?: string;
  /** Optional client-declared MIME type */
  declaredMimeType?: string;
  /** Optional overrides for configuration */
  overrides?: Partial<ImagePurposeConfig>;
}

export interface ImageStorageProvider {
  /** Generate a safe, versioned filename */
  generateSafeFileName(purpose: ImagePurpose, entityId?: string, extension?: string): string;
  /** Format a versioned cache-busting URL */
  buildVersionedUrl(baseUrl: string, version?: string | number): string;
}
