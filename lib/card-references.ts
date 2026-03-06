/**
 * Card Reference System - Universal ID Implementation
 * 
 * This system separates catalog data from user collection data.
 * Collections store only references (stacktrackId) plus user-specific info.
 */

import { db } from "./firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import type { CatalogCard } from "./catalog";

/**
 * User Collection Item - References catalog card by stacktrackId
 */
export interface CollectionItem {
  id?: string; // Firestore document ID
  userId: string;
  
  // Reference to catalog card
  stacktrackId: string; // e.g., "STK-NBA-1996-TOPPS-138-KOBE"
  
  // User-specific data
  condition: "Poor" | "Fair" | "Good" | "Excellent" | "Mint" | "PSA 1" | "PSA 2" | "PSA 3" | "PSA 4" | "PSA 5" | "PSA 6" | "PSA 7" | "PSA 8" | "PSA 9" | "PSA 10";
  quantity: number;
  purchasePrice?: number;
  purchaseDate?: string;
  notes?: string;
  
  // Organization
  folderId?: string;
  folderIds?: string[];
  
  // Custom overrides (if user wants different values)
  customValue?: number; // Override catalog market price
  customImageUrl?: string; // Override catalog image
  
  // Timestamps
  createdAt: any;
  updatedAt: any;
}

/**
 * Marketplace Listing - References catalog card
 */
export interface MarketplaceListing {
  listingId?: string;
  stacktrackId: string; // Reference to catalog card
  sellerId: string;
  sellerName?: string;
  
  // Listing details
  price: number;
  condition: string;
  quantity: number;
  description?: string;
  
  // Images (can override catalog images)
  imageUrls?: string[];
  
  // Status
  status: "active" | "sold" | "cancelled";
  views: number;
  
  // Timestamps
  createdAt: any;
  updatedAt: any;
  soldAt?: any;
}

/**
 * Auction Listing - References catalog card
 */
export interface AuctionListing {
  auctionId?: string;
  stacktrackId: string; // Reference to catalog card
  sellerId: string;
  
  // Auction details
  startingBid: number;
  currentBid: number;
  currentBidder?: string;
  buyNowPrice?: number;
  
  condition: string;
  
  // Timing
  startTime: any;
  endTime: any;
  
  // Status
  status: "active" | "completed" | "cancelled";
  
  createdAt: any;
}

/**
 * Price History Entry - Tracks prices over time
 */
export interface PriceHistoryEntry {
  stacktrackId: string;
  date: string; // ISO date
  marketPrice: number;
  lowPrice?: number;
  highPrice?: number;
  source: "pricecharting" | "tcgplayer" | "auction" | "marketplace";
}

/**
 * Get catalog card by stacktrackId
 */
