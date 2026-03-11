import { db } from "./firebase";
import { buildCardLookup, buildSetID, inferGameID, type StackTrackGameID } from "./cardSchema";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const CACHE_TTL_DAYS = 30; // Refresh cache if older than 30 days
const CACHE_COLLECTION = "cardCache";

export interface CachedCardMetadata {
  // Card identification
  stacktrackId: string;
  cardID?: string;
  gameID?: StackTrackGameID;
  setID?: string;
  lookup?: string;
  name: string;
  player: string;
  year: number;
  brand: string;
  sport: string;
  setName: string;
  cardNumber: string;

  // Images
  imageUrl?: string;
  imageSmallUrl?: string;
  imageLargeUrl?: string;

  // Grades & Condition
  condition: string;
  isGraded: boolean;
  gradingCompany?: string;
  grade?: string;

  // Pricing from external APIs (cached)
  pricing: {
    // TCGPlayer pricing
    tcgplayer?: {
      marketPrice?: number;
      midPrice?: number;
      highPrice?: number;
      lowPrice?: number;
      lastUpdate?: number; // timestamp
      url?: string;
    };

    // PriceCharting pricing
    pricecharting?: {
      looseCents?: number; // in cents
      cibCents?: number;
      newCents?: number;
      gradedCents?: number;
      lastUpdate?: number; // timestamp
      url?: string;
    };

    // eBay prices (from last sold listings)
    ebay?: {
      avgSoldPrice?: number;
      highestSoldPrice?: number;
      lowestSoldPrice?: number;
      soldListingsCount?: number;
      lastUpdate?: number; // timestamp
      url?: string;
    };

    // Aggregated best estimate
    estimatedValue?: number;
    estimatedValueSource?: "tcgplayer" | "pricecharting" | "ebay" | "scan";
  };

  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastPricingFetch?: Timestamp;
  catalogSourceId?: string; // Reference to cardCatalog ID if matched
  scanCount?: number; // How many times this card has been scanned
}

export interface CardCacheStats {
  totalCached: number;
  needsRefresh: number;
  lastRefreshAt?: Timestamp;
}

/**
 * Get cached card metadata by stacktrackId
 * Returns null if not cached or returns the cached data
 */
export async function getCachedCardMetadata(
  stacktrackId: string
): Promise<CachedCardMetadata | null> {
  const cacheRef = doc(db, CACHE_COLLECTION, stacktrackId);
  const cached = await getDoc(cacheRef);

  if (!cached.exists()) {
    return null;
  }

  return cached.data() as CachedCardMetadata;
}

/**
 * Check if cached metadata is still fresh
 * Returns true if cached and fresh (< 30 days old)
 */
export async function isCacheFresh(stacktrackId: string): Promise<boolean> {
  const cached = await getCachedCardMetadata(stacktrackId);

  if (!cached?.lastPricingFetch) {
    return false;
  }

  const lastFetchMs = (cached.lastPricingFetch as any).toMillis?.() || 0;
  const ageMs = Date.now() - lastFetchMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays < CACHE_TTL_DAYS;
}

/**
 * Save or update card metadata in cache
 * Include pricing data from external APIs
 */
export async function saveCardToCache(
  metadata: CachedCardMetadata
): Promise<void> {
  const cardID = metadata.cardID || metadata.stacktrackId;
  const stacktrackId = metadata.stacktrackId || cardID;

  const cacheRef = doc(db, CACHE_COLLECTION, stacktrackId);
  const existing = await getDoc(cacheRef);

  const updated: any = {
    ...metadata,
    stacktrackId,
    cardID,
    gameID: metadata.gameID || inferGameID({ sport: metadata.sport, name: metadata.name, brand: metadata.brand }),
    setID: metadata.setID || buildSetID(metadata.setName || metadata.brand),
    lookup: metadata.lookup || buildCardLookup({ name: metadata.name, cardNumber: metadata.cardNumber, setName: metadata.setName || metadata.brand }),
    updatedAt: serverTimestamp(),
  };

  // Only set createdAt on first write
  if (!existing.exists()) {
    updated.createdAt = serverTimestamp();
    updated.scanCount = 1;
  } else {
    const existingData = existing.data() as CachedCardMetadata;
    updated.scanCount = (existingData.scanCount || 1) + 1;
  }

  // Update timestamp for pricing refresh tracking
  if (metadata.pricing?.tcgplayer || metadata.pricing?.pricecharting || metadata.pricing?.ebay) {
    updated.lastPricingFetch = serverTimestamp();
  }

  await setDoc(cacheRef, updated, { merge: true });
}

/**
 * Merge new pricing data into existing cache entry
 */
export async function updateCachePricing(
  stacktrackId: string,
  pricing: CachedCardMetadata["pricing"]
): Promise<void> {
  const cacheRef = doc(db, CACHE_COLLECTION, stacktrackId);

  await updateDoc(cacheRef, {
    pricing,
    lastPricingFetch: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Check if pricing data needs refresh
 * Returns true if pricing is older than TTL
 */
export function isPricingStale(
  lastPricingFetch?: Timestamp | number | null
): boolean {
  if (!lastPricingFetch) {
    return true; // No pricing yet
  }

  const lastFetchMs = typeof lastPricingFetch === "number" 
    ? lastPricingFetch 
    : (lastPricingFetch as any).toMillis?.() || 0;
  
  const ageMs = Date.now() - lastFetchMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays >= CACHE_TTL_DAYS;
}

/**
 * Get cache statistics (for admin dashboard)
 */
export async function getCacheStats(): Promise<CardCacheStats> {
  if (!db) {
    return { totalCached: 0, needsRefresh: 0 };
  }

  // Note: This is a simplified version. In production, you'd use a separate
  // stats collection or query with aggregation
  return {
    totalCached: 0,
    needsRefresh: 0,
    lastRefreshAt: undefined,
  };
}

/**
 * Invalidate cache for a card (force next fetch from APIs)
 */
export async function invalidateCardCache(stacktrackId: string): Promise<void> {
  const cacheRef = doc(db, CACHE_COLLECTION, stacktrackId);
  await updateDoc(cacheRef, {
    lastPricingFetch: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Invalidate all caches (admin operation)
 */
export async function invalidateAllCaches(): Promise<{ invalidated: number }> {
  // Note: This would typically be done with a bulk operation or job
  // For now, return a placeholder
  console.log("invalidateAllCaches() - implement bulk refresh in admin endpoint");
  return { invalidated: 0 };
}
