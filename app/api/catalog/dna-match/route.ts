import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit as firestoreLimit } from "firebase/firestore";
import { matchCardDNA, generateCardDNA, buildDNASearchQuery, cleanScanInputForSearch } from "@/lib/card-dna";

/**
 * Card DNA Matching API
 * 
 * Fuzzy matching that handles OCR errors and text variations
 * Returns top matches sorted by confidence score
 * 
 * POST /api/catalog/dna-match
 * Body: {
 *   player?: string,
 *   team?: string,
 *   year?: number,
 *   set?: string,
 *   cardNumber?: string,
 *   brand?: string,
 *   sport?: string,
 *   name?: string,
 *   limit?: number
 * }
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
 * POST: Match scanned card data against catalog using DNA scoring
 */
export async function POST(request: NextRequest) {
  try {
    const rawScanData = await request.json();
    const cleanedScanData = cleanScanInputForSearch(rawScanData);
    const {
      player,
      team,
      year,
      set,
      cardNumber,
      brand,
      sport,
      name,
      type,
    } = cleanedScanData;
    const limit = Number(rawScanData?.limit) || 10;

    console.log("[DNA Match] Scan data:", {
      player,
      team,
      year,
      set,
      cardNumber,
      brand,
      sport,
      name,
    });

    // Build search query to pre-filter catalog
    const { searchTerms, filters } = buildDNASearchQuery({
      player,
      name,
      year,
      sport,
    });

    console.log("[DNA Match] Search terms:", searchTerms);
    console.log("[DNA Match] Filters:", filters);

    // Determine which game catalogs to search
    let gamesToSearch: string[] = [];
    if (sport) {
      gamesToSearch = ["sports"];
    } else if (name && !player) {
      // TCG card - search Pokemon, Magic, Yu-Gi-Oh
      gamesToSearch = ["pokemon", "magic", "yugioh"];
    } else {
      // Unknown - search all
      gamesToSearch = ["pokemon", "magic", "yugioh", "sports"];
    }

    // Fetch potential matches from catalog
    const catalogCards: any[] = [];

    for (const game of gamesToSearch) {
      try {
        const cardsRef = collection(db, "cardCatalog", game, "cards");

        // Player-first narrowing (then year), fallback to name token/year.
        let q;
        const playerToken = player?.split(" ").find((token) => token.length > 1);
        const nameToken = searchTerms.find((token) => token.length > 1);

        if (playerToken) {
          if (filters.year) {
            q = query(
              cardsRef,
              where("searchTerms", "array-contains", playerToken),
              where("year", "==", filters.year),
              firestoreLimit(150)
            );
          } else {
            q = query(
              cardsRef,
              where("searchTerms", "array-contains", playerToken),
              firestoreLimit(200)
            );
          }
        } else if (nameToken) {
          if (filters.year) {
            q = query(
              cardsRef,
              where("searchTerms", "array-contains", nameToken),
              where("year", "==", filters.year),
              firestoreLimit(150)
            );
          } else {
            q = query(
              cardsRef,
              where("searchTerms", "array-contains", nameToken),
              firestoreLimit(200)
            );
          }
        } else if (filters.year) {
          q = query(
            cardsRef,
            where("year", "==", filters.year),
            firestoreLimit(200)
          );
        } else {
          // No narrowing criteria; skip to avoid scanning huge catalogs.
          console.log(`[DNA Match] Skipping ${game} - no player/name/year filters`);
          continue;
        }

        const snapshot = await getDocs(q);
        console.log(`[DNA Match] Found ${snapshot.size} cards in ${game}`);

        snapshot.docs.forEach(docSnap => {
          const cardData = docSnap.data() as any;

          // Extra in-memory narrowing: player contains "kobe" style matching.
          if (player) {
            const catalogPlayer = String(cardData?.dna?.player || cardData?.player || "").toLowerCase();
            if (!catalogPlayer.includes(player)) {
              return;
            }
          }

          catalogCards.push({
            catalogId: docSnap.id,
            stacktrackId: cardData.stacktrackId || "",
            name: cardData.name || "",
            game: cardData.game || game,
            set: cardData.set || {},
            cardNumber: cardData.cardNumber,
            year: cardData.year,
            player: cardData.player,
            team: cardData.team,
            sport: cardData.sport,
            brand: cardData.brand,
            type: cardData.type,
            dna: cardData.dna,
            images: cardData.images || { small: null, large: null },
            pricing: cardData.pricing,
          });
        });
      } catch (error) {
        console.error(`[DNA Match] Error searching ${game}:`, error);
      }
    }

    console.log(`[DNA Match] Total catalog cards to score: ${catalogCards.length}`);

    if (catalogCards.length === 0) {
      return corsResponse({
        success: false,
        message: "No potential matches found. Try providing more specific details (e.g., year or player name).",
        matches: [],
      });
    }

    // Score all matches using DNA algorithm
    const matches = matchCardDNA(
      {
        player,
        team,
        year,
        set,
        cardNumber,
        brand,
        sport,
        name,
        type,
      },
      catalogCards
    );

    // Limit results
    const topMatches = matches.slice(0, limit);

    console.log(
      `[DNA Match] Top match: ${topMatches[0]?.name} (${topMatches[0]?.percentage}%)`
    );

    return corsResponse({
      success: true,
      matches: topMatches,
      totalMatches: matches.length,
      autoMatch: null,
      requireSelection: true,
      scanDNA: generateCardDNA(cleanedScanData),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[DNA Match] Error:", error);
    return corsResponse(
      {
        error: "DNA matching failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

/**
 * GET: Test DNA matching with query parameters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const scanData = {
      player: searchParams.get("player") || undefined,
      team: searchParams.get("team") || undefined,
      year: searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined,
      set: searchParams.get("set") || undefined,
      cardNumber: searchParams.get("cardNumber") || undefined,
      brand: searchParams.get("brand") || undefined,
      sport: searchParams.get("sport") || undefined,
      name: searchParams.get("name") || undefined,
      type: searchParams.get("type") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 10,
    };

    // Use POST logic
    const mockRequest = new Request(request.url, {
      method: "POST",
      body: JSON.stringify(scanData),
    });

    return await POST(mockRequest as any);

  } catch (error) {
    console.error("[DNA Match] GET error:", error);
    return corsResponse(
      {
        error: "DNA matching failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}
