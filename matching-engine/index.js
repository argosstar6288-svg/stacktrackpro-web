const express = require("express");
const Fuse = require("fuse.js");
const axios = require("axios");
const cors = require("cors");
const { estimateCardPrice } = require("./pricing");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock card database - in production, load from Firebase/database
let cardsDatabase = [];

// Initialize cards from local JSON or database
async function initializeCards() {
  try {
    // Try to load from cards.json first
    const fs = require("fs");
    const path = require("path");
    
    if (fs.existsSync(path.join(__dirname, "cards.json"))) {
      const data = fs.readFileSync(path.join(__dirname, "cards.json"), "utf-8");
      cardsDatabase = JSON.parse(data);
      console.log(`Loaded ${cardsDatabase.length} cards from cards.json`);
    } else {
      console.log("cards.json not found, using empty database. API will return no matches.");
    }
  } catch (error) {
    console.error("Error loading cards:", error);
  }
}

// Initialize Fuse search index
function buildFuseIndex() {
  return new Fuse(cardsDatabase, {
    keys: [
      { name: "name", weight: 0.4 },
      { name: "player", weight: 0.2 },
      { name: "team", weight: 0.15 },
      { name: "cardNumber", weight: 0.15 },
      { name: "set", weight: 0.1 }
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    shouldSort: true
  });
}

let fuseIndex = null;

// Routes

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Card Matching Engine",
    cardsLoaded: cardsDatabase.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * Identify a card from OCR text
 * POST /identify
 * Body: { text: string, gameType?: "pokemon" | "sports" | "magic" | "yugioh" }
 * Returns: { success: bool, card?: object, matches?: array, confidence?: number }
 */
app.post("/identify", (req, res) => {
  try {
    const { text, gameType } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Text is required"
      });
    }

    // Clean input
    const cleanText = text.toLowerCase().trim();

    // Filter cards by game type if specified
    let searchPool = cardsDatabase;
    if (gameType) {
      searchPool = cardsDatabase.filter(card => 
        (card.game || "").toLowerCase() === gameType.toLowerCase()
      );
    }

    if (searchPool.length === 0) {
      return res.json({
        success: false,
        message: "No cards available" + (gameType ? ` for game: ${gameType}` : ""),
        cardsSearched: 0
      });
    }

    // Search with Fuse
    const fuse = new Fuse(searchPool, {
      keys: [
        { name: "name", weight: 0.4 },
        { name: "player", weight: 0.2 },
        { name: "team", weight: 0.15 },
        { name: "cardNumber", weight: 0.15 },
        { name: "set", weight: 0.1 }
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
      shouldSort: true
    });

    const results = fuse.search(cleanText, { limit: 5 });

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "No matches found",
        cardsSearched: searchPool.length,
        text: cleanText
      });
    }

    // Calculate confidence (inverse of Fuse score)
    const topMatch = results[0];
    const confidence = Math.max(0.35, Math.min(1.0, 1 - topMatch.score));
    const autoSelect = confidence >= 0.75;

    return res.json({
      success: true,
      card: topMatch.item,
      confidence: parseFloat(confidence.toFixed(3)),
      autoSelected: autoSelect,
      allMatches: results.map((r, idx) => ({
        index: idx,
        name: r.item.name,
        confidence: parseFloat((1 - r.score).toFixed(3)),
        score: parseFloat(r.score.toFixed(3))
      })),
      cardsSearched: searchPool.length,
      text: cleanText
    });
  } catch (error) {
    console.error("Identify error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Multi-signal matching (OCR text + YOLO classification)
 * POST /identify-multi-signal
 * Body: {
 *   text: string,
 *   yoloDetections?: array,
 *   imageFeatures?: object,
 *   gameType?: string
 * }
 */
app.post("/identify-multi-signal", (req, res) => {
  try {
    const { text, yoloDetections = [], imageFeatures = {}, gameType } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Text is required"
      });
    }

    const cleanText = text.toLowerCase().trim();

    // Filter by game type if specified
    let searchPool = cardsDatabase;
    if (gameType) {
      searchPool = cardsDatabase.filter(card => 
        (card.game || "").toLowerCase() === gameType.toLowerCase()
      );
    }

    if (searchPool.length === 0) {
      return res.json({
        success: false,
        message: "No cards available",
        cardsSearched: 0
      });
    }

    // Fuse search
    const fuse = new Fuse(searchPool, {
      keys: [
        { name: "name", weight: 0.4 },
        { name: "player", weight: 0.2 },
        { name: "team", weight: 0.15 },
        { name: "cardNumber", weight: 0.15 },
        { name: "set", weight: 0.1 }
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
      shouldSort: true
    });

    const results = fuse.search(cleanText, { limit: 5 });

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "No text matches found",
        cardsSearched: searchPool.length,
        signals: {
          textMatches: 0,
          yoloDetections: yoloDetections.length
        }
      });
    }

    // Multi-signal scoring
    const topMatch = results[0];
    let textConfidence = Math.max(0.35, Math.min(1.0, 1 - topMatch.score));

    // YOLO confidence boost (if available)
    let yoloConfidence = 0;
    if (yoloDetections && yoloDetections.length > 0) {
      yoloConfidence = Math.max(...yoloDetections.map(d => d.confidence || 0));
    }

    // Weighted combination
    const weights = {
      text: 0.6,      // 60% text matching
      yolo: 0.25,     // 25% YOLO detection
      image: 0.15     // 15% image features (placeholder)
    };

    const finalConfidence = 
      (textConfidence * weights.text) +
      (yoloConfidence * weights.yolo);

    const autoSelect = finalConfidence >= 0.72;

    return res.json({
      success: true,
      card: topMatch.item,
      confidence: parseFloat(finalConfidence.toFixed(3)),
      autoSelected: autoSelect,
      signals: {
        textMatches: results.length,
        textConfidence: parseFloat(textConfidence.toFixed(3)),
        yoloDetections: yoloDetections.length,
        yoloConfidence: parseFloat(yoloConfidence.toFixed(3)),
        weights
      },
      alternativeMatches: results.slice(1, 3).map((r, idx) => ({
        index: idx + 1,
        name: r.item.name,
        confidence: parseFloat((1 - r.score).toFixed(3))
      })),
      cardsSearched: searchPool.length
    });
  } catch (error) {
    console.error("Multi-signal identify error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get cards by filter
 * GET /cards?game=pokemon&search=pikachu&limit=10
 */
app.get("/cards", (req, res) => {
  try {
    const { game, search, limit = 50 } = req.query;

    let results = cardsDatabase;

    if (game) {
      results = results.filter(card => 
        (card.game || "").toLowerCase() === game.toLowerCase()
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(card => 
        (card.name || "").toLowerCase().includes(searchLower) ||
        (card.player || "").toLowerCase().includes(searchLower) ||
        (card.team || "").toLowerCase().includes(searchLower)
      );
    }

    results = results.slice(0, parseInt(limit));

    return res.json({
      success: true,
      count: results.length,
      total: cardsDatabase.length,
      cards: results
    });
  } catch (error) {
    console.error("Get cards error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get card by ID
 * GET /cards/:id
 */
app.get("/cards/:id", (req, res) => {
  try {
    const { id } = req.params;
    const card = cardsDatabase.find(c => c.id === id);

    if (!card) {
      return res.status(404).json({
        success: false,
        error: "Card not found"
      });
    }

    return res.json({
      success: true,
      card
    });
  } catch (error) {
    console.error("Get card error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Service info
 */
app.get("/info", (req, res) => {
  res.json({
    name: "Card Matching Engine",
    version: "1.0.0",
    endpoints: [
      "GET /health - Health check",
      "POST /identify - Identify card from OCR text",
      "POST /identify-multi-signal - Multi-signal identification",
      "GET /cards - Get cards by filter",
      "GET /cards/:id - Get card by ID",
      "POST /pricing/estimate - Estimate card price",
      "GET /info - Service information"
    ],
    algorithms: {
      textMatching: "Fuse.js with customizable keys",
      threshold: 0.4,
      autoSelectThreshold: 0.75
    },
    supportedGames: ["pokemon", "sports", "magic", "yugioh"],
    cardsLoaded: cardsDatabase.length
  });
});

/**
 * Estimate card price
 * POST /pricing/estimate
 * Body: { card: object, gameType: string }
 */
app.post("/pricing/estimate", async (req, res) => {
  try {
    const { card, gameType } = req.body;

    if (!card || !card.name) {
      return res.status(400).json({
        success: false,
        error: "Card object with name is required"
      });
    }

    const estimate = await estimateCardPrice(card, gameType || "pokemon");
    res.json(estimate);
  } catch (error) {
    console.error("Pricing estimate error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

// Initialize and start server
initializeCards().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Card Matching Engine running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Cards loaded: ${cardsDatabase.length}`);
  });
}).catch(error => {
  console.error("Failed to initialize:", error);
  process.exit(1);
});

module.exports = app;
