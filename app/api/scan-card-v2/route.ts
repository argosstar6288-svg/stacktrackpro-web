import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { hybridScanPipeline } from "@/lib/scanPipeline";

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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let db: any;
if (getApps().length === 0) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else {
  db = getFirestore(getApps()[0]);
}

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
    ? "You are a fast card identifier. Return ONLY valid raw JSON with: name, player, cardNumber, setName, year, brand, sport, condition, estimatedValue, confidence (0-1), isGraded, gradingCompany, grade."
    : `You are an expert sports card identifier. Scan the entire card systematically:
- Top: year, brand, set name
- Center: player, team, number
- Edges: card number, text details
Return ONLY raw JSON (no markdown).`;

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
                ? "Quickly identify this card."
                : "Analyze this card thoroughly and extract all visible information.",
            },
            {
              type: "image_url",
              image_url: {
                url: image,
                detail: instant ? "low" : "high",
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
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Parse JSON response
  const cleanedContent = content
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const result = JSON.parse(cleanedContent);

  // Normalize result
  return {
    name: result.name || "Sports Card",
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
        isLifetime = userData?.subscription?.isLifetime === true;
        const aiScansUsed = userData?.aiScansUsed || 0;
        const FREE_TIER_LIMIT = 50;

        if (!isLifetime && aiScansUsed >= FREE_TIER_LIMIT) {
          return corsResponse(
            {
              error: "Scan limit reached",
              message: `You've used all ${FREE_TIER_LIMIT} free scans. Upgrade for unlimited scanning.`,
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
          aiVisionApi: "/api/scan-card/vision",
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

    // === Step 2: Fall back to OpenAI Vision ===
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

        return corsResponse(
          {
            error: "Failed to identify card",
            details: aiError instanceof Error ? aiError.message : "Unknown error",
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
