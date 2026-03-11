/**
 * Optimized Scan Pipeline
 * 
 * Orchestrates the full scan flow for maximum speed
 * Target: < 1.5 seconds end-to-end
 * 
 * Pipeline:
 * 1. Image preprocessing (100ms)
 * 2. OCR extraction (300ms)
 * 3. Card matching (50ms)
 * 4. Save to collection (100ms)
 * Total: ~550ms
 */

import { ocrPipeline, ExtractedCardInfo, isValidCardExtraction } from "./ocr";
import { matchCard, selectBestMatch, CardLookupMatch } from "./cardMatcher";
import { preprocessImageClient } from "./imagePreprocessing";

export interface ScanPipelineResult {
  success: boolean;
  card: CardLookupMatch | null;
  cardInfo: ExtractedCardInfo;
  confidence: number;
  timings: {
    preprocess?: number;
    ocr?: number;
    match?: number;
    total: number;
  };
  error?: string;
  fallbackToAI?: boolean;
}

/**
 * Fast local pipeline (OCR + matching)
 * No external APIs called during scan
 */
export async function fastScanPipeline(
  imageDataUrl: string,
  options: {
    preprocessImages?: boolean;
    validateExtraction?: boolean;
  } = {}
): Promise<ScanPipelineResult> {
  const pipelineStartTime = performance.now();
  const timings: ScanPipelineResult["timings"] = { total: 0 };

  try {
    // Step 1: Preprocess image
    let processedImage = imageDataUrl;
    if (options.preprocessImages && typeof window !== "undefined") {
      const preprocessStart = performance.now();
      try {
        const { processed } = await preprocessImageClient(imageDataUrl, {
          targetHeight: 800,
          contrastBoost: 1.3,
          sharpnessBoost: 1.5,
        });
        processedImage = processed;
        timings.preprocess = performance.now() - preprocessStart;
        console.log(`[Scan] Preprocessing: ${Math.round(timings.preprocess)}ms`);
      } catch (e) {
        console.warn("[Scan] Preprocessing failed, using original:", e);
      }
    }

    // Step 2: OCR text extraction
    const ocrStart = performance.now();
    const { ocr, cardInfo, confidence } = await ocrPipeline(processedImage, {
      useMock: false, // Set to true for development without Tesseract
      preprocessFirst: false, // Already preprocessed above
    });
    timings.ocr = performance.now() - ocrStart;
    console.log(`[Scan] OCR: ${Math.round(timings.ocr)}ms, confidence: ${Math.round(confidence * 100)}%`);

    // Validate extraction
    if (
      options.validateExtraction &&
      !isValidCardExtraction(cardInfo)
    ) {
      return {
        success: false,
        card: null,
        cardInfo,
        confidence,
        timings: { ...timings, total: performance.now() - pipelineStartTime },
        error: "Unable to extract valid card information from image",
        fallbackToAI: true,
      };
    }

    // Step 3: Card matching
    const matchStart = performance.now();
    const matches = await matchCard(cardInfo);
    timings.match = performance.now() - matchStart;
    console.log(`[Scan] Matching: ${Math.round(timings.match)}ms, matches: ${matches.length}`);

    const selectedCard = selectBestMatch(matches);

    if (!selectedCard) {
      return {
        success: false,
        card: null,
        cardInfo,
        confidence,
        timings: { ...timings, total: performance.now() - pipelineStartTime },
        error: "No matching card found in database",
        fallbackToAI: true,
      };
    }

    const totalTime = performance.now() - pipelineStartTime;
    timings.total = totalTime;

    console.log(`[Scan] ✓ Pipeline complete in ${Math.round(totalTime)}ms`);

    return {
      success: true,
      card: selectedCard,
      cardInfo,
      confidence: Math.max(confidence, selectedCard.matchScore),
      timings,
      fallbackToAI: false,
    };
  } catch (error) {
    const totalTime = performance.now() - pipelineStartTime;
    timings.total = totalTime;

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Scan] Pipeline failed: ${errorMessage}`);

    return {
      success: false,
      card: null,
      cardInfo: {},
      confidence: 0,
      timings,
      error: errorMessage,
      fallbackToAI: true,
    };
  }
}

/**
 * Hybrid pipeline: Try fast local matching first, fallback to AI
 * 
 * This allows:
 * - Fast path for common cards (50-70% hit rate expected)
 * - AI fallback for new/rare cards
 * - Minimal user wait time either way
 */
export async function hybridScanPipeline(
  imageDataUrl: string,
  options: {
    timeoutMs?: number;
    aiVisionApi?: string;
  } = {}
): Promise<ScanPipelineResult> {
  const timeoutMs = options.timeoutMs || 2000;

  console.log(`[Scan] Starting hybrid pipeline (timeout: ${timeoutMs}ms)`);

  // Try fast local pipeline first
  const fastStartTime = performance.now();
  const fastPromise = fastScanPipeline(imageDataUrl, {
    preprocessImages: true,
    validateExtraction: true,
  });

  // Race with timeout
  const timeoutPromise = new Promise<ScanPipelineResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        card: null,
        cardInfo: {},
        confidence: 0,
        timings: { total: timeoutMs },
        error: "Fast scan pipeline timed out",
        fallbackToAI: true,
      });
    }, timeoutMs);
  });

  const fastResult = await Promise.race([fastPromise, timeoutPromise]);
  const fastTime = performance.now() - fastStartTime;

  console.log(`[Scan] Fast pipeline: ${fastResult.success ? "HIT" : "MISS"} in ${Math.round(fastTime)}ms`);

  // If fast pipeline succeeded, return immediately
  if (fastResult.success) {
    return fastResult;
  }

  // If fast pipeline failed, try AI Vision (if provided)
  if (options.aiVisionApi && fastResult.fallbackToAI) {
    console.log(`[Scan] Falling back to AI Vision API`);

    try {
      const aiStart = performance.now();
      const aiResponse = await fetch(options.aiVisionApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiResult = await aiResponse.json();
      const aiTime = performance.now() - aiStart;

      console.log(`[Scan] AI Vision completed in ${Math.round(aiTime)}ms`);

      // Convert AI result to our format
      // (assume AI returns { name, cardNumber, confidence, etc. })
      return {
        success: true,
        card: {
          id: aiResult.cardId || "",
          name: aiResult.name || "",
          cardNumber: aiResult.cardNumber,
          setName: aiResult.setName,
          year: aiResult.year,
          brand: aiResult.brand,
          sport: aiResult.sport,
          imageUrl: aiResult.imageUrl,
          lookupKey: `${aiResult.name}_${aiResult.cardNumber}`,
          matchScore: aiResult.confidence || 0.7,
          matchType: "fuzzy",
        },
        cardInfo: {
          name: aiResult.name,
          cardNumber: aiResult.cardNumber,
          setName: aiResult.setName,
          year: aiResult.year,
        },
        confidence: aiResult.confidence || 0.7,
        timings: {
          ocr: aiTime,
          total: fastTime + aiTime,
        },
        fallbackToAI: true,
      };
    } catch (aiError) {
      console.error("[Scan] AI Vision fallback failed:", aiError);

      return {
        success: false,
        card: null,
        cardInfo: fastResult.cardInfo,
        confidence: fastResult.confidence,
        timings: fastResult.timings,
        error: `Scan failed: ${fastResult.error}`,
      };
    }
  }

  // Return fast pipeline failure
  return fastResult;
}

/**
 * Lightweight pipeline for testing
 * Uses mock OCR, no Tesseract dependency
 */
export async function testScanPipeline(
  imageDataUrl: string
): Promise<ScanPipelineResult> {
  console.log("[Scan] Running test pipeline (mock OCR)");

  const pipelineStartTime = performance.now();

  // Use mock OCR for instant results
  const { ocr, cardInfo, confidence } = await ocrPipeline(imageDataUrl, {
    useMock: true,
  });

  // Mock matching
  const selectedCard: CardLookupMatch = {
    id: "test-charizard",
    name: "Charizard",
    cardNumber: "4/102",
    setName: "Base Set",
    year: 1999,
    brand: "Topps",
    sport: "Pokemon",
    lookupKey: "charizard_4_102",
    matchScore: 0.92,
    matchType: "exact",
  };

  const totalTime = performance.now() - pipelineStartTime;

  return {
    success: true,
    card: selectedCard,
    cardInfo,
    confidence: 0.92,
    timings: {
      ocr: totalTime * 0.5,
      match: totalTime * 0.3,
      total: totalTime,
    },
    fallbackToAI: false,
  };
}
