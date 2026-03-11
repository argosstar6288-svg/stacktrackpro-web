/**
 * Fast Card Matching with Lookup Index
 * 
 * Instead of fuzzy matching every time, create a searchable index
 * Example: "charizard_4_102" → instant lookup
 * 
 * Target: < 50ms per match
 */

import { db } from "./firebase";
import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  limit as firestoreLimit,
  Timestamp,
} from "firebase/firestore";
import { ExtractedCardInfo } from "./ocr";
import { buildCardLookup } from "./cardSchema";

export interface CardLookupMatch {
  id: string;
  name: string;
  cardNumber?: string;
  setName?: string;
  year?: number;
  brand?: string;
  sport?: string;
  player?: string;
  team?: string;
  imageUrl?: string;
  averagePrice?: number;
  lookupKey: string; // "charizard_4_102"
  matchScore: number; // 0-1 confidence
  matchType: "exact" | "number" | "name" | "fuzzy";
}

/**
 * Generate lookup key for a card
 * Used for indexing and fast matching
 */
export function generateCardLookupKey(cardInfo: {
  name?: string;
  cardNumber?: string;
  setName?: string;
}): string {
  return buildCardLookup({
    name: cardInfo.name,
    cardNumber: cardInfo.cardNumber,
    setName: cardInfo.setName,
  });
}

/**
 * Match card by normalized lookup key (fastest path)
 */
export async function matchByLookup(cardInfo: {
  name?: string;
  cardNumber?: string;
  setName?: string;
}): Promise<CardLookupMatch[]> {
  const lookupKey = generateCardLookupKey(cardInfo);
  if (!lookupKey || lookupKey === "unknown_card") {
    return [];
  }

  try {
    const startTime = performance.now();
    const snapshot = await getDocs(
      query(
        collectionGroup(db, "cards"),
        where("lookup", "==", lookupKey),
        firestoreLimit(10)
      )
    );

    const results: CardLookupMatch[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as any;
      return {
        id: docSnap.id,
        name: data.name || "",
        cardNumber: data.cardNumber || data.number,
        setName: data.setName || data.set?.name,
        year: data.year,
        brand: data.brand,
        sport: data.sport,
        player: data.player,
        team: data.team,
        imageUrl: data.images?.small || data.imageUrl || data.image,
        averagePrice: data.averagePrice || data.pricing?.market || data.pricing?.averagePrice,
        lookupKey: data.lookup || lookupKey,
        matchScore: 1,
        matchType: "exact",
      };
    });

    const elapsed = performance.now() - startTime;
    console.log(`[Card Match] Found ${results.length} exact lookup matches in ${Math.round(elapsed)}ms`);
    return results;
  } catch (error) {
    console.error("[Card Match] Error matching by lookup:", error);
    return [];
  }
}

/**
 * Fuzzy string matching (Levenshtein distance)
 * Returns 0-1 similarity score
 */
function fuzzyMatch(str1: string, str2: string): number {
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);

  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Match card by number (most reliable)
 * Example: "4/102" → exact database lookup
 */
export async function matchByCardNumber(
  cardNumber: string
): Promise<CardLookupMatch[]> {
  if (!cardNumber || cardNumber.length < 2) {
    return [];
  }

  try {
    const startTime = performance.now();

    // Search in cardCatalog (master card database)
    const catalogCards = await Promise.all([
      getDocs(
        query(
          collection(db, "cardCatalog", "pokemon", "cards"),
          where("cardNumber", "==", cardNumber),
          firestoreLimit(5)
        )
      ),
      getDocs(
        query(
          collection(db, "cardCatalog", "sports", "cards"),
          where("cardNumber", "==", cardNumber),
          firestoreLimit(5)
        )
      ),
      getDocs(
        query(
          collection(db, "cardCatalog", "magic", "cards"),
          where("cardNumber", "==", cardNumber),
          firestoreLimit(5)
        )
      ),
    ]);

    const allResults: CardLookupMatch[] = [];

    catalogCards.forEach((snapshot) => {
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        allResults.push({
          id: doc.id,
          name: data.name || "",
          cardNumber: data.cardNumber,
          setName: data.setName,
          year: data.year,
          brand: data.brand,
          sport: data.sport,
          player: data.player,
          team: data.team,
          imageUrl: data.images?.small || data.imageUrl,
          averagePrice: data.averagePrice || data.pricing?.averagePrice,
          lookupKey: generateCardLookupKey({
            name: data.name,
            cardNumber: data.cardNumber,
          }),
          matchScore: 0.95, // Card number match is very confident
          matchType: "number",
        });
      });
    });

    const elapsed = performance.now() - startTime;
    console.log(
      `[Card Match] Found ${allResults.length} cards by number in ${Math.round(elapsed)}ms`
    );

    return allResults;
  } catch (error) {
    console.error("[Card Match] Error matching by card number:", error);
    return [];
  }
}

