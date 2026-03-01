/**
 * Advanced Recommendation Engine
 * Combines multiple ML/recommendation strategies:
 * - Similar-to-collection matching
 * - Collaborative filtering
 * - Trending boost
 * - Cold start logic
 * - ML ranking model
 * - Neural similarity matching
 */

import { db } from "./firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { getUserPreferenceProfile } from "./userAnalytics";

export interface CardItem {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string;
  seller?: string;
  createdAt?: Date;
  bids?: number;
  views?: number;
  rating?: number;
  tags?: string[];
  rarity?: string;
  condition?: string;
  yearIssued?: number;
}

export interface RecommendationResult {
  item: CardItem;
  score: number;
  reason: string;
  strategy: "collection" | "collaborative" | "trending" | "cold_start" | "neural" | "ranking";
  confidence: number;
}

export interface UserSimilarity {
  userId: string;
  similarity: number;
  sharedInterests: string[];
}

export interface RecommendationMetrics {
  diversityScore: number;
  personalizedScore: number;
  populariryScore: number;
  coldStartHandled: boolean;
  strategiesUsed: string[];
}

// ============================================================================
// 1. SIMILAR-TO-COLLECTION MATCHING
// ============================================================================

/**
 * Find items similar to user's collection
 * Analyzes collection characteristics and finds matching items
 */
