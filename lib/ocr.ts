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

interface OCRZoneText {
  top: string;
  middle: string;
  bottom: string;
}

/**
 * Extract card information patterns from OCR text
 */
export function extractCardInfoFromText(text: string): ExtractedCardInfo {
  return extractCardInfoFromTextWithZones(text);
}

function extractCardInfoFromTextWithZones(
  text: string,
  zones?: OCRZoneText
): ExtractedCardInfo {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const topLines = String(zones?.top || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bottomText = String(zones?.bottom || "");

  const info: ExtractedCardInfo = {};

  // Pattern: Card number (e.g., "4/102", "58/102", "001/150")
  const numberMatch = (bottomText || text).match(/(\d+\/\d+)/);
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
    if ((bottomText || text).toUpperCase().includes(set.toUpperCase())) {
      info.setName = set;
      break;
    }
  }

  // First line is often the card name
  const candidateNameLine = topLines[0] || lines[0];
  if (candidateNameLine) {
    const firstLine = candidateNameLine;
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

  // Normalize to 0-1 range and apply minimum threshold.
  // Tesseract can provide confidence as 0-100 while some mocks already use 0-1.
  const normalizedMedian = median > 1 ? median / 100 : median;
  return Math.max(0.2, Math.min(1, normalizedMedian));
}

function deriveZoneTextFromBlocks(ocrResult: OCRResult): OCRZoneText {
  if (!ocrResult.blocks?.length) {
    return { top: "", middle: "", bottom: "" };
  }

  const maxY = ocrResult.blocks.reduce((max, block) => {
    const y = Math.max(block.bbox.y0 || 0, block.bbox.y1 || 0);
    return Math.max(max, y);
  }, 0);

  if (maxY <= 0) {
    return {
      top: ocrResult.blocks.slice(0, 4).map((b) => b.text).join("\n"),
      middle: ocrResult.blocks.map((b) => b.text).join("\n"),
      bottom: ocrResult.blocks.slice(-4).map((b) => b.text).join("\n"),
    };
  }

  const top: string[] = [];
  const middle: string[] = [];
  const bottom: string[] = [];

  for (const block of ocrResult.blocks) {
    const yMid = ((block.bbox.y0 || 0) + (block.bbox.y1 || 0)) / 2;
    const ratio = yMid / maxY;
    if (ratio <= 0.25) {
      top.push(block.text);
    } else if (ratio >= 0.65) {
      bottom.push(block.text);
    } else {
      middle.push(block.text);
    }
  }

  return {
    top: top.join("\n"),
    middle: middle.join("\n"),
    bottom: bottom.join("\n"),
  };
}

function emptyOCRResult(): OCRResult {
  return {
    fullText: "",
    confidence: 0,
    blocks: [],
  };
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
    const confidence = Number(result.data.confidence || 0) / 100;

    // Extract blocks if available
     // Create blocks array by splitting text into lines
    const lineBlocks = Array.isArray((result.data as any).lines)
      ? (result.data as any).lines
      : [];
    const blocks = lineBlocks.length
      ? lineBlocks
          .map((line: any) => ({
            text: String(line?.text || "").trim(),
            confidence: Number.isFinite(line?.confidence) ? Number(line.confidence) : Number(result.data.confidence || 0),
            bbox: {
              x0: Number(line?.bbox?.x0 || 0),
              y0: Number(line?.bbox?.y0 || 0),
              x1: Number(line?.bbox?.x1 || 0),
              y1: Number(line?.bbox?.y1 || 0),
            },
          }))
          .filter((block: { text: string }) => block.text.length > 0)
      : text
          .split("\n")
          .map((line: string) => ({
            text: line.trim(),
            confidence: Number(result.data.confidence || 0),
            bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
          }))
          .filter((block: { text: string }) => block.text.length > 0);

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
  if (useMock) {
    return extractTextMock(imageData);
  }

  // Server-side Tesseract is currently unreliable in this environment due to
  // worker module resolution failures. Skip it unless explicitly enabled.
  if (typeof window === "undefined" && process.env.ENABLE_SERVER_TESSERACT !== "true") {
    return emptyOCRResult();
  }

  try {
    return await extractTextTesseract(imageData);
  } catch (error) {
    console.warn("[OCR] Tesseract failed, returning empty OCR result:", error);
    return emptyOCRResult();
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
  const zones = deriveZoneTextFromBlocks(ocr);
  const cardInfo = extractCardInfoFromTextWithZones(ocr.fullText, zones);

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
