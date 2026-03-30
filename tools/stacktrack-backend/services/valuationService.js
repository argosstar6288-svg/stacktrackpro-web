const { cleanInput } = require("./cleaningService");
const { buildSearchQuery } = require("./matchingService");
const { getEbaySales } = require("./ebayService");
const { median, percentile } = require("../utils/stats");

const calculateValue = (sales) => {
  const normalizedSales = Array.isArray(sales)
    ? sales
        .map((s) => {
          if (s && typeof s === "object") {
            return {
              ...s,
              price: Number(s.price),
            };
          }

          return {
            price: Number(s),
            date: null,
          };
        })
        .filter((s) => Number.isFinite(s.price) && s.price > 0)
    : [];

  const prices = normalizedSales.map((s) => s.price);

  const avg = percentile(prices, 0.5);
  const low = percentile(prices, 0);
  const high = percentile(prices, 0.75);

  // Trend (simple)
  const recent = prices.slice(0, 3);
  const older = prices.slice(-3);

  const recentAvg = median(recent);
  const olderAvg = median(older);

  let trend = "stable";
  if (recentAvg > olderAvg) trend = "rising";
  if (recentAvg < olderAvg) trend = "falling";

  // Confidence score
  const confidence = Math.min(100, prices.length * 25);

  return {
    low,
    average: avg,
    high,
    trend,
    confidence,
    salesCount: prices.length,
    recentSales: normalizedSales.slice(0, 5),
  };
}

async function getValuation(payload) {
  const cleaned = cleanInput(payload);
  const query = buildSearchQuery(cleaned);
  const soldPrices = await getEbaySales(query);
  const summary = calculateValue(soldPrices);

  return {
    input: cleaned,
    query,
    ...summary,
  };
}

module.exports = {
  calculateValue,
  getValuation,
};
