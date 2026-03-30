const express = require("express");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const { extractTextFromImage } = require("../services/ocrService");
const { getEbaySales } = require("../services/ebayService");
const { cleanSalesData } = require("../services/cleaningService");
const { calculateValue } = require("../services/valuationService");
const { buildSearchQuery } = require("../services/matchingService");

const router = express.Router();
const upload = multer({ dest: path.resolve(__dirname, "../uploads") });

function buildQueryCandidates(text = "", prediction = null) {
  const base = buildSearchQuery(text)
    .split(" ")
    .filter((token) => token.length > 1)
    .slice(0, 8)
    .join(" ");

  const aiLabel = typeof prediction === "string"
    ? prediction
    : prediction?.label || "";

  const aiLabelQuery = aiLabel ? `${aiLabel} trading card` : "";
  const candidates = [
    base,
    base ? `${base} trading card` : "",
    base ? `${base} sports card` : "",
    aiLabelQuery,
    "pokemon trading card",
    "sports trading card",
  ];

  return [...new Set(candidates.map((q) => q.trim()).filter(Boolean))];
}

async function getPythonScanResult(imagePath) {
  try {
    const response = await axios.post("http://localhost:5000/scan", { imagePath });
    return response?.data || null;
  } catch {
    return null;
  }
}

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // 1. OCR / AI extract text
    const pythonScan = await getPythonScanResult(req.file.path);
    const pythonText = String(pythonScan?.text || "").trim();
    const fallbackText = pythonText ? "" : await extractTextFromImage(req.file.path);
    const text = pythonText || fallbackText;

    // Optional AI predictor service (if running on :5000)
    let prediction = null;
    try {
      const aiRes = await axios.post("http://localhost:5000/predict", { imagePath: req.file.path });
      prediction = aiRes?.data?.prediction ?? null;
    } catch {
      prediction = null;
    }

    // 2. Build search queries and use the first one that yields usable sales.
    const suggestedQuery = buildSearchQuery(pythonScan?.suggested_query || text);
    const queries = buildQueryCandidates(suggestedQuery || text, prediction);

    let chosenQuery = suggestedQuery || queries[0] || "trading card";
    let raw = [];

    for (const candidate of queries) {
      try {
        const sales = await getEbaySales(candidate);
        if (Array.isArray(sales) && sales.length > 0) {
          chosenQuery = candidate;
          raw = sales;
          break;
        }
      } catch {
        // Try the next candidate if eBay search fails for this one.
      }
    }

    // 3. Get pricing
    const clean = cleanSalesData(raw);
    const valuation = calculateValue(clean);
    const salesSource = raw[0]?.source || null;
    const price = valuation?.average ?? null;

    res.json({
      detectedText: text,
      suggestedQuery: suggestedQuery || chosenQuery,
      query: chosenQuery,
      queryAttempts: queries,
      prediction,
      salesSource,
      price,
      comparables: clean.slice(0, 5),
      aiScanUsed: Boolean(pythonScan),
      valuation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
