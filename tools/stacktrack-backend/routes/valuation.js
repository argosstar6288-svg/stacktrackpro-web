const express = require("express");
const { getEbaySales } = require("../services/ebayService");
const { cleanSalesData } = require("../services/cleaningService");
const { matchCard } = require("../services/matchingService");
const { calculateValue } = require("../services/valuationService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    // 1. Fetch raw sales
    const rawSales = await getEbaySales(query);

    // 2. Clean data
    const cleanSales = cleanSalesData(rawSales);

    // 3. Match card (AI placeholder)
    const matchedSales = matchCard(cleanSales, query);

    // 4. Calculate valuation
    const valuation = calculateValue(matchedSales);

    res.json({
      success: true,
      data: valuation,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
