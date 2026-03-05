/**
 * AI Card Matcher Service
 * Matches AI scan results with card data from Firestore and Pokemon TCG API
 * Returns the closest match with confidence scoring
 */

import { 
  searchCardsByName, 
  searchCardsPartial, 
  getCardsBySet,
  FirestoreCardDocument 
} from './firestore-cards';
import { PokemonCardData } from './card-types';

export interface AIScanResult {
  cardName: string;
  setName?: string;
  cardNumber?: string;
  confidence?: number; // 0-100
  imageUrl?: string;
}

export interface MatchedCard {
  source: 'firestore' | 'api';
  cardData: FirestoreCardDocument | PokemonCardData;
  matchScore: number; // 0-100, how well it matches the scan
  matchReason: string; // Why this was selected
}

export interface ScoringBreakdown {
  nameMatch: number;
  setMatch: number;
  cardNumberMatch: number;
  totalScore: number;
}

/**
 * Normalize card names for comparison
 */
function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two strings (0-100)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeCardName(str1);
  const s2 = normalizeCardName(str2);

  if (s1 === s2) return 100; // Perfect match

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  // Levenshtein-like similarity (simplified)
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  const editDistance = getEditDistance(longer, shorter);
  const maxDist = longer.length;

  return Math.max(0, 100 - (editDistance / maxDist) * 100);
}

/**
 * Calculate edit distance (Levenshtein)
 */
function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}

/**
 * Score a card match based on AI scan result
 */
function scoreCardMatch(
  card: any,
  scanResult: AIScanResult
): ScoringBreakdown {
  const cardName = card.name || '';
  const cardSet = card.setName || card.set?.name || '';
  const cardNumber = card.cardNumber || card.number || '';

  let nameMatch = calculateStringSimilarity(scanResult.cardName, cardName);

  // Bonus if card set matches
  let setMatch = 0;
  if (scanResult.setName) {
    setMatch = calculateStringSimilarity(
      scanResult.setName,
      cardSet
    ) * 0.5; // Set match is less important
  }

  // Bonus if card number matches
  let cardNumberMatch = 0;
  if (scanResult.cardNumber && cardNumber) {
    // Card number should be exact or very close
    const numStr1 = scanResult.cardNumber.toString();
    const numStr2 = cardNumber.toString();
    cardNumberMatch = numStr1 === numStr2 ? 50 : 0;
  }

  const totalScore =
    nameMatch * 0.7 + // 70% weight on name
    setMatch * 0.2 + // 20% weight on set
    cardNumberMatch * 0.1; // 10% weight on card number

  return {
    nameMatch: Math.round(nameMatch),
    setMatch: Math.round(setMatch),
    cardNumberMatch: Math.round(cardNumberMatch),
    totalScore: Math.round(totalScore),
  };
}

/**
 * Find the closest matching card from Firestore or API
 * Returns the single best match
 */
