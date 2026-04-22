import { NextRequest, NextResponse } from "next/server";
import { buildPriceChartingSearchQuery, fetchPriceChartingProduct } from "@/lib/pricecharting";

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
    const id = searchParams.get("id") || undefined;
    const upc = searchParams.get("upc") || undefined;
    let q = searchParams.get("q") || undefined;

    if (!q && searchParams.get("name")) {
      q = buildPriceChartingSearchQuery({
        name: searchParams.get("name") || "",
        player: searchParams.get("player") || undefined,
        brand: searchParams.get("brand") || undefined,
        sport: searchParams.get("sport") || undefined,
        game: searchParams.get("game") || undefined,
        year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
        condition: searchParams.get("condition") || undefined,
      });
    }

    if (!id && !upc && !q) {
      return corsResponse(
        { status: "error", error: "Provide id, upc, q, or name" },
        400
      );
    }

    const product = await fetchPriceChartingProduct({ id, upc, q });
    if (!product) {
      return corsResponse({ status: "error", error: "Product not found" }, 404);
    }

    return corsResponse(product);
  } catch (error) {
    return corsResponse(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown product lookup error",
      },
      500
    );
  }
}
