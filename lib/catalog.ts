"use client";

import { db } from "./firebase";
import { buildCardLookup, buildSetID, type StackTrackGameID } from "./cardSchema";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import type { CardDNA } from "./card-dna";
import { cleanText } from "./card-dna";

export interface CatalogCard {
  // Universal StackTrack ID (primary identifier)
  stacktrackId: string;
  cardID: string;
  gameID: StackTrackGameID;
  setID: string;
  lookup: string;
  
  // External IDs for API mapping
  catalogId: string; // Pokemon TCG ID, Scryfall ID, etc.
  tcgplayerId?: string;
  pricechartingId?: string;
  psaId?: string;
  
  // Core card data
  name: string;
  game: "pokemon" | "magic" | "yugioh" | "sports";
  set: any;
  cardNumber?: string;
  rarity?: string;
  
  // Sports card specific
  player?: string;
  team?: string;
  sport?: string;
  brand?: string;
  
  // Images
  images: {
    small: string | null;
    large: string | null;
  };
  
  // Pricing
  pricing?: {
    market: number;
    lastUpdated: string;
     // Variant-specific pricing (for TCG cards)
     variants?: {
       normal?: number;
       holofoil?: number;
       reverseHolofoil?: number;
       firstEdition?: number;
       shadowless?: number;
     };
  };
  
  // Search optimization
  searchTerms: string[];
  year?: number;
  
  // Card DNA - Normalized fields for fuzzy matching
  dna?: CardDNA;
}

/**
 * Search card catalog
 */
export async function searchCatalog(
  searchTerm: string,
  gameFilter?: string,
  setFilter?: string,
  maxResults = 20
): Promise<CatalogCard[]> {
  const results: CatalogCard[] = [];
  const searchLower = cleanText(searchTerm);

  const gamesToSearch = gameFilter
    ? [gameFilter]
    : ['pokemon', 'magic', 'yugioh'];

  for (const game of gamesToSearch) {
    try {
      const cardsRef = collection(db, "cardCatalog", game, "cards");

      // Try exact match first
      const q = query(
        cardsRef,
        where("searchTerms", "array-contains", searchLower),
        limit(maxResults)
      );

      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Apply set filter if provided
        if (setFilter) {
          const cardSet = data.set?.id || data.set?.code || data.set?.name || "";
          if (!cleanText(cardSet).includes(cleanText(setFilter))) {
            continue;
          }
        }

        results.push({
          stacktrackId: data.stacktrackId || "",
          cardID: data.cardID || data.stacktrackId || docSnap.id,
          gameID: (data.gameID || data.game || game) as StackTrackGameID,
          setID: data.setID || buildSetID(data.set?.id || data.set?.code || data.set?.name),
          lookup: data.lookup || buildCardLookup({ name: data.name, cardNumber: data.cardNumber, setName: data.set?.name || data.brand }),
          catalogId: data.catalogId || docSnap.id,
          tcgplayerId: data.tcgplayerId,
          pricechartingId: data.pricechartingId,
          psaId: data.psaId,
          name: data.name,
          game: data.game,
          set: data.set,
          cardNumber: data.cardNumber,
          rarity: data.rarity,
          player: data.player,
          team: data.team,
          sport: data.sport,
          brand: data.brand,
          images: data.images || { small: null, large: null },
          pricing: data.pricing,
          searchTerms: data.searchTerms || [],
          year: data.year,
        });

        if (results.length >= maxResults) break;
      }
    } catch (error) {
      console.error(`Error searching ${game} catalog:`, error);
    }

    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Get card by catalog ID
 */
export async function getCardFromCatalog(
  game: string,
  catalogId: string
): Promise<CatalogCard | null> {
  try {
    const cardRef = doc(db, "cardCatalog", game.toLowerCase(), "cards", catalogId);
    const cardSnap = await getDoc(cardRef);

    if (!cardSnap.exists()) {
      return null;
    }

    const data = cardSnap.data();
    return {
      stacktrackId: data.stacktrackId || "",
      cardID: data.cardID || data.stacktrackId || cardSnap.id,
      gameID: (data.gameID || data.game || game) as StackTrackGameID,
      setID: data.setID || buildSetID(data.set?.id || data.set?.code || data.set?.name),
      lookup: data.lookup || buildCardLookup({ name: data.name, cardNumber: data.cardNumber, setName: data.set?.name || data.brand }),
      catalogId: data.catalogId || cardSnap.id,
      tcgplayerId: data.tcgplayerId,
      pricechartingId: data.pricechartingId,
      psaId: data.psaId,
      name: data.name,
      game: data.game,
      set: data.set,
      cardNumber: data.cardNumber,
      rarity: data.rarity,
      player: data.player,
      team: data.team,
      sport: data.sport,
      brand: data.brand,
      images: data.images || { small: null, large: null },
      pricing: data.pricing,
      searchTerms: data.searchTerms || [],
      year: data.year,
    };
  } catch (error) {
    console.error("Error getting card from catalog:", error);
    return null;
  }
}

/**
 * Get catalog statistics
 */
export async function getCatalogStats() {
  const stats: Record<string, number> = {
    pokemon: 0,
    magic: 0,
    yugioh: 0,
    sports: 0,
    total: 0,
  };

  const games = ['pokemon', 'magic', 'yugioh', 'sports'];

  for (const game of games) {
    try {
      const cardsRef = collection(db, "cardCatalog", game, "cards");
      const snapshot = await getDocs(query(cardsRef, limit(1000))); // Sample count
      stats[game] = snapshot.size;
      stats.total += snapshot.size;
    } catch (error) {
      console.error(`Error getting ${game} stats:`, error);
    }
  }

  return stats;
}

/**
 * Get popular sets for a game
 */
export async function getPopularSets(game: string): Promise<Array<{ id: string; name: string; count: number }>> {
  try {
    const cardsRef = collection(db, "cardCatalog", game.toLowerCase(), "cards");
    const snapshot = await getDocs(query(cardsRef, limit(1000)));

    // Count cards by set
    const setCounts: Record<string, { name: string; count: number }> = {};

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const setId = data.set?.id || data.set?.code || "unknown";
      const setName = data.set?.name || "Unknown Set";

      if (!setCounts[setId]) {
        setCounts[setId] = { name: setName, count: 0 };
      }
      setCounts[setId].count++;
    }

    // Convert to array and sort by count
    return Object.entries(setCounts)
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 sets

  } catch (error) {
    console.error("Error getting popular sets:", error);
    return [];
  }
}

/**
 * Import cards into catalog (client-side wrapper for API)
 */
export async function importCardsIntoCollection(
  category: string,
  setId?: string,
  limit = 100,
  offset = 0
) {
  try {
    const response = await fetch("/api/catalog/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, setId, limit, offset }),
    });

    if (!response.ok) {
      throw new Error(`Import failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Import error:", error);
    throw error;
  }
}

/**
 * Trigger price update (client-side wrapper)
 */
export async function triggerPriceUpdate() {
  try {
    const response = await fetch("/api/catalog/update-prices", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Price update failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Price update error:", error);
    throw error;
  }
}
