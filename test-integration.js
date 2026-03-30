/**
 * Integration Test Suite for Card Scanner Microservices
 * 
 * Tests:
 * 1. AI Service: Image → OCR text
 * 2. Matching Engine: OCR text → Card identification
 * 3. Pricing Engine: Card → Price estimate
 * 4. Full Pipeline: Image → Complete result
 */

const fs = require("fs");
const path = require("path");

// Service URLs
const AI_SERVICE = "http://localhost:8000";
const MATCHING_ENGINE = "http://localhost:3001";
const PIPELINE = "http://localhost:3000/api/scan-pipeline";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(color, label, message) {
  console.log(`${color}[${label}]${colors.reset} ${message}`);
}

async function testServiceHealth() {
  log(colors.blue, "TEST", "Checking service health...");

  try {
    const aiHealth = await fetch(`${AI_SERVICE}/health`).then(r => r.json());
    log(colors.green, "✓ AI Service", "Healthy");

    const matchingHealth = await fetch(`${MATCHING_ENGINE}/health`).then(r =>
      r.json()
    );
    log(
      colors.green,
      "✓ Matching Engine",
      `Healthy (${matchingHealth.cardsLoaded} cards loaded)`
    );

    return true;
  } catch (error) {
    log(colors.red, "✗ Health Check", error.message);
    return false;
  }
}

async function testAIService(imagePath) {
  log(colors.blue, "TEST", "Testing AI Service...");

  if (!fs.existsSync(imagePath)) {
    log(colors.yellow, "⚠ AI Service", `Image not found: ${imagePath}`);
    return null;
  }

  try {
    const file = fs.readFileSync(imagePath);
    const blob = new Blob([file], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", blob);

    const response = await fetch(`${AI_SERVICE}/scan`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      log(colors.green, "✓ AI Service", "Scan successful");
      log(colors.cyan, "  - Detected", result.detected ? "Yes" : "No");
      log(colors.cyan, "  - Text Length", result.text.length);
      log(colors.cyan, "  - Detections", result.detections.length);
      log(colors.cyan, "  - Confidence", result.confidence.toFixed(2));
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    log(colors.red, "✗ AI Service", error.message);
    return null;
  }
}

async function testMatchingEngine(text, gameType = "pokemon") {
  log(colors.blue, "TEST", "Testing Matching Engine...");

  try {
    const response = await fetch(`${MATCHING_ENGINE}/identify-multi-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        gameType,
        yoloDetections: []
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      log(colors.green, "✓ Matching Engine", "Identification successful");
      log(colors.cyan, "  - Card", result.card.name);
      log(colors.cyan, "  - Confidence", result.confidence.toFixed(3));
      log(colors.cyan, "  - Auto Selected", result.autoSelected ? "Yes" : "No");
      return result;
    } else {
      log(colors.yellow, "⚠ Matching Engine", "No matches found");
      return null;
    }
  } catch (error) {
    log(colors.red, "✗ Matching Engine", error.message);
    return null;
  }
}

async function testPricingEngine(card, gameType = "pokemon") {
  log(colors.blue, "TEST", "Testing Pricing Engine...");

  try {
    const response = await fetch(`${MATCHING_ENGINE}/pricing/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card, gameType })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      log(colors.green, "✓ Pricing Engine", `Price fetched: $${result.estimatedPrice}`);
      log(colors.cyan, "  - Source", result.source);
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    log(colors.red, "✗ Pricing Engine", error.message);
    return null;
  }
}

async function testFullPipeline(imagePath, gameType) {
  log(colors.blue, "TEST", "Testing Full Pipeline...");

  if (!fs.existsSync(imagePath)) {
    log(colors.yellow, "⚠ Pipeline", `Image not found: ${imagePath}`);
    return null;
  }

  try {
    const file = fs.readFileSync(imagePath);
    const blob = new Blob([file], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", blob);

    const url = new URL(PIPELINE);
    if (gameType) {
      url.searchParams.append("gameType", gameType);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      log(colors.green, "✓ Full Pipeline", "Scan successful");
      log(colors.cyan, "  - Card", result.result.cardName);
      log(colors.cyan, "  - Confidence", result.result.confidence.toFixed(3));
      log(colors.cyan, "  - Price", `$${result.result.estimatedPrice}`);
      log(colors.cyan, "  - Source", result.result.priceSource);
      log(colors.cyan, "  - Total Time", `${result.timing.total}ms`);
      log(
        colors.cyan,
        "  - Breakdown",
        `AI:${result.timing.aiService}ms, Match:${result.timing.matching}ms, Price:${result.timing.pricing}ms`
      );
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    log(colors.red, "✗ Full Pipeline", error.message);
    return null;
  }
}

// Test data for manual testing
async function testWithMockData() {
  log(colors.blue, "TEST", "Testing with mock data...");
  console.log("");

  // Test 1: Direct text to matching
  log(colors.blue, "1.", "Text matching: 'pikachu pokemon 25 base set'");
  await testMatchingEngine("pikachu pokemon 25 base set", "pokemon");
  console.log("");

  // Test 2: Direct text to matching (Yu-Gi-Oh)
  log(colors.blue, "2.", "Text matching: 'blue eyes white dragon'");
  await testMatchingEngine("blue eyes white dragon", "yugioh");
  console.log("");

  // Test 3: Pricing for card
  log(colors.blue, "3.", "Pricing: Pikachu card");
  const pikachuCard = {
    id: "pikachu-base-4",
    name: "Pikachu",
    player: "Pikachu",
    team: "Pokemon TCG",
    cardNumber: "25",
    year: 1999,
    set: "Base Set",
    rarity: "common",
    game: "pokemon",
    price: 15.5
  };
  await testPricingEngine(pikachuCard, "pokemon");
  console.log("");

  return true;
}

// Main test runner
async function runAllTests(imagePath = null) {
  console.log("");
  console.log(`${colors.cyan}${"=".repeat(60)}`);
  console.log(`${colors.cyan}  Card Scanner Microservices - Integration Tests`);
  console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log("");

  // Test 1: Service Health
  const healthy = await testServiceHealth();
  if (!healthy) {
    console.log("");
    log(
      colors.red,
      "ERROR",
      "Services not available. Start them with: npm run start-services"
    );
    return;
  }
  console.log("");

  // Test 2: Mock data tests
  await testWithMockData();

  // Test 3: Real image test (if provided)
  if (imagePath) {
    log(colors.blue, "TEST", `Testing with real image: ${imagePath}`);
    console.log("");

    const aiResult = await testAIService(imagePath);
    if (aiResult) {
      console.log("");
      const matchResult = await testMatchingEngine(aiResult.text);
      if (matchResult && matchResult.card) {
        console.log("");
        await testPricingEngine(matchResult.card);
      }
    }
    console.log("");

    log(colors.blue, "TEST", "Testing full pipeline...");
    console.log("");
    await testFullPipeline(imagePath);
  }

  console.log("");
  console.log(`${colors.cyan}${"=".repeat(60)}`);
  console.log(`${colors.cyan}  All tests complete!${colors.reset}`);
  console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log("");
}

// Run tests
const imagePath = process.argv[2]; // Optional: image path as first argument
runAllTests(imagePath).catch(error => {
  log(colors.red, "FATAL", error.message);
  process.exit(1);
});
