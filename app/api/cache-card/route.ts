import { NextRequest, NextResponse } from "next/server";
import { saveCardToCache, getCachedCardMetadata, isPricingStale } from "@/lib/cardCache";
import { CachedCardMetadata } from "@/lib/cardCache";
import { buildCardLookup, buildSetID, inferGameID } from "@/lib/cardSchema";

/**
 * Card Cache API - Unified cache management for card metadata
 * 
 * POST /api/cache-card
 * Body: {
 *   stacktrackId: string,
 *   name: string,
 *   player: string,
 *   year: number,
 *   brand: string,
 *   sport: string,
 *   imageUrl?: string,
 *   forceCacheFresh?: boolean // Force update even if fresh
 * }
 * 
 * Returns cached card metadata with pricing
 */

function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return corsResponse({}, 200);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      stacktrackId,
      cardID,
      gameID,
      setID,
      lookup,
      name,
      player,
      year,
      brand,
      sport,
      condition,
      imageUrl,
      cardNumber,
      setName,
      isGraded,
      gradingCompany,
      grade,
      estimatedValue,
      forceCacheFresh,
    } = body;

    const resolvedCardID = cardID || stacktrackId;

    if (!resolvedCardID) {
      return corsResponse({ error: "cardID or stacktrackId is required" }, 400);
    }

    // Check if we already have fresh cached data
    const existing = await getCachedCardMetadata(resolvedCardID);

    // If fresh cache exists and not forcing refresh, return it
    if (existing && !forceCacheFresh && !isPricingStale(existing.lastPricingFetch)) {
      console.log(`[Card Cache] Cache HIT for ${stacktrackId}`);
      return corsResponse({
        success: true,
        cached: true,
        data: existing,
        message: "Using cached card metadata",
      });
    }

    // Build cache entry
    const cacheEntry: CachedCardMetadata = {
      stacktrackId: resolvedCardID,
      cardID: resolvedCardID,
      gameID: gameID || inferGameID({ sport, name, brand }),
      setID: setID || buildSetID(setName || brand),
      lookup: lookup || buildCardLookup({ name, cardNumber, setName: setName || brand }),
      name: name || "Unknown Card",
      player: player || "Unknown Player",
      year: year || new Date().getFullYear(),
      brand: brand || "Unknown",
      sport: sport || "Other",
      setName: setName || brand || "",
      cardNumber: cardNumber || "",
      condition: condition || "Good",
      isGraded: isGraded || false,
      gradingCompany,
      grade,
      imageUrl,
      pricing: {
        estimatedValue: estimatedValue || 0,
        estimatedValueSource: estimatedValue ? "scan" : undefined,
      },
    };

    // If we have existing stale cache, merge these details in
    if (existing && isPricingStale(existing.lastPricingFetch)) {
      cacheEntry.pricing = {
        ...existing.pricing,
        estimatedValue: estimatedValue || existing.pricing?.estimatedValue || 0,
      };
    }

    // Save to cache
    await saveCardToCache(cacheEntry);

    console.log(`[Card Cache] Cached card ${resolvedCardID} (${name})`);

    return corsResponse({
      success: true,
      cached: false,
      data: cacheEntry,
      message: "Card metadata cached successfully",
    });

  } catch (error) {
    console.error("[Card Cache] Error:", error);
    return corsResponse(
      {
        error: "Failed to cache card metadata",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stacktrackId = searchParams.get("stacktrackId");

  if (!stacktrackId) {
    return corsResponse({ error: "stacktrackId query parameter required" }, 400);
  }

  try {
    const cached = await getCachedCardMetadata(stacktrackId);

    if (!cached) {
      return corsResponse({
        success: false,
        cached: false,
        message: "Card not in cache",
      }, 404);
    }

    const isStale = isPricingStale(cached.lastPricingFetch);

    return corsResponse({
      success: true,
      cached: true,
      data: cached,
      isStale,
      message: isStale ? "Cached data is stale" : "Fresh cached data",
    });

  } catch (error) {
    console.error("[Card Cache] GET error:", error);
    return corsResponse(
      {
        error: "Failed to fetch cached card",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}