export async function getCatalogCardById(stacktrackId: string): Promise<CatalogCard | null> {
  try {
    const games = ["pokemon", "magic", "yugioh", "sports"];
    
    for (const game of games) {
      const cardsRef = collection(db, "cardCatalog", game, "cards");
      const q = query(cardsRef, where("stacktrackId", "==", stacktrackId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const cardDoc = snapshot.docs[0];
        return {
          ...cardDoc.data(),
          catalogId: cardDoc.id,
        } as CatalogCard;
      }
    }
    
    return null;
  } catch (error) {
    console.error("[getCatalogCardById] Error:", error);
    return null;
  }
}

/**
 * Get enriched collection item (combines user data + catalog data)
 */
export async function getEnrichedCollectionItem(collectionItem: CollectionItem): Promise<{
  collection: CollectionItem;
  catalog: CatalogCard | null;
}> {
  const catalogCard = await getCatalogCardById(collectionItem.stacktrackId);
  
  return {
    collection: collectionItem,
    catalog: catalogCard,
  };
}

/**
 * Get user's collection items with catalog data
 */
export async function getUserCollectionWithCatalog(userId: string): Promise<Array<{
  collection: CollectionItem;
  catalog: CatalogCard | null;
}>> {
  try {
    const collectionRef = collection(db, "userCollections");
    const q = query(collectionRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    
    const items: CollectionItem[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CollectionItem));
    
    // Enrich with catalog data
    const enriched = await Promise.all(
      items.map(item => getEnrichedCollectionItem(item))
    );
    
    return enriched;
  } catch (error) {
    console.error("[getUserCollectionWithCatalog] Error:", error);
    return [];
  }
}

/**
 * Add card to user collection (by stacktrackId reference)
 */
export async function addCardToCollection(
  userId: string,
  stacktrackId: string,
  collectionData: Partial<CollectionItem>
): Promise<string | null> {
  try {
    // Verify card exists in catalog
    const catalogCard = await getCatalogCardById(stacktrackId);
    if (!catalogCard) {
      throw new Error(`Card not found in catalog: ${stacktrackId}`);
    }
    
    const collectionRef = collection(db, "userCollections");
    const docRef = await addDoc(collectionRef, {
      userId,
      stacktrackId,
      condition: collectionData.condition || "Good",
      quantity: collectionData.quantity || 1,
      purchasePrice: collectionData.purchasePrice,
      purchaseDate: collectionData.purchaseDate,
      notes: collectionData.notes || "",
      folderId: collectionData.folderId,
      folderIds: collectionData.folderIds || [],
      customValue: collectionData.customValue,
      customImageUrl: collectionData.customImageUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error("[addCardToCollection] Error:", error);
    return null;
  }
}

/**
 * Update collection item
 */
export async function updateCollectionItem(
  itemId: string,
  updates: Partial<CollectionItem>
): Promise<boolean> {
  try {
    const itemRef = doc(db, "userCollections", itemId);
    await updateDoc(itemRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("[updateCollectionItem] Error:", error);
    return false;
  }
}

/**
 * Delete collection item
 */
export async function deleteCollectionItem(itemId: string): Promise<boolean> {
  try {
    const itemRef = doc(db, "userCollections", itemId);
    await deleteDoc(itemRef);
    return true;
  } catch (error) {
    console.error("[deleteCollectionItem] Error:", error);
    return false;
  }
}

/**
 * Calculate total collection value
 */
export async function calculateCollectionValue(userId: string): Promise<{
  totalValue: number;
  itemCount: number;
  breakdown: { [cardId: string]: number };
}> {
  const collection = await getUserCollectionWithCatalog(userId);
  
  let totalValue = 0;
  const breakdown: { [cardId: string]: number } = {};
  
  for (const item of collection) {
    // Use custom value if set, otherwise use catalog market price
    const itemValue = item.collection.customValue || 
                     item.catalog?.pricing?.market || 
                     0;
    
    const totalItemValue = itemValue * item.collection.quantity;
    totalValue += totalItemValue;
    
    breakdown[item.collection.stacktrackId] = totalItemValue;
  }
  
  return {
    totalValue,
    itemCount: collection.length,
    breakdown,
  };
}

/**
 * Get all marketplace listings for a card
 */
export async function getMarketplaceListingsByCard(stacktrackId: string): Promise<MarketplaceListing[]> {
  try {
    const listingsRef = collection(db, "marketplaceListings");
    const q = query(
      listingsRef,
      where("stacktrackId", "==", stacktrackId),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      listingId: doc.id,
      ...doc.data(),
    } as MarketplaceListing));
  } catch (error) {
    console.error("[getMarketplaceListingsByCard] Error:", error);
    return [];
  }
}

/**
 * Get price history for a card
 */
export async function getPriceHistory(
  stacktrackId: string,
  days: number = 30
): Promise<PriceHistoryEntry[]> {
  try {
    const historyRef = collection(db, "priceHistory");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const q = query(
      historyRef,
      where("stacktrackId", "==", stacktrackId),
      where("date", ">=", cutoffDate.toISOString())
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => doc.data() as PriceHistoryEntry);
  } catch (error) {
    console.error("[getPriceHistory] Error:", error);
    return [];
  }
}

/**
 * Example: Migrate existing card to reference-based system
 */
export async function migrateOldCardToReferences(
  oldCard: {
    name: string;
    player?: string;
    year?: number;
    brand?: string;
    sport?: string;
    cardNumber?: string;
    condition: string;
    value: number;
    userId: string;
  }
): Promise<string | null> {
  // Generate stacktrackId based on card data
  const { generateStackTrackId } = await import("./universal-card-id");
  
  const stacktrackId = generateStackTrackId({
    game: oldCard.sport || "sports",
    name: oldCard.name,
    player: oldCard.player,
    year: oldCard.year,
    set: oldCard.brand || "unknown",
    cardNumber: oldCard.cardNumber,
    sport: oldCard.sport,
  });
  
  // Check if card exists in catalog
  let catalogCard = await getCatalogCardById(stacktrackId);
  
  // If not in catalog, user might need to create a custom catalog entry
  // For now, still create the collection reference
  
  return await addCardToCollection(oldCard.userId, stacktrackId, {
    condition: oldCard.condition as any,
    quantity: 1,
    customValue: oldCard.value,
  });
}
