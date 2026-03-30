import { NextRequest, NextResponse } from "next/server";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
  limit as firestoreLimit,
} from "firebase/firestore";
import { hybridScanPipeline } from "@/lib/scanPipeline";
import { db } from "@/lib/firebase-server";
import { ocrPipeline } from "@/lib/ocr";
import { cleanScanInputForSearch, matchCardDNA } from "@/lib/card-dna";
import { getEffectiveSubscription } from "@/lib/subscriptionAccess";
import { fetchPriceChartingValue } from "@/lib/pricecharting";

/**
 * Optimized Card Scan API
 * 
 * Implements a hybrid scanning approach:
 * 1. Try fast local OCR + matching first (<1s)
 * 2. Fall back to OpenAI Vision if needed
 * 3. Save scan records and update cache
 * 
 * Performance targets:
 * - Common cards (cached): 50-100ms
 * - Local OCR match: 500-800ms  
 * - AI Vision fallback: 1-2s
 */

interface CardScanResult {
  name: string;
  player: string;
  cardNumber?: string;
  setName?: string;
  year: number;
  brand: string;
  sport: string;
  condition: string;
  isGraded: boolean;
  gradingCompany?: string;
  grade?: string;
  estimatedValue: number;
  confidence: number;
}

function resolveGamesForScan(input: {
  sport?: string;
  name?: string;
  setName?: string;
}): string[] {
  const sport = String(input.sport || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();
  const setName = String(input.setName || "").toLowerCase();
  const combined = `${sport} ${name} ${setName}`;

  if (["baseball", "basketball", "football", "hockey", "soccer", "sports"].includes(sport)) {
    return ["sports"];
  }

  if (combined.includes("pokemon") || combined.includes("charizard") || combined.includes("pikachu")) {
    return ["pokemon"];
  }

  if (combined.includes("yugioh") || combined.includes("yu-gi-oh") || combined.includes("blue eyes")) {
    return ["yugioh"];
  }

  if (combined.includes("magic") || combined.includes("mtg") || combined.includes("planeswalker")) {
    return ["magic"];
  }

  return ["pokemon", "yugioh", "magic", "sports"];
}

async function findCatalogMatchFromOCR(image: string): Promise<CardScanResult | null> {
  try {
    const { cardInfo } = await ocrPipeline(image, {
      useMock: false,
      preprocessFirst: true,
    });

    const cleanedScan = cleanScanInputForSearch({
      name: cardInfo.name,
      cardNumber: cardInfo.cardNumber,
      year: cardInfo.year,
      set: cardInfo.setName,
      sport: cardInfo.sport,
    });

    const gamesToSearch = resolveGamesForScan({
      sport: cleanedScan.sport,
      name: cleanedScan.name,
      setName: cleanedScan.set,
    });

    const tokenFromName = String(cleanedScan.name || "")
      .split(" ")
      .find((token) => token.length > 1);

    const catalogCards: any[] = [];
    for (const game of gamesToSearch) {
      const cardsRef = collection(db, "cardCatalog", game, "cards");
      let q;

      if (cleanedScan.cardNumber) {
        q = query(cardsRef, where("cardNumber", "==", cleanedScan.cardNumber), firestoreLimit(80));
      } else if (tokenFromName && cleanedScan.year) {
        q = query(
          cardsRef,
          where("searchTerms", "array-contains", tokenFromName),
          where("year", "==", cleanedScan.year),
          firestoreLimit(160)
        );
      } else if (tokenFromName) {
        q = query(cardsRef, where("searchTerms", "array-contains", tokenFromName), firestoreLimit(200));
      } else if (cleanedScan.year) {
        q = query(cardsRef, where("year", "==", cleanedScan.year), firestoreLimit(200));
      } else {
        continue;
      }

      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        catalogCards.push({
          catalogId: docSnap.id,
          stacktrackId: data.stacktrackId || "",
          name: data.name || "",
          game: data.game || game,
          set: data.set || data.setName || {},
          cardNumber: data.cardNumber,
          year: data.year,
          player: data.player,
          team: data.team,
          sport: data.sport,
          brand: data.brand,
          type: data.type,
          variant: data.variant || data.dna?.variant || null,
          dna: data.dna,
          images: data.images || { small: null, large: null },
          pricing: data.pricing,
        });
      });
    }

    if (catalogCards.length === 0) {
      return null;
    }

    const matches = matchCardDNA(
      {
        name: cleanedScan.name,
        cardNumber: cleanedScan.cardNumber,
        year: cleanedScan.year,
        set: cleanedScan.set,
        brand: cleanedScan.brand,
        sport: cleanedScan.sport,
        type: cleanedScan.type,
        team: cleanedScan.team,
        player: cleanedScan.player,
      },
      catalogCards
    );

    const best = matches[0];
    if (!best || best.percentage < 55) {
      return null;
    }

    const cardData = best.cardData || {};
    return {
      name: cardData.name || cleanedScan.name || "Trading Card",
      player: cardData.player || cleanedScan.player || "Unknown Player",
      cardNumber: cardData.cardNumber || cleanedScan.cardNumber || "",
      setName: cardData.set?.name || cardData.setName || cleanedScan.set || "",
      year: Number(cardData.year || cleanedScan.year) || new Date().getFullYear(),
      brand: cardData.brand || cleanedScan.brand || "Unknown",
      sport: cardData.sport || cleanedScan.sport || "Other",
      condition: "Good",
      isGraded: false,
      estimatedValue: Number(cardData.pricing?.averagePrice || cardData.averagePrice || 0),
      confidence: Math.max(0.55, Math.min(0.95, best.percentage / 100)),
    };
  } catch (error) {
    console.warn("[Scan API] OCR->DNA fallback failed:", error);
    return null;
  }
}

function corsResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Call OpenAI Vision API for card identification
 * Used as fallback if local OCR doesn't find a match
 */
async function callOpenAIVision(
  image: string,
  instant: boolean = false
): Promise<CardScanResult> {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY_PRODUCTION?.trim() ||
    process.env.OPENAI_API_KEY_SECRET?.trim();

  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const systemPrompt = instant
    ? "You are a fast trading-card identifier for sports cards, Pokemon, Yu-Gi-Oh, Magic, and other TCGs. Return ONLY valid raw JSON with: name, player, cardNumber, setName, year, brand, sport, condition, estimatedValue, confidence (0-1), isGraded, gradingCompany, grade."
    : `You are an expert trading-card identifier for sports cards and all major TCGs (Pokemon, Yu-Gi-Oh, Magic, One Piece, etc.). Scan the entire card systematically:
- Top: card name, year, brand, set name
- Center: character/player, art clues, team/faction
- Bottom: card number, rarity, symbols, set code
Return ONLY raw JSON (no markdown). If the card is TCG and not a sports card, set sport to "TCG" or "Other".`;

  const callVision = async (detail: "high" | "low") => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: instant ? "gpt-4o-mini" : "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: instant
                  ? "Quickly identify this card. Return JSON only."
                  : "Analyze this card thoroughly and extract all visible information. Return JSON only.",
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                  detail,
                },
              },
            ],
          },
        ],
        max_tokens: instant ? 260 : 800,
        temperature: instant ? 0.2 : 0.4,
      }),
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const error = await response.json();
        message = error.error?.message || message;
      } catch {
        // Keep HTTP status text when error payload is not JSON.
      }
      throw new Error(`OpenAI API error: ${message}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from OpenAI");
    }

    const cleanedContent = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      return JSON.parse(cleanedContent) as Record<string, any>;
    } catch {
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response as JSON");
      }
      return JSON.parse(jsonMatch[0]) as Record<string, any>;
    }
  };

  let result: Record<string, any>;
  try {
    result = await callVision(instant ? "low" : "high");
  } catch (highDetailError) {
    if (instant) {
      throw highDetailError;
    }
    // Retry once at lower detail for difficult or oversized images.
    result = await callVision("low");
  }

  // Normalize result
  return {
    name: result.name || "Trading Card",
    player: result.player || "Unknown Player",
    cardNumber: result.cardNumber || "",
    setName: result.setName || result.brand || "",
    year: result.year || new Date().getFullYear(),
    brand: result.brand || "Unknown",
    sport: result.sport || "Other",
    condition: result.condition || "Good",
    isGraded: result.isGraded || false,
    gradingCompany: result.gradingCompany,
    grade: result.grade,
    estimatedValue: result.estimatedValue || 0,
    confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
  };
}

/**
 * POST /api/scan-card
 * 
 * Body:
 * {
 *   image: string (data URL)
 *   userId: string
 *   scanMode: "instant" | "standard"
 *   useFastPath: boolean (default: true)
 *   aiVisionOnly: boolean (default: false)
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    const { image, userId, scanMode, useFastPath = true, aiVisionOnly = false } = await request.json();
    const isInstantMode = scanMode === "instant";

    console.log("[Scan API] Request received", {
      mode: isInstantMode ? "instant" : "standard",
      method: aiVisionOnly ? "ai_only" : useFastPath ? "hybrid" : "ai_fallback",
      imageSize: image?.length || 0,
    });

    // Validate inputs
    if (!image) {
      return corsResponse({ error: "No image provided" }, 400);
    }

    if (typeof image !== "string") {
      return corsResponse({ error: "Invalid image payload" }, 400);
    }

    if (!image.startsWith("data:image/")) {
      return corsResponse(
        { error: "Invalid image format. Please upload a JPG or PNG image." },
        400
      );
    }

    if (!userId) {
      return corsResponse({ error: "User ID required" }, 400);
    }

    if (typeof image === "string" && image.length > 5_000_000) {
      return corsResponse(
        { error: "Image too large. Please upload a smaller photo." },
        413
      );
    }

    // Check user quota
    let isLifetime = false;
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const effectiveSubscription = getEffectiveSubscription(userData);

        if (effectiveSubscription.shouldPersistExpiry) {
          await updateDoc(userRef, {
            "subscription.status": "expired",
            "subscription.plan": "free",
            "subscription.tier": "free",
            subscriptionTier: "free",
            trialExpiredAt: new Date(),
          });
        }

        isLifetime =
          effectiveSubscription.plan === "lifetime" ||
          effectiveSubscription.plan === "pro" ||
          effectiveSubscription.plan === "premium";
        const aiScansUsed = userData?.aiScansUsed || 0;
        const FREE_TIER_LIMIT = 50;

        if (!isLifetime && aiScansUsed >= FREE_TIER_LIMIT) {
          return corsResponse(
            {
              error: "Scan limit reached",
              message: `You've used all ${FREE_TIER_LIMIT} free scans. Upgrade to Pro or Premium for expanded scanning.`,
              quotaExceeded: true,
            },
            403
          );
        }
      }
    } catch (e) {
      console.warn("[Scan API] Quota check failed:", e);
    }

    let scanResult: CardScanResult | null = null;
    let scanMethod = "unknown";
    let timings: Record<string, number> = {};

    // === Step 1: Try hybrid pipeline (local OCR + AI fallback) ===
    if (!aiVisionOnly && useFastPath) {
      console.log("[Scan API] Attempting hybrid pipeline...");
      const pipelineStart = performance.now();

      try {
        const pipelineResult = await hybridScanPipeline(image, {
          timeoutMs: isInstantMode ? 800 : 1500,
        });

        timings.hybrid = performance.now() - pipelineStart;

        if (pipelineResult.success && pipelineResult.card) {
          scanResult = {
            name: pipelineResult.card.name,
            player: pipelineResult.card.player || "Unknown Player",
            cardNumber: pipelineResult.card.cardNumber || "",
            setName: pipelineResult.card.setName || pipelineResult.card.brand || "",
            year: pipelineResult.card.year || new Date().getFullYear(),
            brand: pipelineResult.card.brand || "Unknown",
            sport: pipelineResult.card.sport || "Other",
            condition: "Good",
            isGraded: false,
            estimatedValue: pipelineResult.card.averagePrice || 0,
            confidence: pipelineResult.confidence,
          };
          scanMethod = pipelineResult.fallbackToAI ? "hybrid_ai" : "local_ocr";

          console.log(
            `[Scan API] ✓ Pipeline succeeded: ${scanResult.name} (${Math.round(timings.hybrid)}ms, ${scanMethod})`
          );
        }
      } catch (e) {
        console.warn("[Scan API] Hybrid pipeline failed:", e);
      }
    }

    // === Step 2: Local OCR->DNA fallback for all catalog types ===
    if (!scanResult) {
      const localDnaStart = performance.now();
      const localDnaResult = await findCatalogMatchFromOCR(image);
      timings.local_dna = performance.now() - localDnaStart;
      if (localDnaResult) {
        scanResult = localDnaResult;
        scanMethod = "local_dna";
        console.log(
          `[Scan API] ✓ OCR->DNA fallback succeeded: ${scanResult.name} (${Math.round(timings.local_dna)}ms)`
        );
      }
    }

    // === Step 3: Fall back to OpenAI Vision ===
    if (!scanResult) {
      console.log("[Scan API] Using OpenAI Vision API...");
      const aiStart = performance.now();

      try {
        scanResult = await callOpenAIVision(image, isInstantMode);
        timings.ai_vision = performance.now() - aiStart;
        scanMethod = "ai_vision";

        console.log(`[Scan API] ✓ AI Vision succeeded: ${scanResult.name} (${Math.round(timings.ai_vision)}ms)`);
      } catch (aiError) {
        console.error("[Scan API] AI Vision failed:", aiError);

        const aiMessage = aiError instanceof Error ? aiError.message : "Unknown error";
        const normalizedAiMessage = String(aiMessage).toLowerCase();
        const providerQuotaExceeded =
          normalizedAiMessage.includes("insufficient_quota") ||
          normalizedAiMessage.includes("exceeded your current quota") ||
          normalizedAiMessage.includes("billing");
        const configurationError =
          normalizedAiMessage.includes("api key not configured") ||
          normalizedAiMessage.includes("invalid api key") ||
          normalizedAiMessage.includes("incorrect api key");

        return corsResponse(
          {
            error: providerQuotaExceeded
              ? "AI scanning is temporarily unavailable due to service billing limits"
              : configurationError
              ? "AI scanning is temporarily unavailable on this deployment"
              : "Failed to identify card",
            message: aiMessage,
            details: aiMessage,
            providerQuotaExceeded,
            configurationError,
          },
          500
        );
      }
    }

    // === Update usage counter ===
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        aiScansUsed: increment(1),
        lastAiScanAt: new Date(),
      });
    } catch (e) {
      console.warn("[Scan API] Failed to update counter:", e);
    }

    // === Override AI estimate with PriceCharting market value ===
    try {
      const pcPrice = await fetchPriceChartingValue({
        name: scanResult.name,
        player: scanResult.player,
        year: scanResult.year,
        brand: scanResult.brand,
        sport: scanResult.sport,
        condition: scanResult.condition,
      });
      if (pcPrice != null && pcPrice > 0) {
        scanResult.estimatedValue = pcPrice;
        console.log(`[Scan API] PriceCharting price $${pcPrice} used for ${scanResult.name}`);
      }
    } catch (pcErr) {
      console.warn("[Scan API] PriceCharting lookup failed:", pcErr);
    }

    // === Return result ===
    const totalTime = performance.now() - startTime;
    timings.total = totalTime;

    console.log(
      `[Scan API] ✓ Complete (${Math.round(totalTime)}ms, method: ${scanMethod})`
    );

    return corsResponse({
      ...scanResult,
      scanMode: isInstantMode ? "instant" : "standard",
      processingMs: totalTime,
      scanMethod,
      timings,
    });
  } catch (error) {
    console.error("[Scan API] Unexpected error:", error);
    return corsResponse(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}
