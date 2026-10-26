/**
 * Image processing utilities for UrbanScrap photo uploads and reviews.
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTO_COUNT = 3;
export const MAX_IMAGE_EDGE = 1280;

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
}

/**
 * Validates a file for type and size restrictions.
 * Returns an error string if invalid, or null if valid.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Invalid format for "${file.name}". Please upload JPG, PNG, or WebP images.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `"${file.name}" exceeds the 5MB size limit. Please choose a smaller photo.`;
  }
  return null;
}

/**
 * Compresses and scales an image file using an offscreen canvas.
 * Produces a high-quality JPEG blob and data URL.
 */
export function compressImageFile(
  file: File,
  maxEdge: number = MAX_IMAGE_EDGE,
  quality: number = 0.8
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Browser canvas is unavailable.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Failed to create compressed image blob.'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image "${file.name}".`));
    };

    img.src = objectUrl;
  });
}
