import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { generateStackTrackId } from "@/lib/universal-card-id";

interface ImportStats {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

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
 * Import cards from TCGplayer catalog
 * Supports: Pokemon, Magic, Yu-Gi-Oh, Sports Cards
 */
export async function POST(request: NextRequest) {
  try {
    const { category, setId, limit = 100, offset = 0 } = await request.json();

    if (!category) {
      return corsResponse({ error: "category is required (pokemon|magic|yugioh|sports)" }, 400);
    }

    console.log(`[Catalog Import] Starting import: ${category}, set=${setId || 'all'}, limit=${limit}`);

    const stats: ImportStats = {
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Route to appropriate importer
    switch (category.toLowerCase()) {
      case 'pokemon':
        await importPokemonCards(setId, limit, offset, stats);
        break;
      case 'magic':
        await importMagicCards(setId, limit, offset, stats);
        break;
      case 'yugioh':
        await importYuGiOhCards(setId, limit, offset, stats);
        break;
      case 'sports':
        await importSportsCards(setId, limit, offset, stats);
        break;
      default:
        return corsResponse({ error: `Unknown category: ${category}` }, 400);
    }

    console.log(`[Catalog Import] Complete: ${stats.imported} imported, ${stats.failed} failed`);

    return corsResponse({
      success: true,
      category,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Catalog Import] Error:", error);
    return corsResponse(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

/**
 * Import Pokemon TCG cards
 */
async function importPokemonCards(setId: string | undefined, limit: number, offset: number, stats: ImportStats) {
  try {
    let url = `https://api.pokemontcg.io/v2/cards?pageSize=${limit}&page=${Math.floor(offset / limit) + 1}`;
    if (setId) {
      url += `&q=set.id:${setId}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Pokemon TCG API returned ${response.status}`);
    }

    const data = await response.json();
    stats.total = data.totalCount || data.data?.length || 0;

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const card of data.data || []) {
      try {
        // Generate universal StackTrack ID
        const stacktrackId = generateStackTrackId({
          game: "pokemon",
          name: card.name,
          year: parseInt(card.set.releaseDate?.split("-")[0] || "0"),
          set: card.set.id || card.set.name,
          cardNumber: card.number,
        });

        const cardRef = doc(db, "cardCatalog", "pokemon", "cards", card.id);

        const cardData = {
          stacktrackId,
          catalogId: card.id,
          tcgplayerId: card.tcgplayer?.productId || null,
          name: card.name,
          game: "pokemon" as const,
          set: {
            id: card.set.id,
            name: card.set.name,
            series: card.set.series,
          },
          cardNumber: card.number,
          rarity: card.rarity || "Common",
          supertype: card.supertype,
          types: card.types || [],
          hp: card.hp || null,
          year: parseInt(card.set.releaseDate?.split("-")[0] || "0"),
          images: {
            small: card.images?.small || null,
            large: card.images?.large || null,
          },
          tcgplayer: card.tcgplayer || null,
          lastUpdated: new Date().toISOString(),
          searchTerms: [
            card.name.toLowerCase(),
            card.set.name.toLowerCase(),
            card.number,
            ...(card.types || []).map((t: string) => t.toLowerCase()),
          ],
        };

        batch.set(cardRef, cardData, { merge: true });
        batchCount++;
        stats.imported++;

        // Commit batch every 500 writes (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Failed to import ${card.name}: ${err}`);
      }
    }

    // Commit remaining writes
    if (batchCount > 0) {
      await batch.commit();
    }

  } catch (error) {
    stats.errors.push(`Pokemon import error: ${error}`);
    throw error;
  }
}

/**
 * Import Magic: The Gathering cards via Scryfall API
 */
async function importMagicCards(setCode: string | undefined, limit: number, offset: number, stats: ImportStats) {
  try {
    let url = `https://api.scryfall.com/cards/search?order=set&unique=prints`;
    if (setCode) {
      url += `&q=set:${setCode}`;
    } else {
      url += `&q=game:paper`; // Only paper cards
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Scryfall API returned ${response.status}`);
    }

    const data = await response.json();
    stats.total = data.total_cards || 0;

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const card of data.data || []) {
      try {
        // Generate universal StackTrack ID
        const stacktrackId = generateStackTrackId({
          game: "magic",
          name: card.name,
          year: parseInt(card.released_at?.split("-")[0] || "0"),
          set: card.set_name || card.set,
          cardNumber: card.collector_number,
        });

        const cardRef = doc(db, "cardCatalog", "magic", "cards", card.id);

        const cardData = {
          stacktrackId,
          catalogId: card.id,
          name: card.name,
          game: "magic" as const,
          set: {
            code: card.set,
            name: card.set_name,
          },
          cardNumber: card.collector_number,
          rarity: card.rarity,
          year: parseInt(card.released_at?.split("-")[0] || "0"),
          manaCost: card.mana_cost || null,
          type: card.type_line,
          colors: card.colors || [],
          images: {
            small: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null,
            large: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large || null,
          },
          prices: card.prices || {},
          lastUpdated: new Date().toISOString(),
          searchTerms: [
            card.name.toLowerCase(),
            card.set_name.toLowerCase(),
            card.collector_number,
            ...(card.colors || []).map((c: string) => c.toLowerCase()),
          ],
        };

        batch.set(cardRef, cardData, { merge: true });
        batchCount++;
        stats.imported++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Failed to import ${card.name}: ${err}`);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Handle pagination for large sets
    if (data.has_more && data.next_page) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
      // Could recursively fetch next page here
    }

  } catch (error) {
    stats.errors.push(`Magic import error: ${error}`);
    throw error;
  }
}

/**
 * Import Yu-Gi-Oh cards
 */
async function importYuGiOhCards(setName: string | undefined, limit: number, offset: number, stats: ImportStats) {
  try {
    let url = `https://db.ygoprodeck.com/api/v7/cardinfo.php`;
    if (setName) {
      url += `?cardset=${encodeURIComponent(setName)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YGOPRODeck API returned ${response.status}`);
    }

    const data = await response.json();
    const cards = data.data || [];
    stats.total = cards.length;

    const batch = writeBatch(db);
    let batchCount = 0;

    for (const card of cards.slice(offset, offset + limit)) {
      try {
        // Generate universal StackTrack ID
        const firstSet = card.card_sets?.[0];
        const stacktrackId = generateStackTrackId({
          game: "yugioh",
          name: card.name,
          year: 0, // Yu-Gi-Oh doesn't provide consistent year data
          set: firstSet?.set_name || "unknown",
          cardNumber: firstSet?.set_code || String(card.id),
        });

        const cardRef = doc(db, "cardCatalog", "yugioh", "cards", String(card.id));

        const cardData = {
          stacktrackId,
          catalogId: String(card.id),
          name: card.name,
          game: "yugioh" as const,
          type: card.type,
          race: card.race,
          attribute: card.attribute || null,
          level: card.level || null,
          atk: card.atk || null,
          def: card.def || null,
          description: card.desc,
          images: {
            small: card.card_images?.[0]?.image_url_small || null,
            large: card.card_images?.[0]?.image_url || null,
          },
          sets: card.card_sets || [],
          prices: card.card_prices?.[0] || {},
          lastUpdated: new Date().toISOString(),
          searchTerms: [
            card.name.toLowerCase(),
            card.type.toLowerCase(),
            card.race?.toLowerCase() || "",
          ].filter(Boolean),
        };

        batch.set(cardRef, cardData, { merge: true });
        batchCount++;
        stats.imported++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Failed to import ${card.name}: ${err}`);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

  } catch (error) {
    stats.errors.push(`Yu-Gi-Oh import error: ${error}`);
    throw error;
  }
}

/**
 * Import Sports Cards via PriceCharting
 */
async function importSportsCards(sport: string | undefined, limit: number, offset: number, stats: ImportStats) {
  try {
    const apiKey = process.env.PRICECHARTING_API_KEY;
    if (!apiKey) {
      throw new Error("PRICECHARTING_API_KEY not configured");
    }

    // PriceCharting uses console names for sports cards
    const consoleName = sport ? `${sport} Cards` : "Baseball Cards";

    // Note: PriceCharting API is limited - this is a placeholder
    // In production, you'd need to work with their CSV exports or bulk API access
    console.log(`[Sports Import] ${consoleName} - API access limited, use CSV import instead`);

    stats.errors.push("Sports card import requires CSV upload - API access is limited by PriceCharting");
    stats.skipped = limit;

  } catch (error) {
    stats.errors.push(`Sports import error: ${error}`);
    throw error;
  }
}

/**
 * Get import status and catalog stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    if (!category) {
      return corsResponse({ error: "category parameter required" }, 400);
    }

    // Get count of cards in catalog
    const catalogRef = collection(db, "cardCatalog", category.toLowerCase(), "cards");
    const snapshot = await getDocs(catalogRef);

    return corsResponse({
      category,
      totalCards: snapshot.size,
      lastChecked: new Date().toISOString(),
    });

  } catch (error) {
    return corsResponse(
      {
        error: "Failed to get catalog stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}
