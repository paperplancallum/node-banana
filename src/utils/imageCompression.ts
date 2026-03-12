/**
 * Image compression utility to ensure images fit within API payload limits.
 * Vercel serverless functions have a 4.5MB body size limit.
 */

const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024; // 4MB to leave room for other request data
const MAX_DIMENSION = 2048; // Max width/height

/**
 * Compress a base64 image to fit within payload limits.
 * Returns the original if already small enough, otherwise compresses.
 */
export async function compressImageForUpload(base64DataUrl: string): Promise<string> {
  // Not a data URL, return as-is
  if (!base64DataUrl.startsWith("data:")) return base64DataUrl;

  // Check if already small enough
  const estimatedSize = Math.ceil((base64DataUrl.length - base64DataUrl.indexOf(",") - 1) * 3 / 4);
  if (estimatedSize < MAX_PAYLOAD_SIZE) return base64DataUrl;

  // Need to compress - use canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Calculate new dimensions
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

        // Try progressively lower quality until under limit
        let quality = 0.9;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > MAX_PAYLOAD_SIZE * 1.33 && quality > 0.1) { // 1.33 accounts for base64 overhead
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        console.log(`[ImageCompression] Compressed from ${(estimatedSize / 1024 / 1024).toFixed(2)}MB to ${(result.length / 1024 / 1024).toFixed(2)}MB (quality: ${quality.toFixed(1)})`);
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