/**
 * Match card by name + year + set
 * Uses fuzzy matching for typos and OCR errors
 */
export async function matchByName(
  name: string,
  year?: number,
  setName?: string
): Promise<CardLookupMatch[]> {
  if (!name || name.length < 3) {
    return [];
  }

  try {
    const startTime = performance.now();

    // Search in all game catalogs
    const games = ["pokemon", "sports", "magic", "yugioh"];
    const allResults: CardLookupMatch[] = [];

    for (const game of games) {
      try {
        // Build search (simplified - in production use searchTerms array)
        const snapshot = await getDocs(
          query(
            collection(db, "cardCatalog", game, "cards"),
            where("name", ">=", name.substring(0, 2).toUpperCase()),
            where("name", "<=", name.substring(0, 2).toUpperCase() + "~"),
            firestoreLimit(20)
          )
        );

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const catalogName = data.name || "";
          const nameScore = fuzzyMatch(name, catalogName);

          // Bonus for year match
          let yearScore = 0.5;
          if (year && Math.abs((data.year || 0) - year) <= 1) {
            yearScore = 1.0;
          }

          // Bonus for set match
          let setScore = 0.5;
          if (setName && data.setName?.includes(setName)) {
            setScore = 1.0;
          }

          const overallScore = nameScore * 0.6 + yearScore * 0.2 + setScore * 0.2;

          if (overallScore > 0.5) {
            allResults.push({
              id: doc.id,
              name: catalogName,
              cardNumber: data.cardNumber,
              setName: data.setName,
              year: data.year,
              brand: data.brand,
              sport: data.sport,
              player: data.player,
              team: data.team,
              imageUrl: data.images?.small || data.imageUrl,
              averagePrice: data.averagePrice || data.pricing?.averagePrice,
              lookupKey: generateCardLookupKey({
                name: catalogName,
                cardNumber: data.cardNumber,
              }),
              matchScore: overallScore,
              matchType: "name",
            });
          }
        });
      } catch (gameError) {
        console.warn(`[Card Match] Error searching ${game} catalog:`, gameError);
      }
    }

    // Sort by match score
    allResults.sort((a, b) => b.matchScore - a.matchScore);

    const elapsed = performance.now() - startTime;
    console.log(
      `[Card Match] Found ${allResults.length} cards by name in ${Math.round(elapsed)}ms`
    );

    return allResults.slice(0, 10); // Return top 10
  } catch (error) {
    console.error("[Card Match] Error matching by name:", error);
    return [];
  }
}

/**
 * Smart matching strategy
 * Tries card number first (most reliable), then name
 */
export async function matchCard(
  cardInfo: ExtractedCardInfo
): Promise<CardLookupMatch[]> {
  console.log("[Card Match] Starting match with:", cardInfo);

  // Strategy 0: normalized lookup key (fastest)
  const lookupMatches = await matchByLookup({
    name: cardInfo.name,
    cardNumber: cardInfo.cardNumber,
    setName: cardInfo.setName,
  });
  if (lookupMatches.length > 0) {
    console.log(`[Card Match] Found ${lookupMatches.length} matches by lookup`);
    return lookupMatches;
  }

  // Strategy 1: Try card number (most reliable)
  if (cardInfo.cardNumber) {
    const numberMatches = await matchByCardNumber(cardInfo.cardNumber);
    if (numberMatches.length > 0) {
      console.log(`[Card Match] Found ${numberMatches.length} matches by number`);
      return numberMatches;
    }
  }

  // Strategy 2: Try name + year + set
  if (cardInfo.name) {
    const nameMatches = await matchByName(
      cardInfo.name,
      cardInfo.year,
      cardInfo.setName
    );
    if (nameMatches.length > 0) {
      console.log(`[Card Match] Found ${nameMatches.length} matches by name`);
      return nameMatches;
    }
  }

  // No matches found
  console.log("[Card Match] No matches found");
  return [];
}

/**
 * Select best match from candidates
 */
export function selectBestMatch(matches: CardLookupMatch[]): CardLookupMatch | null {
  if (matches.length === 0) return null;
  return matches[0]; // Already sorted by score
}

/**
 * Cache lookup keys in card documents for instant matching
 * Should be called during catalog import/update
 */
export function generateCardIndexRecord(cardData: any) {
  return {
    ...cardData,
    lookupKey: generateCardLookupKey({
      name: cardData.name,
      cardNumber: cardData.cardNumber,
      setName: cardData.setName,
    }),
    searchTerms: [
      ...(cardData.name?.toLowerCase().split(/\s+/) || []),
      ...(cardData.player?.toLowerCase().split(/\s+/) || []),
      cardData.cardNumber?.replace("/", "_"),
      ...(cardData.setName?.toLowerCase().split(/\s+/) || []),
    ]
      .filter((t) => t && t.length > 1)
      .map((t) => t.substring(0, 20)),
  };
}
