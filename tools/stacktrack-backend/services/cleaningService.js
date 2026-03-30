const { median, percentile } = require("../utils/stats");

const cleanSalesData = (sales) => {
  const normalized = Array.isArray(sales)
    ? sales
        .map((s) => ({ ...s, price: Number(s?.price) }))
        .filter((s) => Number.isFinite(s.price) && s.price > 0)
    : [];

  const prices = normalized.map((s) => s.price);
  const med = median(prices);
  const q1 = percentile(prices, 0.25);
  const q3 = percentile(prices, 0.75);
  const iqr = Math.max(0, q3 - q1);

  // Use the stricter of two guards to remove obvious outliers like stale, very high sales.
  const lower = Math.max(med * 0.5, q1 - 1.5 * iqr);
  const upper = Math.min(med * 1.5, q3 + 1.5 * iqr);

  return normalized.filter((s) => s.price >= lower && s.price <= upper);
};

// Kept for compatibility with older valuation flow.
const cleanInput = (payload = {}) => {
  const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();
  return {
    cardName: normalizeWhitespace(payload.cardName),
    sport: normalizeWhitespace(payload.sport),
    year: payload.year ? Number(payload.year) : null,
    player: normalizeWhitespace(payload.player),
    brand: normalizeWhitespace(payload.brand),
    condition: normalizeWhitespace(payload.condition),
  };
};

module.exports = { cleanSalesData, cleanInput };
