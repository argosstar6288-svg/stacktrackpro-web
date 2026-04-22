import { NextRequest, NextResponse } from "next/server";
import { getCachedCardMetadata, updateCachePricing, isPricingStale } from "@/lib/cardCache";
import { buildPriceChartingSearchQuery, fetchPriceChartingProduct, type PriceChartingProductRecord } from "@/lib/pricecharting";

// CORS headers
function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return corsResponse({}, 200);
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.PRICECHARTING_API_KEY;
    if (!apiKey) {
      return corsResponse(
        { error: "PriceCharting API key not configured" },
        500
      );
    }

    const body = await request.json();
    const { cardName, sport, year, player, brand, condition, stacktrackId, skipCache, game } = body;

    if (!cardName) {
      return corsResponse({ error: "cardName is required" }, 400);
    }

    // Check cache first if stacktrackId provided and cache not skipped
    if (stacktrackId && !skipCache) {
      const cached = await getCachedCardMetadata(stacktrackId);
      
      // If we have cached pricing and it's fresh, return it
      if (cached?.pricing?.pricecharting && !isPricingStale(cached.lastPricingFetch)) {
        console.log(`[Price Lookup] Cache HIT for ${stacktrackId} - using cached PriceCharting data`);
        
        const prices = {
          loose: cached.pricing.pricecharting.looseCents ? (cached.pricing.pricecharting.looseCents / 100) : null,
          complete: cached.pricing.pricecharting.cibCents ? (cached.pricing.pricecharting.cibCents / 100) : null,
          new: cached.pricing.pricecharting.newCents ? (cached.pricing.pricecharting.newCents / 100) : null,
          graded: cached.pricing.pricecharting.gradedCents ? (cached.pricing.pricecharting.gradedCents / 100) : null,
        };
        
        let suggestedPrice = prices.loose;
        if (condition === "Mint" && prices.new) {
          suggestedPrice = prices.new;
        } else if (condition === "Poor" || condition === "Fair") {
          suggestedPrice = prices.loose;
        } else if (prices.complete) {
          suggestedPrice = prices.complete;
        }

        return corsResponse({
          found: true,
          productName: cached.name,
          prices,
          suggestedPrice,
          lastUpdated: cached.pricing.pricecharting.lastUpdate ? new Date(cached.pricing.pricecharting.lastUpdate).toISOString() : null,
          fromCache: true,
          cacheAge: cached.lastPricingFetch ? Math.round((Date.now() - ((cached.lastPricingFetch as any).toMillis?.() || 0)) / (1000 * 60 * 60)) : null,
        });
      }
    }

    const searchQuery = buildPriceChartingSearchQuery({
      name: cardName,
      sport,
      year,
      player,
      brand,
      game,
      condition,
    });

    console.log(`[Price Lookup] Cache MISS${stacktrackId ? ` for ${stacktrackId}` : ""} - Query: "${searchQuery}"`);

    const data: PriceChartingProductRecord | null = await fetchPriceChartingProduct({ q: searchQuery });

    if (!data) {
      console.log("[Price Lookup] No results returned from PriceCharting");
      return corsResponse({
        found: false,
        message: "Card not found in price database",
      });
    }

    // Convert pennies to dollars
    const prices = {
      loose: data["loose-price"] ? data["loose-price"] / 100 : null,
      complete: data["cib-price"] ? data["cib-price"] / 100 : null,
      new: data["new-price"] ? data["new-price"] / 100 : null,
      graded: data["graded-price"] ? data["graded-price"] / 100 : null,
      boxOnly: data["box-only-price"] ? data["box-only-price"] / 100 : null,
      manualOnly: data["manual-only-price"] ? data["manual-only-price"] / 100 : null,
    };

    // Determine the most relevant price based on condition
    let suggestedPrice = prices.loose;
    if (condition === "Mint" && prices.new) {
      suggestedPrice = prices.new;
    } else if (condition === "Poor" || condition === "Fair") {
      suggestedPrice = prices.loose;
    } else if (prices.complete) {
      suggestedPrice = prices.complete;
    }

    // Save to cache if stacktrackId provided
    if (stacktrackId) {
      try {
        const timestamp = Date.now();
        await updateCachePricing(stacktrackId, {
          pricecharting: {
            looseCents: data["loose-price"] || undefined,
            cibCents: data["cib-price"] || undefined,
            newCents: data["new-price"] || undefined,
            gradedCents: data["graded-price"] || undefined,
            lastUpdate: timestamp,
            url: `https://www.pricecharting.com/product/${data.id}`,
          },
          estimatedValue: suggestedPrice || 0,
          estimatedValueSource: "pricecharting",
        });
        console.log(`[Price Lookup] Cached pricing for ${stacktrackId}`);
      } catch (cacheErr) {
        console.warn(`[Price Lookup] Failed to cache pricing for ${stacktrackId}:`, cacheErr);
        // Don't fail the response if caching fails
      }
    }

    console.log(`[Price Lookup] Found: ${data["product-name"]} | Price: $${suggestedPrice}`);

    return corsResponse({
      found: true,
      productName: data["product-name"],
      consoleName: data["console-name"],
      productId: data.id,
      prices,
      suggestedPrice,
      lastUpdated: new Date().toISOString(),
      fromCache: false,
    });

  } catch (error) {
    console.error("[Price Lookup] Error:", error);
    return corsResponse(
      { 
        error: "Failed to lookup price",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return corsResponse({
    error: "Use POST method with card details in request body",
    example: {
      cardName: "Rookie Card",
      player: "Mike Trout",
      year: 2011,
      brand: "Topps",
      sport: "Baseball",
      condition: "Mint"
    }
  }, 400);
}
