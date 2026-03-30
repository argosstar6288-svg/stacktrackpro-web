const express = require("express");
const { searchSoldItems, calculateCardValue } = require("../services/ebayService");
const { cleanSalesData } = require("../services/cleaningService");
const { calculateValue } = require("../services/valuationService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const items = await searchSoldItems(query);
    const cleanItems = cleanSalesData(items);
    const value = calculateCardValue(cleanItems);
    const valuation = calculateValue(cleanItems);

    res.json({
      query,
      price: value,
      value,
      comparables: cleanItems.slice(0, 5),
      valuation,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Valuation failed" });
  }
});

module.exports = router;