async function similarToCollectionMatching(
  userId: string,
  userCards: CardItem[],
  allItems: CardItem[],
  limit = 10
): Promise<RecommendationResult[]> {
  if (userCards.length === 0) return [];

  // Extract collection characteristics
  const collectionCategories = new Map<string, number>();
  const collectionRarities = new Map<string, number>();
  const collectionYears = new Map<number, number>();

  userCards.forEach((card) => {
    collectionCategories.set(card.category, (collectionCategories.get(card.category) || 0) + 1);
    if (card.rarity) {
      collectionRarities.set(card.rarity, (collectionRarities.get(card.rarity) || 0) + 1);
    }
    if (card.yearIssued) {
      collectionYears.set(card.yearIssued, (collectionYears.get(card.yearIssued) || 0) + 1);
    }
  });

  // Score items based on collection characteristics
  const userCardIds = new Set(userCards.map((c) => c.id));
  const scored: RecommendationResult[] = [];

  for (const item of allItems) {
    if (userCardIds.has(item.id)) continue; // Skip items already owned

    let score = 0;
    let matchedFactors = 0;

    // Category match (weight: 0.4)
    const categoryMatch =
      (collectionCategories.get(item.category) || 0) / userCards.length;
    score += categoryMatch * 0.4;
    if (categoryMatch > 0) matchedFactors++;

    // Rarity match (weight: 0.3)
    if (item.rarity && collectionRarities.has(item.rarity)) {
      const rarityMatch =
        (collectionRarities.get(item.rarity) || 0) / userCards.length;
      score += rarityMatch * 0.3;
      matchedFactors++;
    }

    // Year proximity match (weight: 0.2)
    if (item.yearIssued) {
      const yearDistances = Array.from(collectionYears.keys()).map(
        (year) => Math.abs(year - item.yearIssued!)
      );
      const minDistance = Math.min(...yearDistances);
      const yearMatch = Math.max(0, 1 - minDistance / 50); // Normalize to 50-year window
      score += yearMatch * 0.2;
      matchedFactors++;
    }

    // Price proximity (weight: 0.1)
    const avgPrice =
      userCards.reduce((sum, c) => sum + c.price, 0) / userCards.length;
    const priceMatch = Math.max(0, 1 - Math.abs(item.price - avgPrice) / avgPrice);
    score += priceMatch * 0.1;

    if (matchedFactors > 0) {
      scored.push({
        item,
        score: Math.min(1, score),
        reason: `Matches your collection pattern (${item.category}, rarity: ${item.rarity || "unspecified"})`,
        strategy: "collection",
        confidence: matchedFactors / 3, // Normalize by expected factors
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ============================================================================
// 2. COLLABORATIVE FILTERING
// ============================================================================

/**
 * Find similar users and recommend items they like
 * User-based collaborative filtering
 */
async function collaborativeFiltering(
  userId: string,
  userPrefs: any,
  allItems: CardItem[],
  limit = 10
): Promise<RecommendationResult[]> {
  try {
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);

    // Find similar users based on preference overlap
    const similarUsers: UserSimilarity[] = [];

    for (const userDoc of usersSnap.docs) {
      if (userDoc.id === userId) continue;

      const otherUserData = userDoc.data();
      const otherPrefs = otherUserData.preferenceProfile || {};

      // Calculate similarity based on category preferences
      const ourCategories = new Set(userPrefs.topCategories?.map((c: any) => c.category) || []);
      const theirCategories = new Set(
        otherPrefs.topCategories?.map((c: any) => c.category) || []
      );

      const intersection = new Set(
        [...ourCategories].filter((x) => theirCategories.has(x))
      );
      const union = new Set([...ourCategories, ...theirCategories]);

      const jaccardSimilarity =
        union.size > 0 ? intersection.size / union.size : 0;
      const bidFrequencySimilarity = Math.max(
        0,
        1 - Math.abs(userPrefs.bidFrequency - otherPrefs.bidFrequency) / 100
      );

      const totalSimilarity = jaccardSimilarity * 0.6 + bidFrequencySimilarity * 0.4;

      if (totalSimilarity > 0.3) {
        similarUsers.push({
          userId: userDoc.id,
          similarity: totalSimilarity,
          sharedInterests: Array.from(intersection) as string[],
        });
      }
    }

    // Get items liked by similar users
    const recommendedByCollab = new Map<string, { score: number; userCount: number }>();

    for (const similar of similarUsers.sort((a, b) => b.similarity - a.similarity).slice(0, 5)) {
      const userInteractionsRef = collection(
        db,
        `users/${similar.userId}/interactions`
      );
      const interactionsSnap = await getDocs(userInteractionsRef);

      for (const interaction of interactionsSnap.docs) {
        const data = interaction.data();
        if (data.type === "bid" || data.type === "purchase") {
          const itemId = data.auctionId || data.itemId;
          if (itemId) {
            const current = recommendedByCollab.get(itemId) || {
              score: 0,
              userCount: 0,
            };
            current.score += similar.similarity;
            current.userCount += 1;
            recommendedByCollab.set(itemId, current);
          }
        }
      }
    }

    const results: RecommendationResult[] = [];
    for (const [itemId, stats] of recommendedByCollab.entries()) {
      const item = allItems.find((i) => i.id === itemId);
      if (item) {
        results.push({
          item,
          score: Math.min(1, stats.score / stats.userCount),
          reason: `${stats.userCount} similar collectors are interested in this`,
          strategy: "collaborative",
          confidence: Math.min(1, stats.userCount / 5),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch (error) {
    console.error("Collaborative filtering error:", error);
    return [];
  }
}

// ============================================================================
// 3. TRENDING BOOST
// ============================================================================

/**
 * Boost recommendations based on trending/popular items
 * Considers recent activity: views, bids, engagement
 */
async function trendingBoost(
  allItems: CardItem[],
  timeWindowDays = 7,
  limit = 10
): Promise<RecommendationResult[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - timeWindowDays);

  const scored: RecommendationResult[] = [];

  for (const item of allItems) {
    let trendScore = 0;

    // View momentum (weight: 0.4)
    const views = item.views || 0;
    const viewScore = Math.min(1, views / 1000); // Normalize to 1000 views
    trendScore += viewScore * 0.4;

    // Bid activity (weight: 0.35)
    const bids = item.bids || 0;
    const bidScore = Math.min(1, bids / 50); // Normalize to 50 bids
    trendScore += bidScore * 0.35;

    // Price momentum (weight: 0.15)
    // Items with moderate-to-high prices trending up
    const priceScore = item.price > 50 ? Math.min(1, item.price / 500) : 0.3;
    trendScore += priceScore * 0.15;

    // Recency (weight: 0.1)
    if (item.createdAt) {
      const ageInDays =
        (new Date().getTime() - new Date(item.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      const recencyScore =
        ageInDays <= timeWindowDays ? 1 - ageInDays / timeWindowDays : 0;
      trendScore += recencyScore * 0.1;
    }

    if (trendScore > 0.2) {
      scored.push({
        item,
        score: Math.min(1, trendScore),
        reason: `Trending: ${bids} bids, ${views} views in the last ${timeWindowDays} days`,
        strategy: "trending",
        confidence: Math.min(1, (views + bids) / 100),
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ============================================================================
// 4. COLD START LOGIC
// ============================================================================

/**
 * Handle recommendations for new users with little/no history
 * Uses broader category recommendations and trending items
 */
async function coldStartLogic(
  userPrefs: any,
  allItems: CardItem[],
  limit = 10
): Promise<RecommendationResult[]> {
  const results: RecommendationResult[] = [];

  // If user has no interactions, recommend by top categories
  if (!userPrefs.topCategories || userPrefs.topCategories.length === 0) {
    // Get most popular categories overall
    const categoryCount = new Map<string, number>();

    for (const item of allItems) {
      categoryCount.set(item.category, (categoryCount.get(item.category) || 0) + 1);
    }

    const topCats = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0]);

    // Recommend popular items from top categories
    for (const item of allItems) {
      if (topCats.includes(item.category)) {
        results.push({
          item,
          score: (item.bids || 0) / 100 + (item.views || 0) / 1000,
          reason: "Popular in this category for new collectors",
          strategy: "cold_start",
          confidence: 0.6,
        });
      }
    }
  } else {
    // User has some history, recommend adjacent categories
    const userCats = userPrefs.topCategories
      .slice(0, 3)
      .map((c: any) => c.category);

    for (const item of allItems) {
      if (userCats.includes(item.category)) {
        results.push({
          item,
          score: 0.7 + Math.random() * 0.2, // Add variance for discovery
          reason: `Based on your interest in ${item.category}`,
          strategy: "cold_start",
          confidence: 0.7,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ============================================================================
// 5. ML RANKING MODEL
// ============================================================================

/**
 * Unified ranking model combining multiple signals
 * Features: user affinity, popularity, price fit, rarity, condition
 */
function mlRankingModel(
  items: CardItem[],
  userPrefs: any,
  limit = 10
): RecommendationResult[] {
  const scored: RecommendationResult[] = [];

  for (const item of items) {
    // Feature engineering
    const features = {
      // User affinity (0-100)
      userAffinity: calculateUserAffinity(item, userPrefs),

      // Popularity score (0-100)
      popularity: calculatePopularity(item),

      // Price compatibility (0-100)
      priceCompat: calculatePriceCompatibility(item, userPrefs),

      // Rarity bonus (0-100)
      rarityBonus: calculateRarityBonus(item),

      // Condition premium (0-100)
      conditionPremium: calculateConditionPremium(item),

      // Category momentum (0-100)
      categoryMomentum: calculateCategoryMomentum(item, userPrefs),
    };

    // Weighted ensemble model
    const modelScore =
      features.userAffinity * 0.25 +
      features.popularity * 0.2 +
      features.priceCompat * 0.2 +
      features.rarityBonus * 0.15 +
      features.conditionPremium * 0.1 +
      features.categoryMomentum * 0.1;

    scored.push({
      item,
      score: Math.min(100, modelScore) / 100,
      reason: `ML rank: affinity=${features.userAffinity.toFixed(0)}, popularity=${features.popularity.toFixed(0)}, fit=${features.priceCompat.toFixed(0)}`,
      strategy: "ranking",
      confidence: 0.85,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ML Feature functions
function calculateUserAffinity(item: CardItem, userPrefs: any): number {
  if (!userPrefs.topCategories) return 50;

  const match = userPrefs.topCategories.find(
    (c: any) => c.category === item.category
  );
  return match ? match.affinity || 50 : 30;
}

function calculatePopularity(item: CardItem): number {
  const bidScore = Math.min(100, (item.bids || 0) / 50 * 100);
  const viewScore = Math.min(100, (item.views || 0) / 1000 * 100);
  return (bidScore * 0.6 + viewScore * 0.4) * 0.8;
}

function calculatePriceCompatibility(item: CardItem, userPrefs: any): number {
  if (!userPrefs.preferredPriceRange) return 50;

  const min = userPrefs.preferredPriceRange.min || 0;
  const max = userPrefs.preferredPriceRange.max || 1000;
  const avg = userPrefs.preferredPriceRange.avg || (min + max) / 2;

  if (item.price < min) return 30;
  if (item.price > max) return 40;

  const distance = Math.abs(item.price - avg);
  return Math.max(60, 100 - distance / (max - min) * 40);
}

function calculateRarityBonus(item: CardItem): number {
  const rarityMap: Record<string, number> = {
    common: 20,
    uncommon: 40,
    rare: 70,
    epic: 85,
    legendary: 100,
  };
  return rarityMap[item.rarity?.toLowerCase() || "common"] || 50;
}

function calculateConditionPremium(item: CardItem): number {
  const conditionMap: Record<string, number> = {
    poor: 20,
    fair: 40,
    good: 60,
    excellent: 80,
    mint: 100,
  };
  return conditionMap[item.condition?.toLowerCase() || "good"] || 60;
}

function calculateCategoryMomentum(item: CardItem, userPrefs: any): number {
  if (!userPrefs.topCategories) return 50;

  const categoryData = userPrefs.topCategories.find(
    (c: any) => c.category === item.category
  );
  if (!categoryData) return 30;

  // Momentum = recent interaction rate
  return Math.min(100, (categoryData.interactions || 5) / 10 * 100);
}

// ============================================================================
// 6. NEURAL SIMILARITY MATCHING
// ============================================================================

/**
 * Deep learning-inspired similarity matching
 * Embeds items in a feature space and calculates cosine similarity
 */
function neuralSimilarityMatching(
  referenceItems: CardItem[],
  candidateItems: CardItem[],
  userPrefs: any,
  limit = 10
): RecommendationResult[] {
  // Create embeddings for items
  const getEmbedding = (item: CardItem): number[] => {
    return [
      // Category one-hot encoding (simplified: hash)
      Math.sin(hashCode(item.category)) * 10,
      Math.cos(hashCode(item.category)) * 10,

      // Price embedding
      Math.log(item.price + 1) / 5,

      // Rarity embedding
      rarityToEmbedding(item.rarity),

      // Condition embedding
      conditionToEmbedding(item.condition),

      // Popularity embedding
      Math.log((item.bids || 1) + 1) / 5,
      Math.log((item.views || 1) + 1) / 10,

      // Year distance embedding
      item.yearIssued ? (item.yearIssued - 2000) / 50 : 0,
    ];
  };

  // Calculate average embedding of reference items
  const refEmbeddings = referenceItems.map((i) => getEmbedding(i));
  const avgRefEmbedding = refEmbeddings[0]
    ? refEmbeddings[0].map((_, idx) =>
        refEmbeddings.reduce((sum, e) => sum + e[idx], 0) /
        refEmbeddings.length
      )
    : new Array(8).fill(0);

  // Find similar candidates using cosine similarity
  const scored: RecommendationResult[] = [];

  for (const candidate of candidateItems) {
    // Skip if already in reference
    if (referenceItems.some((r) => r.id === candidate.id)) continue;

    const candEmbedding = getEmbedding(candidate);
    const similarity = cosineSimilarity(avgRefEmbedding, candEmbedding);

    if (similarity > 0.3) {
      scored.push({
        item: candidate,
        score: similarity,
        reason: `Neural match: ${similarity.toFixed(2)} similarity to your collection`,
        strategy: "neural",
        confidence: Math.min(1, similarity),
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Neural helper functions
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash / 2147483647; // Normalize
}

function rarityToEmbedding(rarity?: string): number {
  const map: Record<string, number> = {
    common: 0,
    uncommon: 2,
    rare: 4,
    epic: 6,
    legendary: 8,
  };
  return (map[rarity?.toLowerCase() || "common"] || 2) - 4; // Center around 0
}

function conditionToEmbedding(condition?: string): number {
  const map: Record<string, number> = {
    poor: 0,
    fair: 2,
    good: 4,
    excellent: 6,
    mint: 8,
  };
  return (map[condition?.toLowerCase() || "good"] || 4) - 4; // Center around 0
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Main recommendation engine
 * Combines all strategies and returns ranked recommendations
 */
export async function getRecommendations(
  userId: string,
  options: {
    limit?: number;
    strategies?: string[];
    userCards?: CardItem[];
    allItems?: CardItem[];
  } = {}
): Promise<{
  recommendations: RecommendationResult[];
  metrics: RecommendationMetrics;
}> {
  const limit = options.limit || 20;
  const allStrategies = [
    "collection",
    "collaborative",
    "trending",
    "cold_start",
    "ranking",
    "neural",
  ];
  const strategies = options.strategies || allStrategies;

  // Get user data
  const userPrefs = await getUserPreferenceProfile(userId);
  const userCards = options.userCards || [];
  const allItems = options.allItems || [];

  if (allItems.length === 0) {
    console.warn("No items available for recommendations");
    return {
      recommendations: [],
      metrics: {
        diversityScore: 0,
        personalizedScore: 0,
        populariryScore: 0,
        coldStartHandled: false,
        strategiesUsed: [],
      },
    };
  }

  const allRecommendations: RecommendationResult[] = [];
  const usedStrategies = new Set<string>();

  // Run enabled strategies
  if (
    strategies.includes("collection") &&
    userCards.length > 0
  ) {
    const results = await similarToCollectionMatching(
      userId,
      userCards,
      allItems,
      limit / 2
    );
    allRecommendations.push(...results);
    usedStrategies.add("collection");
  }

  if (strategies.includes("collaborative")) {
    const results = await collaborativeFiltering(
      userId,
      userPrefs,
      allItems,
      limit / 2
    );
    allRecommendations.push(...results);
    usedStrategies.add("collaborative");
  }

  if (strategies.includes("trending")) {
    const results = await trendingBoost(allItems, 7, limit / 2);
    allRecommendations.push(...results);
    usedStrategies.add("trending");
  }

  if (strategies.includes("cold_start")) {
    const results = await coldStartLogic(userPrefs, allItems, limit / 2);
    allRecommendations.push(...results);
    usedStrategies.add("cold_start");
  }

  if (strategies.includes("ranking")) {
    const results = mlRankingModel(allItems, userPrefs, limit / 2);
    allRecommendations.push(...results);
    usedStrategies.add("ranking");
  }

  if (strategies.includes("neural") && userCards.length > 0) {
    const results = neuralSimilarityMatching(
      userCards,
      allItems,
      userPrefs,
      limit / 2
    );
    allRecommendations.push(...results);
    usedStrategies.add("neural");
  }

  // Deduplicate and re-rank
  const itemMap = new Map<string, RecommendationResult>();
  for (const rec of allRecommendations) {
    const existing = itemMap.get(rec.item.id);
    if (!existing) {
      itemMap.set(rec.item.id, rec);
    } else {
      // Combine scores from multiple strategies
      existing.score = (existing.score + rec.score) / 2;
      if (!existing.reason.includes(rec.reason)) {
        existing.reason += `; ${rec.reason}`;
      }
      existing.confidence = Math.max(existing.confidence, rec.confidence);
    }
  }

  const final = Array.from(itemMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Calculate metrics
  const strategyDistribution = new Map<string, number>();
  for (const rec of final) {
    strategyDistribution.set(
      rec.strategy,
      (strategyDistribution.get(rec.strategy) || 0) + 1
    );
  }

  const categoryCount = new Map<string, number>();
  final.forEach((r) => {
    categoryCount.set(
      r.item.category,
      (categoryCount.get(r.item.category) || 0) + 1
    );
  });

  const diversityScore =
    categoryCount.size > 0 ? Math.min(1, categoryCount.size / 8) : 0; // 0-1
  const personalizedScore =
    (allRecommendations.filter((r) => r.strategy === "collection" || r.strategy === "collaborative").length /
      allRecommendations.length) || 0;
  const popularityScore = final.reduce((sum, r) => sum + (r.confidence || 0), 0) / final.length || 0;

  return {
    recommendations: final,
    metrics: {
      diversityScore: Math.round(diversityScore * 100) / 100,
      personalizedScore: Math.round(personalizedScore * 100) / 100,
      populariryScore: Math.round(popularityScore * 100) / 100,
      coldStartHandled: usedStrategies.has("cold_start"),
      strategiesUsed: Array.from(usedStrategies),
    },
  };
}

/**
 * Get recommendations for a specific item (similar items)
 */
export async function getItemSimilarities(
  item: CardItem,
  allItems: CardItem[],
  limit = 5
): Promise<RecommendationResult[]> {
  // Use neural similarity as the primary method
  return neuralSimilarityMatching([item], allItems, {}, limit);
}

/**
 * Explain why an item was recommended
 */
export function explainRecommendation(rec: RecommendationResult): string {
  return `${rec.reason} (Confidence: ${(rec.confidence * 100).toFixed(0)}%)`;
}
