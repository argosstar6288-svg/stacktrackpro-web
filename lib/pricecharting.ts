/**
 * PriceCharting API helper
 *
 * Shared utility for fetching market prices and product search data from
 * PriceCharting. Used by scan routes and seller tooling so StackTrack can
 * rely on real marketplace data rather than guesses or mock records.
 */

export interface PriceChartingLookupInput {
  name: string;
  player?: string;
  year?: number;
  brand?: string;
  sport?: string;
  game?: string;
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

export interface PriceChartingProductRecord {
  status: "success" | "error";
  "product-name"?: string;
  "console-name"?: string;
  "release-date"?: string;
  "loose-price"?: number;
  "cib-price"?: number;
  "new-price"?: number;
  "graded-price"?: number;
  "box-only-price"?: number;
  "manual-only-price"?: number;
  id?: string;
  "error-message"?: string;
}

export type PriceChartingResponse =
  | PriceChartingResult
  | { found: false; reason: string };

function getApiKey() {
  return process.env.PRICECHARTING_API_KEY || "";
}

export function resolvePriceChartingConsoleName(input: {
  game?: string;
  sport?: string;
  name?: string;
  brand?: string;
}): string {
  const combined = [input.game, input.sport, input.name, input.brand]
    .map((value) => String(value || "").trim().toLowerCase())
    .join(" ");

  if (combined.includes("pokemon")) return "Pokemon Cards";
  if (combined.includes("magic") || combined.includes("mtg")) return "Magic Cards";
  if (combined.includes("yugioh") || combined.includes("yu-gi-oh") || combined.includes("yu gi oh")) {
    return "YuGiOh Cards";
  }
  if (combined.includes("one piece") || combined.includes("onepiece")) {
    return "One Piece Cards";
  }

  const sport = String(input.sport || "").trim();
  return sport ? `${sport} Cards` : "";
}

export function buildPriceChartingSearchQuery(card: PriceChartingLookupInput): string {
  const name = String(card.name || "").trim();
  const queryParts: string[] = [];

  if (card.player && card.player !== "Unknown Player") queryParts.push(String(card.player).trim());
  if (card.year) queryParts.push(String(card.year));
  if (card.brand && card.brand !== "Unknown") queryParts.push(String(card.brand).trim());
  if (name) queryParts.push(name);

  const consoleName = resolvePriceChartingConsoleName(card);
  if (consoleName) queryParts.push(consoleName);

  return queryParts.filter(Boolean).join(" ").trim();
}

async function fetchPriceChartingJson(
  endpoint: "product" | "products" | "offers",
  params: Record<string, string | number | undefined>,
  timeoutMs = 5000
) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`https://www.pricecharting.com/api/${endpoint}`);
  url.searchParams.set("t", apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "User-Agent": "StackTrackPro/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[PriceCharting] ${endpoint} returned ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn(`[PriceCharting] ${endpoint} lookup timed out`);
    } else {
      console.warn(`[PriceCharting] ${endpoint} lookup error:`, err?.message ?? err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPriceChartingProduct(
  params: { id?: string; upc?: string; q?: string },
  timeoutMs = 5000
): Promise<PriceChartingProductRecord | null> {
  const data = await fetchPriceChartingJson("product", params, timeoutMs);
  if (!data || data?.status === "error") return null;
  return data as PriceChartingProductRecord;
}

export async function searchPriceChartingProducts(q: string, timeoutMs = 5000) {
  const data = await fetchPriceChartingJson("products", { q }, timeoutMs);
  if (!data || data?.status === "error") return [];
  return Array.isArray(data?.products) ? data.products : [];
}

/**
 * Look up a card's market value on PriceCharting.
 * Returns null if the API key is missing, the card isn't found, or the
 * request fails — so callers can gracefully fall back to an AI estimate.
 */
export async function fetchPriceChartingValue(
  card: PriceChartingLookupInput,
  timeoutMs = 5000
): Promise<number | null> {
  const name = String(card.name || "").trim();
  if (!name || !getApiKey()) return null;

  const fullQuery = buildPriceChartingSearchQuery(card);
  const fallbackQueries = [fullQuery, name].filter(Boolean);

  let data: PriceChartingProductRecord | null = null;
  for (const query of fallbackQueries) {
    data = await fetchPriceChartingProduct({ q: query }, timeoutMs);
    if (data) break;
  }

  if (!data) return null;

  const looseCents = data["loose-price"];
  const cibCents = data["cib-price"];
  const newCents = data["new-price"];

  const loose = looseCents ? looseCents / 100 : null;
  const complete = cibCents ? cibCents / 100 : null;
  const mint = newCents ? newCents / 100 : null;

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
}