export async function findClosestMatchedCard(
  scanResult: AIScanResult
): Promise<MatchedCard | null> {
  try {
    console.log(`\n🤖 AI Card Matching: "${scanResult.cardName}"`);
    if (scanResult.setName) {
      console.log(`   📍 Set: ${scanResult.setName}`);
    }
    if (scanResult.cardNumber) {
      console.log(`   📌 Number: ${scanResult.cardNumber}`);
    }

    let bestMatch: MatchedCard | null = null;
    const allCandidates: MatchedCard[] = [];

    // Step 1: Search Firestore for exact and partial matches
    console.log(`\n   🔎 Searching Firestore...`);

    // Try exact name match
    const exactMatches = await searchCardsByName(scanResult.cardName, 20);
    for (const card of exactMatches) {
      const scoring = scoreCardMatch(card, scanResult);
      if (scoring.totalScore > 0) {
        allCandidates.push({
          source: 'firestore',
          cardData: card,
          matchScore: scoring.totalScore,
          matchReason: `Name: ${scoring.nameMatch}% | Set: ${scoring.setMatch}% | Number: ${scoring.cardNumberMatch}%`,
        });
      }
    }

    // Try partial match
    const partialMatches = await searchCardsPartial(scanResult.cardName, undefined, 30);
    for (const card of partialMatches) {
      const scoring = scoreCardMatch(card, scanResult);
      if (scoring.totalScore >= 60) { // Only include partial matches with decent score
        // Check if we already have this card from exact match
        const isDuplicate = allCandidates.some(
          m => m.cardData.id === card.id
        );
        if (!isDuplicate) {
          allCandidates.push({
            source: 'firestore',
            cardData: card,
            matchScore: scoring.totalScore,
            matchReason: `Partial match - Name: ${scoring.nameMatch}% | Set: ${scoring.setMatch}%`,
          });
        }
      }
    }

    // If we have Firestore results, use the best one
    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => b.matchScore - a.matchScore);
      bestMatch = allCandidates[0];
      console.log(`   ✅ Firestore Match: "${bestMatch.cardData.name}" (${bestMatch.matchScore}%)`);
      return bestMatch;
    }

    // Step 2: Fall back to Pokemon TCG API
    console.log(`   🔎 Firestore empty, trying Pokemon TCG API...`);

    const apiPatterns = [
      scanResult.cardName,
      scanResult.cardName.split(' ')[0],
    ];

    for (const pattern of apiPatterns) {
      if (!pattern || pattern.length < 2) continue;

      try {
        // Try exact match
        let url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(pattern)}"&pageSize=20`;
        let response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          for (const card of data.data || []) {
            const scoring = scoreCardMatch(card, scanResult);
            if (scoring.totalScore > 0) {
              allCandidates.push({
                source: 'api',
                cardData: card,
                matchScore: scoring.totalScore,
                matchReason: `API - Name: ${scoring.nameMatch}% | Set: ${scoring.setMatch}%`,
              });
            }
          }
        }

        // Try partial match
        url = `https://api.pokemontcg.io/v2/cards?q=name:*${encodeURIComponent(pattern)}*&pageSize=20`;
        response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          for (const card of data.data || []) {
            const scoring = scoreCardMatch(card, scanResult);
            if (scoring.totalScore >= 60) {
              // Check for duplicates
              const isDuplicate = allCandidates.some(
                m => m.cardData.id === card.id
              );
              if (!isDuplicate) {
                allCandidates.push({
                  source: 'api',
                  cardData: card,
                  matchScore: scoring.totalScore,
                  matchReason: `API Partial - Name: ${scoring.nameMatch}% | Set: ${scoring.setMatch}%`,
                });
              }
            }
          }
        }
      } catch (err) {
        console.log(`   ⚠️  API request failed for "${pattern}"`);
        continue;
      }
    }

    // Sort all candidates and return the best
    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => b.matchScore - a.matchScore);
      bestMatch = allCandidates[0];
      console.log(`   ✅ API Match: "${bestMatch.cardData.name}" (${bestMatch.matchScore}%)`);
      return bestMatch;
    }

    console.log(`   ❌ No matches found for "${scanResult.cardName}"`);
    return null;
  } catch (error) {
    console.error('Error in card matching:', error);
    return null;
  }
}

/**
 * Find multiple candidate matches for manual selection
 * Returns top N matches sorted by confidence
 */
export async function findCardCandidates(
  scanResult: AIScanResult,
  limit: number = 5
): Promise<MatchedCard[]> {
  try {
    console.log(`\n🤖 Finding candidates for "${scanResult.cardName}"...`);

    const allCandidates: MatchedCard[] = [];

    // Search Firestore
    const exactMatches = await searchCardsByName(scanResult.cardName, 30);
    for (const card of exactMatches) {
      const scoring = scoreCardMatch(card, scanResult);
      if (scoring.totalScore > 0) {
        allCandidates.push({
          source: 'firestore',
          cardData: card,
          matchScore: scoring.totalScore,
          matchReason: `Name: ${scoring.nameMatch}% | Set: ${scoring.setMatch}%`,
        });
      }
    }

    const partialMatches = await searchCardsPartial(scanResult.cardName, undefined, 50);
    for (const card of partialMatches) {
      const scoring = scoreCardMatch(card, scanResult);
      if (scoring.totalScore >= 40) {
        const isDuplicate = allCandidates.some(m => m.cardData.id === card.id);
        if (!isDuplicate) {
          allCandidates.push({
            source: 'firestore',
            cardData: card,
            matchScore: scoring.totalScore,
            matchReason: `Partial - Name: ${scoring.nameMatch}%`,
          });
        }
      }
    }

    // Sort and return top N
    allCandidates.sort((a, b) => b.matchScore - a.matchScore);
    return allCandidates.slice(0, limit);
  } catch (error) {
    console.error('Error finding candidates:', error);
    return [];
  }
}

export default {
  findClosestMatchedCard,
  findCardCandidates,
};
