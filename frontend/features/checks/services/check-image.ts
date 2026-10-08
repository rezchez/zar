/**
 * Client-side Image to WebP Converter for Checks
 * Converts any image format (JPEG, PNG, BMP, GIF, SVG, etc.) to optimized WebP.
 */

export interface WebPConversionResult {
  file: File;
  originalSize: number;
  webpSize: number;
  previewUrl: string;
  isConverted: boolean;
}

/**
 * Converts a given File (any image format) to WebP format using HTML5 Canvas.
 * @param file The original image file
 * @param quality Compression quality (0 to 1, default 0.85)
 * @param maxWidth Optional maximum width to constrain large photos (default 1920)
 * @param maxHeight Optional maximum height to constrain large photos (default 1440)
 */
export async function convertImageToWebP(
  file: File,
  quality = 0.85,
  maxWidth = 1920,
  maxHeight = 1440,
): Promise<WebPConversionResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    // If not in a browser environment, return file
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve({
        file,
        originalSize,
        webpSize: originalSize,
        previewUrl: '',
        isConverted: false,
      });
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('خطا در خواندن فایل تصویر.'));
    };

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('فرمت تصویر قابل پردازش نیست.'));
      };

      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if dimensions exceed bounds while maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback if canvas context fails
            const url = URL.createObjectURL(file);
            return resolve({
              file,
              originalSize,
              webpSize: originalSize,
              previewUrl: url,
              isConverted: false,
            });
          }

          // Draw image to canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Test WebP support in toDataURL or toBlob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                const url = URL.createObjectURL(file);
                return resolve({
                  file,
                  originalSize,
                  webpSize: originalSize,
                  previewUrl: url,
                  isConverted: false,
                });
              }

              const baseName = file.name.replace(/\.[^/.]+$/, '');
              const safeName = `${baseName.slice(0, 40)}.webp`;

              const webpFile = new File([blob], safeName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });

              const previewUrl = URL.createObjectURL(blob);

              resolve({
                file: webpFile,
                originalSize,
                webpSize: blob.size,
                previewUrl,
                isConverted: true,
              });
            },
            'image/webp',
            quality,
          );
        } catch {
          const url = URL.createObjectURL(file);
          resolve({
            file,
            originalSize,
            webpSize: originalSize,
            previewUrl: url,
            isConverted: false,
          });
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
