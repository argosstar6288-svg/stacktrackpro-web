/**
 * Firestore service for Pokemon TCG card data
 * Handles batch uploads and queries for card image data
 */

import {
  collection,
  writeBatch,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  PokemonCardData,
  FirestoreCardDocument,
  ImportStats,
} from './card-types';

const CARDS_COLLECTION = 'pokemon_tcg_cards';
const BATCH_SIZE = 500; // Firestore batch write limit is 500

/**
 * Transform Pokemon TCG card data to Firestore format
 */
function transformCardData(card: PokemonCardData): FirestoreCardDocument {
  return {
    ...card,
    setId: card.set.id,
    setName: card.set.name,
    seriesName: card.set.series,
    searchName: card.name.toLowerCase(),
    searchTerms: [
      card.name.toLowerCase(),
      ...(card.types || []).map(t => t.toLowerCase()),
      ...(card.subtypes || []).map(t => t.toLowerCase()),
      card.cardNumber,
      card.set.name.toLowerCase(),
    ].filter(Boolean),
    lastUpdated: new Date(),
  };
}

/**
 * Batch upload Pokemon TCG cards to Firestore
 * Splits large datasets into chunks respecting the 500-write batch limit
 */
export async function batchUploadCards(
  cards: PokemonCardData[]
): Promise<ImportStats> {
  const startTime = Date.now();
  const stats: ImportStats = {
    totalCards: cards.length,
    imported: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    duration: 0,
  };

  try {
    console.log(`🚀 Starting import of ${cards.length} Pokemon TCG cards...`);

    // Process in chunks respecting Firestore's 500 write limit
    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const chunk = cards.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const card of chunk) {
        try {
          const cardRef = doc(collection(db, CARDS_COLLECTION), card.id);
          const transformedData = transformCardData(card);

          batch.set(cardRef, transformedData, { merge: true });
          stats.imported++;
        } catch (error) {
          stats.failed++;
          stats.errors.push({
            cardId: card.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          console.error(`❌ Failed to process card ${card.id}:`, error);
        }
      }

      // Commit the batch
      await batch.commit();
      console.log(
        `✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${stats.imported}/${cards.length})`
      );
    }

    stats.duration = Date.now() - startTime;
    console.log(`\n📊 Import Complete!`);
    console.log(`   ✅ Imported: ${stats.imported}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    console.log(`   ⏭️ Skipped: ${stats.skipped}`);
    console.log(`   ⏱️ Duration: ${stats.duration}ms`);

    return stats;
  } catch (error) {
    console.error('Fatal error during batch upload:', error);
    throw error;
  }
}

/**
 * Search for cards by name
 */
export async function searchCardsByName(name: string, limit_count = 20) {
  try {
    const searchName = name.toLowerCase();
    const q = query(
      collection(db, CARDS_COLLECTION),
      where('searchName', '==', searchName),
      limit(limit_count)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestoreCardDocument);
  } catch (error) {
    console.error('Error searching cards by name:', error);
    return [];
  }
}

/**
 * Search for cards by partial name (text search)
 */
export async function searchCardsPartial(
  nameFragment: string,
  setPref?: string,
  limit_count = 20
) {
  try {
    const searchFragment = nameFragment.toLowerCase();
    let q;

    if (setPref) {
      q = query(
        collection(db, CARDS_COLLECTION),
        where('setName', '==', setPref),
        where('searchName', '>=', searchFragment),
        where('searchName', '<=', searchFragment + '\uf8ff'),
        limit(limit_count)
      );
    } else {
      // Without set filter, use simple range query
      q = query(
        collection(db, CARDS_COLLECTION),
        where('searchName', '>=', searchFragment),
        where('searchName', '<=', searchFragment + '\uf8ff'),
        limit(limit_count)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestoreCardDocument);
  } catch (error) {
    console.error('Error searching cards by fragment:', error);
    return [];
  }
}

/**
 * Get card by specific ID (Pokemon TCG card ID)
 */
export async function getCardById(cardId: string) {
  try {
    const cardRef = doc(db, CARDS_COLLECTION, cardId);
    const snapshot = await getDoc(cardRef);

    if (snapshot.exists()) {
      return snapshot.data() as FirestoreCardDocument;
    }
    return null;
  } catch (error) {
    console.error('Error getting card by ID:', error);
    return null;
  }
}

/**
 * Get cards by set
 */
export async function getCardsBySet(setId: string, limit_count = 100) {
  try {
    const q = query(
      collection(db, CARDS_COLLECTION),
      where('setId', '==', setId),
      limit(limit_count)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestoreCardDocument);
  } catch (error) {
    console.error('Error getting cards by set:', error);
    return [];
  }
}

/**
 * Get cards by type
 */
export async function getCardsByType(type: string, limit_count = 100) {
  try {
    const q = query(
      collection(db, CARDS_COLLECTION),
      where('types', 'array-contains', type),
      limit(limit_count)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestoreCardDocument);
  } catch (error) {
    console.error('Error getting cards by type:', error);
    return [];
  }
}

/**
 * Update card with new image data or metadata
 */
export async function updateCard(
  cardId: string,
  updates: Partial<FirestoreCardDocument>
) {
  try {
    const cardRef = doc(db, CARDS_COLLECTION, cardId);
    await updateDoc(cardRef, {
      ...updates,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Error updating card:', error);
    throw error;
  }
}

/**
 * Delete card from collection
 */
export async function deleteCard(cardId: string) {
  try {
    const cardRef = doc(db, CARDS_COLLECTION, cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    console.error('Error deleting card:', error);
    throw error;
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats() {
  try {
    const q = query(collection(db, CARDS_COLLECTION));
    const snapshot = await getDocs(q);

    const stats = {
      totalCards: snapshot.size,
      sets: new Set<string>(),
      types: new Set<string>(),
      supertypes: new Set<string>(),
    };

    snapshot.docs.forEach(doc => {
      const data = doc.data() as FirestoreCardDocument;
      stats.sets.add(data.setName);
      data.types?.forEach(t => stats.types.add(t));
      stats.supertypes.add(data.supertype);
    });

    return {
      totalCards: stats.totalCards,
      uniqueSets: stats.sets.size,
      uniqueTypes: stats.types.size,
      supertypes: Array.from(stats.supertypes),
    };
  } catch (error) {
    console.error('Error getting collection stats:', error);
    return null;
  }
}

/**
 * Clear the entire card collection (use with caution!)
 */
export async function clearCardCollection() {
  try {
    console.warn('⚠️ Clearing entire card collection...');
    const q = query(collection(db, CARDS_COLLECTION));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`🗑️ Deleted ${count} cards from collection`);
    }

    return count;
  } catch (error) {
    console.error('Error clearing collection:', error);
    throw error;
  }
}
