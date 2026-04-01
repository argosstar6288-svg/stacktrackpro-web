import axios from "axios";
import { env } from "../config/env.js";
import { getAccessToken } from "./ebayAuth.js";

function normalizePrice(item) {
  const value = Number(item?.price?.value || item?.currentBidPrice?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

export function cleanListings(items = []) {
  return items
    .map((item) => ({
      title: item?.title || "",
      price: normalizePrice(item),
      currency: item?.price?.currency || "USD",
      condition: item?.condition || "Unknown",
    }))
    .filter((item) => item.price > 0);
}

export function calculatePrice(listings = []) {
  if (!listings.length) return null;

  const sorted = [...listings].sort((a, b) => a.price - b.price);
  const median = sorted[Math.floor(sorted.length / 2)].price;
  const avg = sorted.reduce((s, i) => s + i.price, 0) / sorted.length;

  return {
    suggestedPrice: Number(((median + avg) / 2).toFixed(2)),
    median: Number(median.toFixed(2)),
    average: Number(avg.toFixed(2)),
    samples: sorted.length,
    source: "ebay",
    refreshedAt: new Date().toISOString(),
  };
}

export async function fetchSoldListings(cardName) {
  const accessToken = await getAccessToken();

  const response = await axios.get(
    `${env.ebayBrowseBaseUrl}/buy/browse/v1/item_summary/search`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        q: cardName,
        filter: "buyingOptions:{FIXED_PRICE|AUCTION},itemLocationCountry:US",
        limit: 25,
      },
      timeout: 7000,
    }
  );

  return response.data?.itemSummaries || [];
}

export async function fetchPrice(cardName) {
  try {
    const raw = await fetchSoldListings(cardName);
    const cleaned = cleanListings(raw);
    return calculatePrice(cleaned);
  } catch {
    return null;
  }
}
