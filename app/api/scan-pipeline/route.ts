import { NextRequest, NextResponse } from "next/server";

// Service URLs
const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MATCHER = process.env.MATCHING_ENGINE_URL || "http://localhost:3002";

// Timeouts (ms)
const TIMEOUTS = {
  ai: 4000,      // AI service
  match: 1500,   // Matching
  price: 2000    // Pricing
};

/**
 * Fast text-only matching (no AI service needed)
 * ~100-200ms response time
 */
async function fastMatch(text: string, gameType: string | null) {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUTS.match);

  try {
    const res = await fetch(`${MATCHER}/identify-multi-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, gameType: gameType || "pokemon", yoloDetections: [] }),
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`Matcher returned ${res.status}`);
    const data = await res.json();

    return {
      success: data.success,
      card: data.card,
      confidence: data.confidence,
      time: Date.now() - t0
    };
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    throw timeout ? new Error("Matching timeout") : e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full image scan with AI processing
 * ~3-5s response time
 */
async function fullScan(file: File | Blob, gameType: string | null) {
  const t0 = Date.now();

  try {
    // 1. AI Service (with timeout)
    const aiTimer = setTimeout(() => {
      throw new Error("AI timeout");
    }, TIMEOUTS.ai);

    const aiForm = new FormData();
    aiForm.append("file", file);
    const aiRes = await fetch(`${AI_SERVICE}/scan`, { method: "POST", body: aiForm });
    clearTimeout(aiTimer);

    if (!aiRes.ok) throw new Error(`AI returned ${aiRes.status}`);
    const aiData = await aiRes.json();

    // 2. Match (parallel with optional pricing)
    const text = aiData.text || "";
    const type = gameType || detectGame(text);

    const matchTimer = setTimeout(() => {
      throw new Error("Match timeout");
    }, TIMEOUTS.match);

    const matchRes = await fetch(`${MATCHER}/identify-multi-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, gameType: type, yoloDetections: aiData.detections || [] })
    });
    clearTimeout(matchTimer);

    if (!matchRes.ok) throw new Error(`Matcher returned ${matchRes.status}`);
    const matchData = await matchRes.json();

    // 3. Pricing (fire and forget - don't wait)
    const card = matchData.card;
    let price = card?.price || 0;

    if (card) {
      fetch(`${MATCHER}/pricing/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, gameType: type })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) price = data.estimatedPrice;
        })
        .catch(() => {}); // Silently ignore pricing errors
    }

    return {
      success: matchData.success,
      card: matchData.card,
      confidence: matchData.confidence,
      price: matchData.card?.price || 0,
      time: Date.now() - t0
    };
  } catch (e) {
    throw e;
  }
}

function detectGame(text: string): string {
  const s = text.toLowerCase();
  if (s.includes("pikachu") || s.includes("pokemon") || s.includes("hp"))
    return "pokemon";
  if (s.includes("yugioh") || s.includes("blue-eyes"))
    return "yugioh";
  if (s.includes("magic") || s.includes("mana"))
    return "magic";
  if (s.includes("baseball") || s.includes("football") || s.includes("rookie"))
    return "sports";
  return "pokemon";
}

// ============================================================================

/**
 * POST /api/scan-pipeline
 * Full image scan
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  try {
    // Check for fast-match query
    if (req.nextUrl.searchParams.get("fast")) {
      const { text } = (await req.json()) as { text: string };
      if (!text) {
        return NextResponse.json({ success: false, error: "Text required" }, { status: 400 });
      }

      const game = req.nextUrl.searchParams.get("game");
      const result = await fastMatch(text, game);

      return NextResponse.json({
        success: result.success,
        result: {
          card: result.card,
          confidence: result.confidence,
          price: result.card?.price || 0
        },
        time_ms: result.time
      });
    }

    // Full scan with image
    const form = await req.formData();
    const file = form.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const game = req.nextUrl.searchParams.get("gameType");
    const result = await fullScan(file, game);

    return NextResponse.json(
      {
        success: result.success,
        result: {
          card: result.card,
          cardName: result.card?.name,
          confidence: result.confidence,
          price: result.price
        },
        time_ms: result.time
      },
      { status: result.success ? 200 : 400 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg.includes("timeout") ? 504 : 500;

    return NextResponse.json(
      {
        success: false,
        error: msg,
        time_ms: Date.now() - t0
      },
      { status }
    );
  }
}

/**
 * GET /api/scan-pipeline/health
 * Check if all services are available
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const [aiHealth, matchHealth] = await Promise.all([
      fetch(`${AI_SERVICE}/health`, { signal: AbortSignal.timeout(2000) })
        .then(r => ({ status: r.ok ? "ok" : "error" }))
        .catch(() => ({ status: "unavailable" })),

      fetch(`${MATCHER}/health`, { signal: AbortSignal.timeout(2000) })
        .then(r => ({ status: r.ok ? "ok" : "error" }))
        .catch(() => ({ status: "unavailable" }))
    ]);

    const healthy = aiHealth.status === "ok" && matchHealth.status === "ok";

    return NextResponse.json(
      {
        healthy,
        services: { aiHealth, matchHealth },
        timeouts_ms: TIMEOUTS
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      { healthy: false, error: "Health check failed" },
      { status: 503 }
    );
  }
}
