/**
 * PriceCharting API helper
 *
 * Shared utility for fetching market prices from PriceCharting.
 * Used by scan routes so that estimatedValue reflects real market data
 * rather than AI guesses.
 */

export interface PriceChartingLookupInput {
  name: string;
  player?: string;
  year?: number;
  brand?: string;
  sport?: string;
  condition?: string;
}

export interface PriceChartingResult {
  found: true;
  price: number; // in dollars
  looseCents?: number;
  cibCents?: number;
  newCents?: number;
  gradedCents?: number;
  productName?: string;
  productId?: string;
}

export type PriceChartingResponse =
  | PriceChartingResult
  | { found: false; reason: string };

/**
 * Look up a card's market value on PriceCharting.
 * Returns null if the API key is missing, the card isn't found, or the
 * request fails — so callers can gracefully fall back to an AI estimate.
 *
 * An optional `timeoutMs` cap (default 5000 ms) prevents slow lookups
 * from stalling the scan pipeline.
 */
export async function fetchPriceChartingValue(
  card: PriceChartingLookupInput,
  timeoutMs = 5000
): Promise<number | null> {
  const apiKey = process.env.PRICECHARTING_API_KEY;
  if (!apiKey) return null;

  const name = String(card.name || "").trim();
  if (!name) return null;

  // Build search query from available metadata
  let searchQuery = name;
  if (card.player && card.player !== "Unknown Player") {
    searchQuery = `${card.player} ${searchQuery}`;
  }
  if (card.year) {
    searchQuery = `${card.year} ${searchQuery}`;
  }
  if (card.brand && card.brand !== "Unknown") {
    searchQuery = `${card.brand} ${searchQuery}`;
  }

  // PriceCharting uses console-name for sport card categories
  const consoleName = card.sport ? `${card.sport} Cards` : "Baseball Cards";

  const url = new URL("https://www.pricecharting.com/api/product");
  url.searchParams.append("t", apiKey);
  url.searchParams.append("q", searchQuery);
  url.searchParams.append("console", consoleName);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { "User-Agent": "StackTrackPro/1.0" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      console.warn(`[PriceCharting] API returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data?.status === "error") {
      return null;
    }

    const looseCents: number | undefined = data["loose-price"];
    const cibCents: number | undefined = data["cib-price"];
    const newCents: number | undefined = data["new-price"];

    const loose = looseCents ? looseCents / 100 : null;
    const complete = cibCents ? cibCents / 100 : null;
    const mint = newCents ? newCents / 100 : null;

    // Pick the most relevant price tier based on condition
    const condition = String(card.condition || "").toLowerCase();
    let price: number | null;
    if (condition === "mint" && mint != null) {
      price = mint;
    } else if (complete != null) {
      price = complete;
    } else {
      price = loose;
    }

    return price != null && price > 0 ? price : null;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[PriceCharting] Lookup timed out");
    } else {
      console.warn("[PriceCharting] Lookup error:", err?.message ?? err);
    }
    return null;
  }
}
