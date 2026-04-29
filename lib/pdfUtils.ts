/**
 * PDF utility functions for converting PDF pages to images
 * Uses PDF.js library loaded from CDN for browser-side PDF processing
 * 
 * Note: This utility is client-side only and works in the browser.
 */

export interface PDFConversionOptions {
  scale?: number;
  maxPages?: number;
}

// Declare global pdfjsLib for TypeScript
declare const pdfjsLib: any;

/**
 * Load PDF.js library from CDN if not already loaded
 */
function loadPDFJSFromCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof pdfjsLib !== "undefined") {
      resolve();
      return;
    }

    // Load the main PDF.js library
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;

    script.onload = () => {
      // Set the worker source
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve();
    };

    script.onerror = () => {
      reject(new Error("Failed to load PDF.js library"));
    };

    document.head.appendChild(script);
  });
}

/**
 * Convert a PDF file to an array of data URLs (one per page)
 * @param file The PDF file to convert
 * @param options Conversion options
 * @returns Promise resolving to array of data URLs and page labels
 */
export async function convertPDFToImages(
  file: File,
  options?: PDFConversionOptions
): Promise<{ dataUrl: string; label: string }[]> {
  if (!file.type.includes("pdf")) {
    throw new Error("File is not a PDF");
  }

  // Load PDF.js from CDN if needed
  await loadPDFJSFromCDN();

  const pdfjsLib = (window as any).pdfjsLib;
  const scale = options?.scale ?? 2;
  const maxPages = options?.maxPages ?? 50;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const maxPagesToProcess = Math.min(pdf.numPages, maxPages);
        const images: { dataUrl: string; label: string }[] = [];

        for (let pageNum = 1; pageNum <= maxPagesToProcess; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Failed to get canvas context");
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;

          const dataUrl = canvas.toDataURL("image/jpeg");
          const label = `${file.name.replace(/\.pdf$/i, "")} - Page ${pageNum}`;

          images.push({ dataUrl, label });
        }

        resolve(images);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read PDF file"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Check if a file is a PDF
 */
export function isPDF(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Check if a file is an image
 */
export function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}
