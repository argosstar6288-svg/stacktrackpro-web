import { NextRequest, NextResponse } from "next/server";
import { buildPriceChartingSearchQuery, searchPriceChartingProducts } from "@/lib/pricecharting";

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
    if (!process.env.PRICECHARTING_API_KEY) {
      return corsResponse({ status: "error", error: "PriceCharting API key not configured" }, 500);
    }

    const { searchParams } = new URL(request.url);
    let q = searchParams.get("q") || undefined;

    if (!q && searchParams.get("name")) {
      q = buildPriceChartingSearchQuery({
        name: searchParams.get("name") || "",
        player: searchParams.get("player") || undefined,
        brand: searchParams.get("brand") || undefined,
        sport: searchParams.get("sport") || undefined,
        game: searchParams.get("game") || undefined,
        year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
      });
    }

    if (!q) {
      return corsResponse({ status: "error", error: "Provide q or name" }, 400);
    }

    const products = await searchPriceChartingProducts(q);
    return corsResponse({ status: "success", products, query: q });
  } catch (error) {
    return corsResponse(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown products lookup error",
      },
      500
    );
  }
}
