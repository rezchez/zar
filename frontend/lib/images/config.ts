import { ImagePurpose, ImagePurposeConfig } from './types';

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const IMAGE_PURPOSE_CONFIGS: Record<ImagePurpose, ImagePurposeConfig> = {
  avatar: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    targetWidth: 256,
    targetHeight: 256,
    format: 'webp',
    quality: 85,
    fit: 'cover',
    position: 'entropy', // Smart entropy-based crop with center fallback
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
  customer: {
    maxSizeBytes: 5 * 1024 * 1024,
    targetWidth: 256,
    targetHeight: 256,
    format: 'webp',
    quality: 85,
    fit: 'cover',
    position: 'entropy',
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
  product: {
    maxSizeBytes: 10 * 1024 * 1024,
    targetWidth: 800,
    targetHeight: 800,
    format: 'webp',
    quality: 85,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
  jewelry: {
    maxSizeBytes: 10 * 1024 * 1024,
    targetWidth: 1024,
    targetHeight: 1024,
    format: 'webp',
    quality: 88,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
  stone: {
    maxSizeBytes: 10 * 1024 * 1024,
    targetWidth: 1024,
    targetHeight: 1024,
    format: 'webp',
    quality: 88,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
  diamond: {
    maxSizeBytes: 10 * 1024 * 1024,
    targetWidth: 1024,
    targetHeight: 1024,
    format: 'webp',
    quality: 88,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
  document: {
    maxSizeBytes: 15 * 1024 * 1024,
    targetWidth: 1600,
    targetHeight: 2200,
    format: 'webp',
    quality: 85,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: [...DEFAULT_ALLOWED_MIME_TYPES, 'application/pdf'],
  },
  invoice: {
    maxSizeBytes: 15 * 1024 * 1024,
    targetWidth: 1600,
    targetHeight: 2200,
    format: 'webp',
    quality: 85,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: [...DEFAULT_ALLOWED_MIME_TYPES, 'application/pdf'],
  },
  gallery: {
    maxSizeBytes: 12 * 1024 * 1024,
    targetWidth: 1280,
    targetHeight: 1280,
    format: 'webp',
    quality: 85,
    fit: 'inside',
    position: 'center',
    stripMetadata: true,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  },
};

export function getImageConfig(
  purpose: ImagePurpose,
  overrides?: Partial<ImagePurposeConfig>,
): ImagePurposeConfig {
  const baseConfig = IMAGE_PURPOSE_CONFIGS[purpose] ?? IMAGE_PURPOSE_CONFIGS.avatar;
  if (!overrides) return baseConfig;
  return {
    ...baseConfig,
    ...overrides,
  };
}
