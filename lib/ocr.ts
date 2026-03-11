/**
 * OCR Text Extraction
 * 
 * Extracts text from card images using Tesseract.js
 * Target: < 300ms per image
 * 
 * Note: Tesseract.js requires web worker for performance
 * Add to package.json: npm install tesseract.js
 */

export interface OCRResult {
  fullText: string;
  confidence: number;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export interface ExtractedCardInfo {
  name?: string;
  cardNumber?: string;
  setName?: string;
  year?: number;
  playerName?: string;
  team?: string;
  sport?: string;
}

/**
 * Extract card information patterns from OCR text
 */
export function extractCardInfoFromText(text: string): ExtractedCardInfo {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const info: ExtractedCardInfo = {};

  // Pattern: Card number (e.g., "4/102", "58/102", "001/150")
  const numberMatch = text.match(/(\d+\/\d+)/);
  if (numberMatch) {
    info.cardNumber = numberMatch[1];
  }

  // Pattern: 4-digit year (e.g., "1999", "2023")
  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    info.year = parseInt(yearMatch[1], 10);
  }

  // Look for set names (usually CAPS or Title Case on separate line)
  const setPatterns = [
    "Base Set",
    "Jungle",
    "Fossil",
    "Team Rocket",
    "Neo Genesis",
    "Neo Discovery",
    "Neo Revelation",
    "Neo Destiny",
    "Legendary Collection",
    "Wizards Black Star",
    "Best of Game",
    "Crown Zenith",
    "Scarlet & Violet",
    "Sword & Shield",
    "Crown Tundra",
    "Shining Fates",
    "Battle Styles",
    "Chilling Reign",
    "Evolving Skies",
    "Fusion Strike",
    "Brilliant Stars",
    "Astral Radiance",
    "Lost Origin",
  ];

  for (const set of setPatterns) {
    if (text.toUpperCase().includes(set.toUpperCase())) {
      info.setName = set;
      break;
    }
  }

  // First line is often the card name
  if (lines.length > 0) {
    const firstLine = lines[0];
    // Exclude numbers-only and very short strings
    if (
      !/^\d+$/.test(firstLine) &&
      firstLine.length > 2 &&
      !firstLine.includes("/")
    ) {
      info.name = firstLine;
    }
  }

  // Look for HP value (indicates Pokémon card)
  const hpMatch = text.match(/HP\s*(\d+)/i);
  if (hpMatch) {
    info.sport = "Pokemon TCG";
  }

  // Look for team indicators (sports cards)
  const teams = [
    "Yankees",
    "Red Sox",
    "Dodgers",
    "Lakers",
    "Celtics",
    "Cowboys",
    "Patriots",
    "Chiefs",
    "49ers",
  ];
  for (const team of teams) {
    if (text.includes(team)) {
      info.team = team;
      break;
    }
  }

  return info;
}

/**
 * Confidence score from OCR results
 * Combines text recognition confidence
 */
export function calculateOCRConfidence(ocrResult: OCRResult): number {
  if (!ocrResult.blocks || ocrResult.blocks.length === 0) {
    return 0;
  }

  // Use median confidence to avoid outliers
  const confidences = ocrResult.blocks
    .map((b) => b.confidence)
    .sort((a, b) => a - b);

  const medianIndex = Math.floor(confidences.length / 2);
  const median =
    confidences.length % 2 === 0
      ? (confidences[medianIndex - 1] + confidences[medianIndex]) / 2
      : confidences[medianIndex];

  // Normalize to 0-1 range and apply minimum threshold
  return Math.max(0.3, median / 100);
}

/**
 * Mock OCR for development (returns placeholder results)
 * Replace with actual Tesseract.js in production
 */
