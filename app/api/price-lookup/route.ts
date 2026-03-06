import { NextRequest, NextResponse } from "next/server";

interface PriceChartingProduct {
  status: "success" | "error";
  "product-name"?: string;
  "console-name"?: string;
  "loose-price"?: number; // in pennies
  "cib-price"?: number;
  "new-price"?: number;
  "graded-price"?: number;
  "box-only-price"?: number;
  "manual-only-price"?: number;
  id?: string;
  "error-message"?: string;
}

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
    const { cardName, sport, year, player, brand, condition } = body;

    if (!cardName) {
      return corsResponse({ error: "cardName is required" }, 400);
    }

    // Build search query for PriceCharting
    // Format: "Player Year Brand CardName" or just "CardName Sport"
    let searchQuery = cardName;
    
    if (player) {
      searchQuery = `${player} ${searchQuery}`;
    }
    if (year) {
      searchQuery = `${year} ${searchQuery}`;
    }
    if (brand) {
      searchQuery = `${brand} ${searchQuery}`;
    }

    // PriceCharting uses console-name for sports card categories
    // Common mappings: "Baseball Cards", "Basketball Cards", etc.
    const consoleName = sport ? `${sport} Cards` : "Baseball Cards";

    console.log(`[Price Lookup] Query: "${searchQuery}" | Console: "${consoleName}"`);

    // Call PriceCharting API
    const url = new URL("https://www.pricecharting.com/api/product");
    url.searchParams.append("t", apiKey);
    url.searchParams.append("q", searchQuery);
    url.searchParams.append("console", consoleName);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "StackTrackPro/1.0",
      },
    });

    if (!response.ok) {
      console.error(`[Price Lookup] PriceCharting API error: ${response.status}`);
      return corsResponse(
        { 
          error: "PriceCharting API request failed",
          status: response.status 
        },
        response.status
      );
    }

    const data: PriceChartingProduct = await response.json();

    if (data.status === "error") {
      console.log(`[Price Lookup] No results: ${data["error-message"]}`);
      return corsResponse({
        found: false,
        message: data["error-message"] || "Card not found in price database",
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

    console.log(`[Price Lookup] Found: ${data["product-name"]} | Price: $${suggestedPrice}`);

    return corsResponse({
      found: true,
      productName: data["product-name"],
      consoleName: data["console-name"],
      productId: data.id,
      prices,
      suggestedPrice,
      lastUpdated: new Date().toISOString(),
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
