import express from "express";
import { getCache, setCache } from "../services/cache.js";
import { fetchPrice } from "../services/pricingService.js";

export const pricingRouter = express.Router();

pricingRouter.get("/price", async (req, res) => {
  try {
    const card = String(req.query.card || "").trim();
    if (!card) {
      return res.status(400).json({ error: "card query is required" });
    }

    const key = `price:${card.toLowerCase()}`;
    const cached = await getCache(key);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const price = await fetchPrice(card);

    if (!price) {
      return res.status(404).json({ error: "No pricing data found" });
    }

    await setCache(key, price, 12 * 60 * 60);
    return res.json({ ...price, cached: false });
  } catch (error) {
    const upstreamErrors = error?.response?.data?.errors;

    return res.status(500).json({
      error: "Failed to fetch price",
      details:
        upstreamErrors?.[0]?.message ||
        (error instanceof Error ? error.message : "Unknown error"),
    });
  }
});
