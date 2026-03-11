/**
 * Image Preprocessing Pipeline
 * 
 * Prepares images for OCR and card matching
 * Target: < 100ms processing time
 */

interface PreprocessingOptions {
  targetHeight?: number;
  contrastBoost?: number;
  sharpnessBoost?: number;
  edgeDetection?: boolean;
}

/**
 * Convert data URL to canvas for processing
 */
function dataUrlToCanvas(dataUrl: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    // Server-side: use canvas package if available
    return null;
  }

  const img = new Image();
  img.src = dataUrl;

  if (!img.complete) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  return canvas;
}

/**
 * Compress image for faster processing
 * Reduces size while maintaining detail for OCR
 */
export function compressImage(
  canvas: HTMLCanvasElement,
  options: PreprocessingOptions = {}
): HTMLCanvasElement {
  const targetHeight = options.targetHeight || 800;
  const scale = Math.min(1, targetHeight / canvas.height);

  if (scale >= 1) return canvas;

  const compressed = document.createElement("canvas");
  const ctx = compressed.getContext("2d");

  if (!ctx) return canvas;

  compressed.width = Math.round(canvas.width * scale);
  compressed.height = Math.round(canvas.height * scale);

  ctx.drawImage(canvas, 0, 0, compressed.width, compressed.height);

  return compressed;
}

/**
 * Enhance contrast for better OCR results
 * Makes text darker and background lighter
 */
export function enhanceContrast(
  canvas: HTMLCanvasElement,
  boost: number = 1.2
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Apply contrast formula: (value - 128) * boost + 128
    data[i] = Math.min(255, Math.max(0, (r - 128) * boost + 128));
    data[i + 1] = Math.min(255, Math.max(0, (g - 128) * boost + 128));
    data[i + 2] = Math.min(255, Math.max(0, (b - 128) * boost + 128));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Sharpen image for better text visibility
 * Applies unsharp mask technique
 */
export function sharpenImage(
  canvas: HTMLCanvasElement,
  strength: number = 1.5
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Create blurred version
  const blurred = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    blurred[i] = data[i];
    blurred[i + 1] = data[i + 1];
    blurred[i + 2] = data[i + 2];
    blurred[i + 3] = data[i + 3];
  }

  // Simple blur kernel
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * w + x) * 4 + c;
        const sum =
          blurred[(y - 1) * w * 4 + (x - 1) * 4 + c] +
          blurred[(y - 1) * w * 4 + x * 4 + c] +
          blurred[(y - 1) * w * 4 + (x + 1) * 4 + c] +
          blurred[y * w * 4 + (x - 1) * 4 + c] +
          blurred[y * w * 4 + x * 4 + c] +
          blurred[y * w * 4 + (x + 1) * 4 + c] +
          blurred[(y + 1) * w * 4 + (x - 1) * 4 + c] +
          blurred[(y + 1) * w * 4 + x * 4 + c] +
          blurred[(y + 1) * w * 4 + (x + 1) * 4 + c];

        // Unsharp mask: original + (original - blurred) * strength
        const sharp = data[idx] + (data[idx] - Math.round(sum / 9)) * strength;
        data[idx] = Math.min(255, Math.max(0, sharp));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Convert to grayscale for OCR
 * Black & white improves text recognition
 */
export function toGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Detect image edges for card boundary detection
 * Helps crop to card boundaries automatically
 */
export function detectEdges(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8ClampedArray();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;

  // Sobel edge detection
  const edges = new Uint8ClampedArray(data.length / 4);

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const getPixel = (dx: number, dy: number) => {
        const idx = ((y + dy) * w + (x + dx)) * 4;
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      };

      const gx =
        -getPixel(-1, -1) -
        2 * getPixel(-1, 0) -
        getPixel(-1, 1) +
        getPixel(1, -1) +
        2 * getPixel(1, 0) +
        getPixel(1, 1);

      const gy =
        -getPixel(-1, -1) -
        2 * getPixel(0, -1) -
        getPixel(1, -1) +
        getPixel(-1, 1) +
        2 * getPixel(0, 1) +
        getPixel(1, 1);

      edges[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  return edges;
}

/**
 * Full preprocessing pipeline
 * Optimized for OCR text recognition
 */
export function preprocessImageForOCR(
  canvas: HTMLCanvasElement,
  options: PreprocessingOptions = {}
): HTMLCanvasElement {
  let processed = canvas;

  // 1. Compress for faster processing
  processed = compressImage(processed, options);

  // 2. Convert to grayscale
  processed = toGrayscale(processed);

  // 3. Enhance contrast (most important for text)
  processed = enhanceContrast(processed, options.contrastBoost || 1.3);

  // 4. Sharpen for better edge definition
  processed = sharpenImage(processed, options.sharpnessBoost || 1.5);

  return processed;
}

/**
 * Detect likely card boundaries
 * Helps crop to card area before OCR
 */
export function detectCardBounds(
  canvas: HTMLCanvasElement
): { x: number; y: number; width: number; height: number } | null {
  const edges = detectEdges(canvas);
  const w = canvas.width;
  const h = canvas.height;

  // Find bounding box of edges
  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  let edgeCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edges[y * w + x] > 128) {
        // Strong edge
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        edgeCount++;
      }
    }
  }

  if (edgeCount === 0) return null;

  return {
    x: Math.max(0, minX - 10),
    y: Math.max(0, minY - 10),
    width: Math.min(w, maxX - minX + 20),
    height: Math.min(h, maxY - minY + 20),
  };
}

/**
 * Crop canvas to region
 */
export function cropCanvas(
  canvas: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number }
): HTMLCanvasElement {
  const cropped = document.createElement("canvas");
  const ctx = cropped.getContext("2d");

  if (!ctx) return canvas;

  cropped.width = bounds.width;
  cropped.height = bounds.height;

  const sourceCtx = canvas.getContext("2d");
  if (!sourceCtx) return canvas;

  const imageData = sourceCtx.getImageData(
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height
  );
  ctx.putImageData(imageData, 0, 0);

  return cropped;
}

/**
 * Convert canvas to data URL for storage/transmission
 */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  quality: number = 0.8
): string {
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Client-side preprocessing pipeline
 * Returns optimized image data URL
 */
export async function preprocessImageClient(
  imageDataUrl: string,
  options: PreprocessingOptions = {}
): Promise<{
  processed: string;
  bounds?: { x: number; y: number; width: number; height: number };
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve({ processed: imageDataUrl });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Detect card bounds
      const bounds = detectCardBounds(canvas);
      let workCanvas = canvas;

      if (bounds) {
        workCanvas = cropCanvas(canvas, bounds);
      }

      // Apply OCR preprocessing
      workCanvas = preprocessImageForOCR(workCanvas, options);

      // Convert back to data URL
      const processed = canvasToDataUrl(workCanvas, 0.9);

      resolve({ processed, bounds });
    };

    img.src = imageDataUrl;
  });
}
