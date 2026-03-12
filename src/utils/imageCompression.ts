/**
 * Image compression utility to ensure images fit within API payload limits.
 * Vercel serverless functions have a 4.5MB body size limit for the ENTIRE request.
 * With multiple images, we need aggressive compression.
 */

const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5MB per image to allow room for multiple images
const MAX_DIMENSION = 1280; // Max width/height - video models don't need huge resolution

/**
 * Compress a base64 image to fit within payload limits.
 * ALWAYS compresses to ensure consistent small sizes.
 */
export async function compressImageForUpload(base64DataUrl: string): Promise<string> {
  // Not a data URL, return as-is
  if (!base64DataUrl.startsWith("data:")) return base64DataUrl;

  const estimatedSize = Math.ceil((base64DataUrl.length - base64DataUrl.indexOf(",") - 1) * 3 / 4);

  // Always compress images for video generation to ensure payload fits
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Calculate new dimensions - always scale down large images
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // Draw to canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Start with moderate quality and reduce until under limit
        let quality = 0.8;
        let result = canvas.toDataURL("image/jpeg", quality);
        const targetSize = MAX_IMAGE_SIZE * 1.33; // Account for base64 overhead

        while (result.length > targetSize && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        // If still too large, reduce dimensions further
        if (result.length > targetSize) {
          const scale = 0.7;
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL("image/jpeg", 0.7);
        }

        const finalSize = Math.ceil((result.length - result.indexOf(",") - 1) * 3 / 4);
        console.log(`[ImageCompression] Compressed from ${(estimatedSize / 1024 / 1024).toFixed(2)}MB to ${(finalSize / 1024 / 1024).toFixed(2)}MB (${width}x${height}, quality: ${quality.toFixed(1)})`);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = base64DataUrl;
  });
}

/**
 * Compress multiple images
 */
export async function compressImagesForUpload(images: string[]): Promise<string[]> {
  return Promise.all(images.map(compressImageForUpload));
}