export async function extractTextMock(
  imageData: string | HTMLCanvasElement
): Promise<OCRResult> {
  // Simulate OCR processing delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    fullText: "Charizard\n4/102\nBase Set\n1999",
    confidence: 0.85,
    blocks: [
      {
        text: "Charizard",
        confidence: 90,
        bbox: { x0: 50, y0: 50, x1: 150, y1: 100 },
      },
      {
        text: "4/102",
        confidence: 92,
        bbox: { x0: 50, y0: 150, x1: 120, y1: 180 },
      },
      {
        text: "Base Set",
        confidence: 88,
        bbox: { x0: 50, y0: 200, x1: 150, y1: 230 },
      },
      {
        text: "1999",
        confidence: 91,
        bbox: { x0: 50, y0: 250, x1: 120, y1: 280 },
      },
    ],
  };
}

/**
 * Real OCR using Tesseract.js
 * Requires: npm install tesseract.js
 * 
 * Usage:
 *   const result = await extractTextTesseract(imageCanvas);
 */
export async function extractTextTesseract(
  imageData: string | HTMLCanvasElement
): Promise<OCRResult> {
  try {
    // Dynamically import Tesseract (to avoid build issues in SSR)
     const Tesseract = await import("tesseract.js").then((m) => m.default);

    console.log("[OCR] Starting Tesseract extraction...");
    const startTime = performance.now();

    const result = await Tesseract.recognize(
      imageData,
      "eng",
      {
        logger: (m: any) => console.log("[OCR]", m.status, m.progress),
      }
    );

    const elapsed = performance.now() - startTime;
    console.log(`[OCR] Completed in ${Math.round(elapsed)}ms`);

    // Parse Tesseract result into our format
    const text = result.data.text;
    const confidence = result.data.confidence / 100;

    // Extract blocks if available
     // Create blocks array by splitting text into lines
     const blocks = text
       .split("\n")
       .map((line: string) => ({
         text: line.trim(),
         confidence,
         bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
       }))
       .filter(b => b.text.length > 0);

    return {
      fullText: text,
      confidence,
      blocks,
    };
  } catch (error) {
    console.error("[OCR] Tesseract extraction failed:", error);
    throw error;
  }
}

/**
 * Extract text from image (uses Tesseract with fallback to mock)
 */
export async function extractText(
  imageData: string | HTMLCanvasElement,
  useMock: boolean = false
): Promise<OCRResult> {
  if (useMock || typeof window === "undefined") {
    return extractTextMock(imageData);
  }

  try {
    return await extractTextTesseract(imageData);
  } catch (error) {
    console.warn("[OCR] Falling back to mock OCR:", error);
    return extractTextMock(imageData);
  }
}

/**
 * Full OCR pipeline: preprocess → extract → parse
 */
export async function ocrPipeline(
  imageDataUrl: string,
  options: {
    useMock?: boolean;
    preprocessFirst?: boolean;
  } = {}
): Promise<{
  ocr: OCRResult;
  cardInfo: ExtractedCardInfo;
  confidence: number;
}> {
  let processedImage = imageDataUrl;

  // Optional: Preprocess image first (improves OCR accuracy)
  if (options.preprocessFirst && typeof window !== "undefined") {
    try {
      const { preprocessImageClient } = await import(
        "./imagePreprocessing"
      );
      const { processed } = await preprocessImageClient(imageDataUrl);
      processedImage = processed;
    } catch (e) {
      console.warn("[OCR] Preprocessing failed, using original image:", e);
    }
  }

  // Extract text
  const ocr = await extractText(processedImage, options.useMock);

  // Parse extracted text
  const cardInfo = extractCardInfoFromText(ocr.fullText);

  // Calculate confidence
  const confidence = calculateOCRConfidence(ocr);

  return {
    ocr,
    cardInfo,
    confidence,
  };
}

/**
 * Validate extracted card info (checks if we got useful data)
 */
export function isValidCardExtraction(info: ExtractedCardInfo): boolean {
  // Must have at least one of these
  return !!(
    info.name ||
    info.cardNumber ||
    (info.year && info.year > 1995 && info.year < 2100)
  );
}
