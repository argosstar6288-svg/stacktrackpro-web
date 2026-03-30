const axios = require("axios");
require("dotenv").config();

/**
 * Pricing Engine
 * Handles price calculations from eBay sold listings and PriceCharting
 */

/**
 * Fetch sold listings from eBay
 * Requires EBAY_TOKEN environment variable
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of sold items with prices
 */
async function getEbaySales(query) {
  try {
    const ebayToken = process.env.EBAY_TOKEN;
    
    if (!ebayToken) {
      console.warn("EBAY_TOKEN not configured, skipping eBay pricing");
      return [];
    }

    const response = await axios.get(
      "https://api.ebay.com/buy/browse/v1/item_summary/search",
      {
        headers: {
          Authorization: `Bearer ${ebayToken}`,
          "Content-Type": "application/json"
        },
        params: {
          q: query,
          filter: "soldItems:true",
          limit: 100,
          sort: "-endDate"
        },
        timeout: 5000
      }
    );

    if (!response.data || !response.data.itemSummaries) {
      return [];
    }

    return response.data.itemSummaries
      .filter(item => item.currentBidAmount)
      .map(item => ({
        title: item.title,
        price: parseFloat(item.currentBidAmount.value),
        condition: item.condition,
        endDate: item.itemEnd,
        url: item.itemWebUrl
      }))
      .filter(item => item.price > 0 && item.price < 100000); // Filter unrealistic prices
  } catch (error) {
    console.error("eBay API error:", error.message);
    return [];
  }
}

/**
 * Fetch price from PriceCharting API
 * Requires PRICECHARTING_TOKEN environment variable
 * @param {string} gameName - Game name (pokemon, magic, yugioh, sports)
 * @param {string} cardName - Card name
 * @returns {Promise<number|null>} Price or null if not found
 */
async function getPriceChartingPrice(gameName, cardName) {
  try {
    const token = process.env.PRICECHARTING_TOKEN;
    
    if (!token) {
      return null;
    }

    const response = await axios.get(
      "https://api.pricecharting.com/search",
      {
        params: {
          q: `${cardName} ${gameName}`,
          api_token: token
        },
        timeout: 5000
      }
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    return response.data[0].price;
  } catch (error) {
    console.error("PriceCharting API error:", error.message);
    return null;
  }
}

/**
 * Calculate median price from array of prices
 * Removes outliers (top/bottom 10%)
 * @param {Array<number>} prices - Array of prices
 * @returns {number} Median price
 */
function calculateMedianPrice(prices) {
  if (prices.length === 0) {
    return 0;
  }

  // Sort prices
  const sorted = prices.sort((a, b) => a - b);

  // Remove outliers (top and bottom 10%)
  const startIdx = Math.max(0, Math.floor(sorted.length * 0.1));
  const endIdx = Math.min(sorted.length, Math.ceil(sorted.length * 0.9));
  const trimmed = sorted.slice(startIdx, endIdx);

  if (trimmed.length === 0) {
    return sorted[0];
  }

  // Calculate median
  const mid = Math.floor(trimmed.length / 2);
  if (trimmed.length % 2 === 0) {
    return (trimmed[mid - 1] + trimmed[mid]) / 2;
  }
  return trimmed[mid];
}

/**
 * Calculate statistics from price array
 * @param {Array<number>} prices - Array of prices
 * @returns {Object} Price statistics
 */
function calculatePriceStats(prices) {
  if (prices.length === 0) {
    return {
      median: 0,
      average: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      count: 0
    };
  }

  const sorted = prices.sort((a, b) => a - b);
  
  // Trimmed average (remove top/bottom 10%)
  const startIdx = Math.max(0, Math.floor(sorted.length * 0.1));
  const endIdx = Math.min(sorted.length, Math.ceil(sorted.length * 0.9));
  const trimmed = sorted.slice(startIdx, endIdx);

  const sum = trimmed.reduce((a, b) => a + b, 0);
  const average = sum / trimmed.length;

  // Standard deviation
  const squareDiffs = trimmed.map(value => Math.pow(value - average, 2));
  const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / trimmed.length);

  // Median
  const mid = Math.floor(trimmed.length / 2);
  const median = trimmed.length % 2 === 0 
    ? (trimmed[mid - 1] + trimmed[mid]) / 2 
    : trimmed[mid];

  return {
    median: parseFloat(median.toFixed(2)),
    average: parseFloat(average.toFixed(2)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev: parseFloat(stdDev.toFixed(2)),
    count: sorted.length,
    trimmedCount: trimmed.length
  };
}

/**
 * Get estimated price for a card
 * Combines eBay sold listings, PriceCharting, and catalog default
 * @param {Object} card - Card object
 * @param {string} gameType - Game type (pokemon, sports, magic, yugioh)
 * @returns {Promise<Object>} Price estimate with details
 */
async function estimateCardPrice(card, gameType) {
  try {
    const cardName = card.name || "";
    
    // Fetch from both sources in parallel
    const [ebaySales, pricechartingPrice] = await Promise.all([
      getEbaySales(cardName),
      getPriceChartingPrice(gameType, cardName)
    ]);

    const ebaySalePrices = ebaySales.map(s => s.price);
    const stats = calculatePriceStats(ebaySalePrices);

    // Determine final price
    let finalPrice = card.price || 0; // Fallback to catalog price
    let source = "catalog";

    if (pricechartingPrice) {
      finalPrice = pricechartingPrice;
      source = "pricecharting";
    } else if (stats.median > 0) {
      finalPrice = stats.median;
      source = "ebay_median";
    }

    return {
      success: true,
      card: cardName,
      estimatedPrice: parseFloat(finalPrice.toFixed(2)),
      source,
      sources: {
        ebay: {
          found: ebaySales.length,
          prices: stats,
          recentSales: ebaySales.slice(0, 5)
        },
        pricecharting: {
          found: pricechartingPrice ? 1 : 0,
          price: pricechartingPrice
        },
        catalog: {
          price: card.price || 0
        }
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Price estimation error:", error);
    return {
      success: false,
      error: error.message,
      card: card.name,
      estimatedPrice: card.price || 0,
      source: "catalog",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get bulk price estimates for multiple cards
 * @param {Array} cards - Array of card objects
 * @param {string} gameType - Game type
 * @returns {Promise<Array>} Array of price estimates
 */
async function estimateCardsPrices(cards, gameType) {
  return Promise.all(
    cards.map(card => estimateCardPrice(card, gameType))
  );
}

module.exports = {
  getEbaySales,
  getPriceChartingPrice,
  calculateMedianPrice,
  calculatePriceStats,
  estimateCardPrice,
  estimateCardsPrices
};
