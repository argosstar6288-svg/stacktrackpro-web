/**
 * AI Card Save Service
 * Saves matched card data from AI scans to user collection
 */

import {
  collection,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Card } from './cards';
import {
  MatchedCard,
  AIScanResult,
  findClosestMatchedCard,
} from './ai-card-matcher';
import { PokemonCardData, FirestoreCardDocument } from './card-types';

export interface SavedCardResult {
  success: boolean;
  cardId: string;
  originalCard: Card;
  updatedFields: string[];
  matchScore: number;
  error?: string;
}

/**
 * Convert matched card data to collection update format
 */
function transformMatchedDataForUpdate(
  matchedCard: MatchedCard
): Partial<Card> {
  const card = matchedCard.cardData as any;

  return {
    // Basic info
    name: card.name,
    cardNumber: card.cardNumber || card.number,

    // Images - use the matched card image if available
    imageUrl: card.images?.large || card.images?.small || undefined,

    // Set/Collection info stored in brand field
    brand: (card as any).setName || card.set?.name || 'Pokemon',

    // Pokemon-specific metadata stored as JSON in notes
    notes: JSON.stringify({
      series: (card as any).seriesName || card.set?.series,
      type: (card as any).supertype,
      hp: card.hp,
      pokemonTypes: Array.isArray(card.types)
        ? card.types.join(', ')
        : card.types,
      flavorText: card.flavorText,
      tcgplayerPrice:
        card.tcgplayer?.prices?.normal?.market ||
        card.tcgplayer?.prices?.holofoil?.market,
    }),

    // Rarity
    rarity: (card.rarity as any) || 'Common',
  };
}

/**
 * Save AI matched card data to user's collection
 * Updates an existing card with matched data from closest database match
 */
export async function saveAIMatchedCardToCollection(
  userId: string,
  cardId: string,
  scanResult: AIScanResult
): Promise<SavedCardResult> {
  try {
    console.log(
      `\n💾 Saving AI matched data for card "${cardId}" in collection`
    );

    // Get the original card for reference
    const cardRef = doc(db, 'users', userId, 'cards', cardId);
    const cardSnapshot = await getDoc(cardRef);

    if (!cardSnapshot.exists()) {
      return {
        success: false,
        cardId,
        originalCard: {} as Card,
        updatedFields: [],
        matchScore: 0,
        error: 'Card not found in collection',
      };
    }

    const originalCard = cardSnapshot.data() as Card;

    // Find the closest match from database
    const matchedCard = await findClosestMatchedCard(scanResult);

    if (!matchedCard) {
      console.log(`   ❌ No matches found for AI scan`);
      return {
        success: false,
        cardId,
        originalCard,
        updatedFields: [],
        matchScore: 0,
        error: 'Could not find matching card in database',
      };
    }

    // Transform the matched data
    const updateData = transformMatchedDataForUpdate(matchedCard);

    // Track which fields were updated
    const updatedFields = Object.keys(updateData).filter(
      key => updateData[key as keyof typeof updateData] !== undefined
    );

    // Save to Firestore
    await updateDoc(cardRef, updateData);

    console.log(`   ✅ Card updated successfully!`);
    console.log(`   📊 Match Score: ${matchedCard.matchScore}%`);
    console.log(`   📝 Updated fields: ${updatedFields.join(', ')}`);

    return {
      success: true,
      cardId,
      originalCard,
      updatedFields,
      matchScore: matchedCard.matchScore,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error saving AI matched card:', error);
    return {
      success: false,
      cardId,
      originalCard: {} as Card,
      updatedFields: [],
      matchScore: 0,
      error: errorMsg,
    };
  }
}

/**
 * Batch save AI matched data for multiple cards
 */
export async function batchSaveAIMatchedCards(
  userId: string,
  matches: Array<{
    cardId: string;
    scanResult: AIScanResult;
  }>
): Promise<SavedCardResult[]> {
  const results: SavedCardResult[] = [];

  console.log(`\n📦 Batch saving ${matches.length} AI matched cards...`);

  for (const match of matches) {
    const result = await saveAIMatchedCardToCollection(
      userId,
      match.cardId,
      match.scanResult
    );
    results.push(result);

    // Small delay to avoid API rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const successful = results.filter(r => r.success).length;
  console.log(
    `\n✅ Batch complete: ${successful}/${matches.length} cards updated`
  );

  return results;
}

/**
 * Get AI match suggestions for a card without saving
 * Useful for preview/confirmation before saving
 */
export async function getAIMatchSuggestion(
  scanResult: AIScanResult
): Promise<MatchedCard | null> {
  return findClosestMatchedCard(scanResult);
}

export default {
  saveAIMatchedCardToCollection,
  batchSaveAIMatchedCards,
  getAIMatchSuggestion,
};
