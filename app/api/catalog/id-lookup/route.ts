import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { generateStackTrackId, parseStackTrackId } from "@/lib/universal-card-id";

/**
 * ID Lookup and Mapping API
 * 
 * Endpoints:
 * - GET /api/catalog/id-lookup?stacktrackId=STK-NBA-... => Get card by StackTrack ID
 * - POST /api/catalog/id-lookup/generate => Generate StackTrack ID from card data
 * - GET /api/catalog/id-lookup/search?name=...&year=... => Find matching StackTrack ID
 */

// CORS headers
function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return corsResponse({}, 200);
}

/**
 * GET: Lookup card by stacktrackId
 * Query params: stacktrackId, catalogId, externalId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stacktrackId = searchParams.get("stacktrackId");
    const catalogId = searchParams.get("catalogId");
    const externalId = searchParams.get("externalId");
    const name = searchParams.get("name");
    const year = searchParams.get("year");
    const set = searchParams.get("set");
    
    // Lookup by StackTrack ID
    if (stacktrackId) {
      const card = await findCardByStackTrackId(stacktrackId);
      if (card) {
        return corsResponse({ found: true, card });
      }
      return corsResponse({ found: false, stacktrackId }, 404);
    }
    
    // Lookup by external catalog ID
    if (catalogId) {
      const card = await findCardByCatalogId(catalogId);
      if (card) {
        return corsResponse({ found: true, card });
      }
      return corsResponse({ found: false, catalogId }, 404);
    }
    
    // Search by card attributes
    if (name) {
      const cards = await searchCardsByAttributes(name, year, set);
      return corsResponse({ found: cards.length > 0, cards, count: cards.length });
    }
    
    return corsResponse({ error: "Missing search parameters" }, 400);
    
  } catch (error) {
    console.error("[ID Lookup] GET error:", error);
    return corsResponse(
      {
        error: "Lookup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

/**
 * POST: Generate StackTrack ID from card data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardData, checkExists } = body;
    
    if (!cardData) {
      return corsResponse({ error: "cardData is required" }, 400);
    }
    
    // Generate StackTrack ID
    const stacktrackId = generateStackTrackId(cardData);
    
    // Optionally check if ID already exists
    if (checkExists) {
      const existingCard = await findCardByStackTrackId(stacktrackId);
      return corsResponse({
        stacktrackId,
        exists: !!existingCard,
        card: existingCard || null,
      });
    }
    
    return corsResponse({ stacktrackId });
    
  } catch (error) {
    console.error("[ID Lookup] POST error:", error);
    return corsResponse(
      {
        error: "Generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

/**
 * Find card by StackTrack ID across all game catalogs
 */
async function findCardByStackTrackId(stacktrackId: string): Promise<any | null> {
  try {
    // Parse ID to determine which catalog to search
    const parsed = parseStackTrackId(stacktrackId);
    if (!parsed) {
      return null;
    }
    
    // Search appropriate catalog
    const gameMap: { [key: string]: string } = {
      POKEMON: "pokemon",
      MAGIC: "magic",
      YUGIOH: "yugioh",
      BASEBALL: "sports",
      BASKETBALL: "sports",
      FOOTBALL: "sports",
      HOCKEY: "sports",
      SOCCER: "sports",
    };
    
    const game = gameMap[parsed.game] || "pokemon";
    const cardsRef = collection(db, "cardCatalog", game, "cards");
    const q = query(cardsRef, where("stacktrackId", "==", stacktrackId), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        catalogId: doc.id,
        ...doc.data(),
      };
    }
    
    return null;
  } catch (error) {
    console.error("[findCardByStackTrackId] Error:", error);
    return null;
  }
}

/**
 * Find card by external catalog ID (Pokemon TCG ID, Scryfall ID, etc.)
 */
async function findCardByCatalogId(catalogId: string): Promise<any | null> {
  try {
    const games = ["pokemon", "magic", "yugioh", "sports"];
    
    for (const game of games) {
      const cardsRef = collection(db, "cardCatalog", game, "cards");
      const q = query(cardsRef, where("catalogId", "==", catalogId), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          catalogId: doc.id,
          ...doc.data(),
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("[findCardByCatalogId] Error:", error);
    return null;
  }
}

/**
 * Search cards by name/year/set attributes
 */
async function searchCardsByAttributes(
  name: string,
  year?: string | null,
  set?: string | null
): Promise<any[]> {
  try {
    const results: any[] = [];
    const games = ["pokemon", "magic", "yugioh", "sports"];
    const searchLower = name.toLowerCase();
    
    for (const game of games) {
      const cardsRef = collection(db, "cardCatalog", game, "cards");
      const q = query(
        cardsRef,
        where("searchTerms", "array-contains", searchLower),
        limit(10)
      );
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        const cardData = doc.data();
        
        // Filter by year if provided
        if (year && cardData.year && String(cardData.year) !== year) {
          continue;
        }
        
        // Filter by set if provided
        if (set) {
          const cardSet = typeof cardData.set === "object" ? cardData.set.name : cardData.set;
          if (!cardSet || !cardSet.toLowerCase().includes(set.toLowerCase())) {
            continue;
          }
        }
        
        results.push({
          catalogId: doc.id,
          ...cardData,
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("[searchCardsByAttributes] Error:", error);
    return [];
  }
}

/**
 * Bulk ID mapping endpoint
 * POST /api/catalog/id-lookup/bulk
 */
export async function PUT(request: NextRequest) {
  try {
    const { cards } = await request.json();
    
    if (!Array.isArray(cards)) {
      return corsResponse({ error: "cards array is required" }, 400);
    }
    
    const results = cards.map(cardData => ({
      input: cardData,
      stacktrackId: generateStackTrackId(cardData),
    }));
    
    return corsResponse({
      count: results.length,
      mappings: results,
    });
    
  } catch (error) {
    console.error("[ID Lookup] Bulk mapping error:", error);
    return corsResponse(
      {
        error: "Bulk mapping failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}
