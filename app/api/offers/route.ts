import { NextRequest, NextResponse } from "next/server";

type CacheEntry = {
  data: any;
  fetchedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __priceChartingOffersCache: Map<string, CacheEntry> | undefined;
}

const OFFERS_CACHE_MS = 5 * 60 * 1000;
const offersCache = global.__priceChartingOffersCache || new Map<string, CacheEntry>();
if (!global.__priceChartingOffersCache) {
  global.__priceChartingOffersCache = offersCache;
}

function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return corsResponse({}, 200);
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.PRICECHARTING_API_KEY;
    if (!apiKey) {
      return corsResponse({ status: "error", error: "PriceCharting API key not configured" }, 500);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const seller = searchParams.get("seller") || process.env.PRICECHARTING_SELLER_ID || "";

    if (!status) {
      return corsResponse({ status: "error", error: "status is required" }, 400);
    }

    const allowedKeys = ["status", "seller", "buyer", "console", "condition-id", "genre", "id", "sort"];
    const upstreamParams = new URLSearchParams();
    upstreamParams.set("t", apiKey);

    for (const key of allowedKeys) {
      const value = key === "seller" ? seller : searchParams.get(key);
      if (value) {
        upstreamParams.set(key, value);
      }
    }

    const cacheKey = allowedKeys
      .map((key) => `${key}=${key === "seller" ? seller : searchParams.get(key) || ""}`)
      .join("&");

    const cached = offersCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < OFFERS_CACHE_MS) {
      return corsResponse({
        ...cached.data,
        cached: true,
        cachedAt: new Date(cached.fetchedAt).toISOString(),
        throttleMinutes: 5,
      });
    }

    const upstreamUrl = `https://www.pricecharting.com/api/offers?${upstreamParams.toString()}`;
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "User-Agent": "StackTrackPro/1.0",
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return corsResponse(
        {
          status: "error",
          error: "PriceCharting offers request failed",
          upstreamStatus: response.status,
          details: data,
        },
        response.status
      );
    }

    offersCache.set(cacheKey, { data, fetchedAt: Date.now() });

    return corsResponse({
      ...data,
      cached: false,
      throttleMinutes: 5,
    });
  } catch (error) {
    return corsResponse(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown offers lookup error",
      },
      500
    );
  }
}
