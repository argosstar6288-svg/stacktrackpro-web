import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";

interface SearchResult {
  catalogId: string;
  name: string;
  game: string;
  set: any;
  cardNumber?: string;
  rarity?: string;
  images: {
    small: string | null;
    large: string | null;
  };
  relevanceScore: number;
}

// CORS headers
function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return corsResponse({}, 200);
}

/**
 * Unified search across all card catalogs
 * GET /api/catalog/search?q=pikachu&game=pokemon&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q");
    const gameFilter = searchParams.get("game"); // pokemon, magic, yugioh, sports
    const setFilter = searchParams.get("set");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!searchQuery || searchQuery.length < 2) {
      return corsResponse({ error: "Search query must be at least 2 characters" }, 400);
    }

    console.log(`[Catalog Search] Query: "${searchQuery}", Game: ${gameFilter || "all"}, Limit: ${limit}`);

    const results: SearchResult[] = [];
    const searchTermLower = searchQuery.toLowerCase();

    // Determine which games to search
    const gamesToSearch = gameFilter 
      ? [gameFilter.toLowerCase()]
      : ['pokemon', 'magic', 'yugioh', 'sports'];

    // Search each game catalog
    for (const game of gamesToSearch) {
      try {
        const gameResults = await searchGameCatalog(game, searchTermLower, setFilter, limit);
        results.push(...gameResults);
      } catch (error) {
        console.error(`[Catalog Search] Error searching ${game}:`, error);
        // Continue searching other catalogs even if one fails
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit total results
    const limitedResults = results.slice(0, limit);

    console.log(`[Catalog Search] Found ${limitedResults.length} results`);

    return corsResponse({
      query: searchQuery,
      results: limitedResults,
      totalFound: limitedResults.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Catalog Search] Error:", error);
    return corsResponse(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

/**
 * Search a specific game catalog
 */
async function searchGameCatalog(
  game: string,
  searchTerm: string,
  setFilter: string | null,
  maxResults: number
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    // Reference to game's card collection
    const cardsRef = collection(db, "cardCatalog", game, "cards");

    // Firestore doesn't support full-text search, so we'll use array-contains for searchTerms
    // In production, you'd use Algolia, Typesense, or ElasticSearch for better search

    // Try exact match first
    const exactQuery = query(
      cardsRef,
      where("searchTerms", "array-contains", searchTerm),
      firestoreLimit(maxResults)
    );

    const exactSnapshot = await getDocs(exactQuery);

    for (const doc of exactSnapshot.docs) {
      const data = doc.data();
      
      // Apply set filter if provided
      if (setFilter) {
        const cardSet = data.set?.id || data.set?.code || data.set?.name || "";
        if (!cardSet.toLowerCase().includes(setFilter.toLowerCase())) {
          continue;
        }
      }

      // Calculate relevance score
      const relevanceScore = calculateRelevance(data.name, searchTerm, data);

      results.push({
        catalogId: data.catalogId || doc.id,
        name: data.name,
        game: data.game,
        set: data.set,
        cardNumber: data.cardNumber,
        rarity: data.rarity,
        images: data.images || { small: null, large: null },
        relevanceScore,
      });
    }

    // If no exact matches, try partial matches
    if (results.length === 0) {
      // Get all cards and filter client-side (not ideal for large datasets)
      // In production, use a proper search engine
      const partialQuery = query(cardsRef, firestoreLimit(500));
      const partialSnapshot = await getDocs(partialQuery);

      for (const doc of partialSnapshot.docs) {
        const data = doc.data();
        const name = data.name?.toLowerCase() || "";
        
        // Check if name contains search term
        if (name.includes(searchTerm)) {
          // Apply set filter
          if (setFilter) {
            const cardSet = data.set?.id || data.set?.code || data.set?.name || "";
            if (!cardSet.toLowerCase().includes(setFilter.toLowerCase())) {
              continue;
            }
          }

          const relevanceScore = calculateRelevance(data.name, searchTerm, data);

          results.push({
            catalogId: data.catalogId || doc.id,
            name: data.name,
            game: data.game,
            set: data.set,
            cardNumber: data.cardNumber,
            rarity: data.rarity,
            images: data.images || { small: null, large: null },
            relevanceScore,
          });

          if (results.length >= maxResults) break;
        }
      }
    }

  } catch (error) {
    console.error(`Error searching ${game} catalog:`, error);
  }

  return results;
}

/**
 * Calculate relevance score for search result
 */
function calculateRelevance(cardName: string, searchTerm: string, cardData: any): number {
  let score = 0;
  const nameLower = cardName.toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  // Exact match
  if (nameLower === searchLower) {
    score += 100;
  }

  // Starts with search term
  if (nameLower.startsWith(searchLower)) {
    score += 50;
  }

  // Contains search term
  if (nameLower.includes(searchLower)) {
    score += 25;
  }

  // Bonus for rarer cards
  const rarity = cardData.rarity?.toLowerCase() || "";
  if (rarity.includes("rare") || rarity.includes("legendary")) {
    score += 10;
  }
  if (rarity.includes("mythic") || rarity.includes("secret")) {
    score += 15;
  }

  // Bonus for having images
  if (cardData.images?.large) {
    score += 5;
  }

  return score;
}
