import crypto from 'crypto';
import { ImagePurpose, ImageStorageProvider } from './types';

/**
 * Generate collision-resistant, path-traversal-safe filenames.
 * Never trust or use client-supplied file names directly.
 */
export function generateSafeFileName(
  purpose: ImagePurpose,
  entityId?: string,
  extension = 'webp',
): string {
  // Sanitize purpose and entityId to strict alphanumeric and underscore characters
  const cleanPurpose = purpose.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanEntityId = entityId
    ? entityId.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32)
    : '';

  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const cleanExtension = extension.replace(/[^a-z0-9]/g, '') || 'webp';

  if (cleanEntityId) {
    return `${cleanPurpose}_${cleanEntityId}_${timestamp}_${randomSuffix}.${cleanExtension}`;
  }

  return `${cleanPurpose}_${timestamp}_${randomSuffix}.${cleanExtension}`;
}

/**
 * Appends a cache-busting version parameter to the URL to prevent stale browser caching.
 */
export function buildVersionedUrl(
  baseUrl: string,
  version?: string | number,
): string {
  if (!baseUrl) return '';
  if (!version) return baseUrl;

  // Convert Date strings to numeric timestamps if possible
  const versionStr =
    typeof version === 'number'
      ? String(version)
      : !Number.isNaN(Date.parse(version))
        ? String(new Date(version).getTime())
        : encodeURIComponent(String(version));

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}v=${versionStr}`;
}

/**
 * Converts a processed image Buffer into a web-standard File instance
 * that can be attached to FormData for PocketBase uploads.
 */
export function createWebpFileFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType = 'image/webp',
): File {
  // Use Uint8Array view of Buffer for cross-runtime File constructor
  const uint8 = new Uint8Array(buffer);
  return new File([uint8], filename, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

/**
 * Default PocketBase image storage provider implementation.
 */
export class PocketBaseImageStorageProvider implements ImageStorageProvider {
  generateSafeFileName(
    purpose: ImagePurpose,
    entityId?: string,
    extension = 'webp',
  ): string {
    return generateSafeFileName(purpose, entityId, extension);
  }

  buildVersionedUrl(baseUrl: string, version?: string | number): string {
    return buildVersionedUrl(baseUrl, version);
  }
}

export const defaultStorageProvider = new PocketBaseImageStorageProvider();
