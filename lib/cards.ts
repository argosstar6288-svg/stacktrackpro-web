import { db } from "./firebase";
import { buildCardLookup, buildMasterCardID, buildSetID, inferGameID, type StackTrackGameID } from "./cardSchema";
import { fetchPriceChartingValue } from "./pricecharting";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  QueryConstraint,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

export interface Card {
  id?: string;
  userId: string;
  cardID?: string;
  gameID?: StackTrackGameID;
  setID?: string;
  lookup?: string;
  name: string;
  value: number;
  marketPrice?: number; // Current market price from PriceCharting
  priceLastUpdated?: string; // ISO date string of last price fetch
  predicted30DayValue?: number;
  rarityTier?: "Ultra Rare" | "Rare" | "Common";
  populationCount?: number;
  supplyCount?: number;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
   variant?: "normal" | "holofoil" | "reverse-holo" | "first-edition" | "shadowless"; // Card variant type
  sport?: string;
  year?: number;
  player?: string;
  brand?: string;
  cardNumber?: string;
  condition?: string;
  imageUrl?: string;
  photoUrl?: string;
  frontImageUrl?: string;
  thumbnailUrl?: string;
  folderIds?: string[]; // Array of folder IDs this card belongs to
  addedAt?: any;
}

export interface Portfolio {
  userId: string;
  totalCards: number;
  totalValue: number;
  lastUpdated?: any;
}

export interface Folder {
  id?: string;
  name: string;
  userId: string;
  isPublic?: boolean;
  createdAt?: any;
}

function normalizeKeyPart(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildCardDedupKey(card: Card): string {
  if (card.cardID) return `cardid:${normalizeKeyPart(card.cardID)}`;
  if (card.lookup) return `lookup:${normalizeKeyPart(card.lookup)}`;

  return [
    normalizeKeyPart(card.name),
    normalizeKeyPart(card.cardNumber),
    normalizeKeyPart(card.brand),
    normalizeKeyPart(card.year),
    normalizeKeyPart(card.condition),
    normalizeKeyPart(card.variant),
  ].join("|");
}

function scoreCardForDedup(card: Card): number {
  let score = 0;
  if (card.imageUrl || card.photoUrl || card.frontImageUrl || card.thumbnailUrl) score += 4;
  if (card.marketPrice != null) score += 2;
  if (card.value != null) score += 2;
  if (card.cardNumber) score += 1;
  if (card.brand) score += 1;
  if (card.year) score += 1;
  return score;
}

export function dedupeCards(cards: Card[]): Card[] {
  const bestByKey = new Map<string, Card>();

  for (const card of cards) {
    const key = buildCardDedupKey(card);
    const existing = bestByKey.get(key);

    if (!existing) {
      bestByKey.set(key, card);
      continue;
    }

    const existingScore = scoreCardForDedup(existing);
    const nextScore = scoreCardForDedup(card);

    if (nextScore > existingScore) {
      bestByKey.set(key, card);
      continue;
    }

    if (nextScore === existingScore) {
      const existingTime = existing.addedAt?.seconds || 0;
      const nextTime = card.addedAt?.seconds || 0;
      if (nextTime > existingTime) {
        bestByKey.set(key, card);
      }
    }
  }

  return Array.from(bestByKey.values());
}

// Fetch user's card collection
export async function getUserCards(userId: string): Promise<Card[]> {
  if (!db || !userId) return [];
  
  try {
    const q = query(
      collection(db, "cards"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const cards: Card[] = [];
    querySnapshot.forEach((doc) => {
      cards.push({
        id: doc.id,
        ...doc.data(),
      } as Card);
    });
    return dedupeCards(cards);
  } catch (error) {
    console.error("Error fetching cards:", error);
    return [];
  }
}

// Add new card to collection
export async function addCard(userId: string, card: Omit<Card, "userId" | "id">): Promise<string> {
  if (!db || !userId) throw new Error("Database or user ID missing");
  
  try {
    const gameID = card.gameID || inferGameID({ sport: card.sport, name: card.name, brand: card.brand });
    const setID = card.setID || buildSetID(card.brand);
    const cardID = card.cardID || buildMasterCardID({
      gameID,
      setID,
      number: card.cardNumber,
      name: card.name,
    });
    const lookup = card.lookup || buildCardLookup({
      name: card.name,
      cardNumber: card.cardNumber,
      setName: card.brand,
    });

    const docRef = await addDoc(collection(db, "cards"), {
      userId,
      ...card,
      cardID,
      gameID,
      setID,
      lookup,
      addedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding card:", error);
    throw error;
  }
}

// Update card value
export async function updateCard(cardId: string, updates: Partial<Card>): Promise<void> {
  if (!db || !cardId) throw new Error("Database or card ID missing");
  
  try {
    await updateDoc(doc(db, "cards", cardId), updates);
  } catch (error) {
    console.error("Error updating card:", error);
    throw error;
  }
}


// Delete card and remove from marketplace/auctions
export async function deleteCard(cardId: string): Promise<void> {
  if (!db || !cardId) throw new Error("Database or card ID missing");
  
  try {
    // Delete marketplace listings with this card
    const marketplaceQuery = query(
      collection(db, "marketplace"),
      where("cardId", "==", cardId)
    );
    const marketplaceDocs = await getDocs(marketplaceQuery);
    const marketplaceDeletePromises = marketplaceDocs.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    // Delete auctions with this card
    const auctionsQuery = query(
      collection(db, "auctions"),
      where("cardId", "==", cardId)
    );
    const auctionDocs = await getDocs(auctionsQuery);
    const auctionDeletePromises = auctionDocs.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    // Execute all delete operations in parallel
    await Promise.all([
      ...marketplaceDeletePromises,
      ...auctionDeletePromises,
      deleteDoc(doc(db, "cards", cardId)),
    ]);
  } catch (error) {
    console.error("Error deleting card:", error);
    throw error;
  }
}
// Calculate portfolio stats
export function calculatePortfolioStats(cards: Card[]) {
  const totalValue = cards.reduce((sum, card) => sum + Number((card as any).marketPrice ?? card.value ?? 0), 0);
  const highestValue = cards.length > 0 ? Math.max(...cards.map(card => Number((card as any).marketPrice ?? card.value ?? 0))) : 0;
  
  return {
    cardCount: cards.length,
    totalValue,
    averageValue: cards.length > 0 ? Math.round(totalValue / cards.length) : 0,
    highestValue,
    rarityBreakdown: {
      common: cards.filter(c => c.rarity === "Common").length,
      uncommon: cards.filter(c => c.rarity === "Uncommon").length,
      rare: cards.filter(c => c.rarity === "Rare").length,
      legendary: cards.filter(c => c.rarity === "Legendary").length,
    },
  };
}

// Async version for backward compatibility
export async function calculatePortfolioStatsAsync(userId: string) {
  const cards = await getUserCards(userId);
  return calculatePortfolioStats(cards);
}

// Hook to fetch user cards
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useUserCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setLoading(true);
        const userCards = await getUserCards(user.uid);
        setCards(userCards);
        setError(null);
      } catch (err) {
        console.error("Error loading cards:", err);
        setError(err instanceof Error ? err.message : "Failed to load cards");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return { cards, loading, error };
}

// Hook to fetch portfolio stats
export function usePortfolioStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setLoading(true);
        const portfolioStats = await calculatePortfolioStatsAsync(user.uid);
        setStats(portfolioStats);
        setError(null);
      } catch (err) {
        console.error("Error loading stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return { stats, loading, error };
}

// ==================== FOLDER FUNCTIONS ====================

// Create a new folder
export async function createFolder(userId: string, name: string): Promise<string> {
  if (!db || !userId || !name.trim()) throw new Error("Missing required fields");
  
  try {
    const docRef = await addDoc(collection(db, "folders"), {
      name: name.trim(),
      userId,
      isPublic: false,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

// Update a folder's visibility
export async function updateFolderVisibility(folderId: string, isPublic: boolean): Promise<void> {
  if (!db || !folderId) throw new Error("Folder ID missing");

  try {
    await updateDoc(doc(db, "folders", folderId), {
      isPublic,
    });
  } catch (error) {
    console.error("Error updating folder visibility:", error);
    throw error;
  }
}

// Get all folders for a user
export async function getUserFolders(userId: string): Promise<Folder[]> {
  if (!db || !userId) return [];
  
  try {
    const q = query(
      collection(db, "folders"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const folders: Folder[] = [];
    querySnapshot.forEach((doc) => {
      folders.push({
        id: doc.id,
        ...doc.data(),
      } as Folder);
    });
    return folders;
  } catch (error) {
    console.error("Error fetching folders:", error);
    return [];
  }
}

// Delete a folder (does NOT delete cards, just the folder)
export async function deleteFolder(folderId: string): Promise<void> {
  if (!db || !folderId) throw new Error("Folder ID missing");
  
  try {
    await deleteDoc(doc(db, "folders", folderId));
  } catch (error) {
    console.error("Error deleting folder:", error);
    throw error;
  }
}

// Add a card to a folder
export async function addCardToFolder(cardId: string, folderId: string): Promise<void> {
  if (!db || !cardId || !folderId) throw new Error("Card ID or Folder ID missing");

  try {
    const results = await Promise.allSettled([
      updateDoc(doc(db, "cards", cardId), {
        folderIds: arrayUnion(folderId),
      }),
      updateDoc(doc(db, "userCards", cardId), {
        folder: folderId,
        folderID: folderId,
        updatedAt: serverTimestamp(),
      }),
    ]);

    if (results.every((result) => result.status === "rejected")) {
      throw new Error("Failed to add card to folder");
    }
  } catch (error) {
    console.error("Error adding card to folder:", error);
    throw error;
  }
}

// Remove a card from a folder
export async function removeCardFromFolder(cardId: string, folderId: string): Promise<void> {
  if (!db || !cardId || !folderId) throw new Error("Card ID or Folder ID missing");

  try {
    const results = await Promise.allSettled([
      updateDoc(doc(db, "cards", cardId), {
        folderIds: arrayRemove(folderId),
      }),
      updateDoc(doc(db, "userCards", cardId), {
        folder: "",
        folderID: "",
        updatedAt: serverTimestamp(),
      }),
    ]);

    if (results.every((result) => result.status === "rejected")) {
      throw new Error("Failed to remove card from folder");
    }
  } catch (error) {
    console.error("Error removing card from folder:", error);
    throw error;
  }
}

// Get cards in a specific folder
export async function getCardsInFolder(folderId: string, userId: string): Promise<Card[]> {
  if (!db || !folderId || !userId) return [];
  
  try {
    const q = query(
      collection(db, "cards"),
      where("userId", "==", userId),
      where("folderIds", "array-contains", folderId)
    );
    const querySnapshot = await getDocs(q);
    const cards: Card[] = [];
    querySnapshot.forEach((doc) => {
      cards.push({
        id: doc.id,
        ...doc.data(),
      } as Card);
    });
    return dedupeCards(cards);
  } catch (error) {
    console.error("Error fetching cards in folder:", error);
    return [];
  }
}

// Hook to fetch user folders
export function useUserFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  const refreshFolders = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      const userFolders = await getUserFolders(currentUserId);
      setFolders(userFolders);
      setError(null);
    } catch (err) {
      console.error("Error loading folders:", err);
      setError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.uid);

      try {
        setLoading(true);
        const userFolders = await getUserFolders(user.uid);
        setFolders(userFolders);
        setError(null);
      } catch (err) {
        console.error("Error loading folders:", err);
        setError(err instanceof Error ? err.message : "Failed to load folders");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return { folders, loading, error, refreshFolders };
}

// ==================== COLLECTION VALUE REFRESH ====================

/**
 * Fetch the latest PriceCharting market value for a card.
 * Values are stored in USD and converted to CAD at display time.
 */
async function fetchMarketPrice(card: Card): Promise<number> {
  const livePrice = await fetchPriceChartingValue({
    name: card.name,
    player: card.player,
    year: card.year,
    brand: card.brand,
    sport: card.sport,
    game: card.gameID,
    condition: card.condition,
  });

  if (typeof livePrice === "number" && livePrice > 0) {
    return Number(livePrice.toFixed(2));
  }

  return Number(card.marketPrice ?? card.value ?? 0);
}

/**
 * Refresh collection values for a specific user
 */
export async function refreshUserCollectionValues(userId: string): Promise<{
  updatedCards: number;
  totalValue: number;
}> {
  if (!db || !userId) throw new Error("Database or user ID missing");
  
  try {
    const cards = await getUserCards(userId);
    let updatedCards = 0;
    let totalValue = 0;

    // Update each card with new market value
    for (const card of cards) {
      if (!card.id) continue;
      
      const newValue = await fetchMarketPrice(card);
      
      // Only update if value changed
      if (newValue !== Number(card.marketPrice ?? card.value ?? 0)) {
        await updateDoc(doc(db, "cards", card.id), {
          value: newValue,
          marketPrice: newValue,
          priceSource: "pricecharting",
          priceLastUpdated: new Date().toISOString(),
          lastValueUpdate: serverTimestamp(),
        });
        updatedCards++;
      }
      
      totalValue += newValue;
    }

    // Update user's portfolio metadata
    const portfolioRef = doc(db, "portfolios", userId);
    await updateDoc(portfolioRef, {
      lastRefresh: serverTimestamp(),
      totalValue,
      totalCards: cards.length,
    }).catch(async (error) => {
      // If portfolio doesn't exist, create it
      if (error.code === 'not-found') {
        await addDoc(collection(db, "portfolios"), {
          userId,
          lastRefresh: serverTimestamp(),
          totalValue,
          totalCards: cards.length,
        });
      }
    });

    console.log(`Refreshed ${updatedCards} cards for user ${userId}`);
    return { updatedCards, totalValue };
  } catch (error) {
    console.error("Error refreshing user collection values:", error);
    throw error;
  }
}

/**
 * Refresh collection values for all users
 * Use cautiously - can be expensive for large user bases
 */
export async function refreshAllUserCollectionValues(): Promise<{
  totalUsers: number;
  totalCardsUpdated: number;
}> {
  if (!db) throw new Error("Database not initialized");
  
  try {
    // Get all unique user IDs from cards collection
    const cardsSnapshot = await getDocs(collection(db, "cards"));
    const userIds = new Set<string>();
    
    cardsSnapshot.forEach((doc) => {
      const card = doc.data() as Card;
      if (card.userId) {
        userIds.add(card.userId);
      }
    });

    let totalCardsUpdated = 0;

    // Refresh each user's collection
    for (const userId of Array.from(userIds)) {
      try {
        const result = await refreshUserCollectionValues(userId);
        totalCardsUpdated += result.updatedCards;
      } catch (error) {
        console.error(`Failed to refresh collection for user ${userId}:`, error);
        // Continue with other users even if one fails
      }
    }

    console.log(`Refreshed collections for ${userIds.size} users, updated ${totalCardsUpdated} cards`);
    return {
      totalUsers: userIds.size,
      totalCardsUpdated,
    };
  } catch (error) {
    console.error("Error refreshing all collection values:", error);
    throw error;
  }
}

/**
 * Get last refresh time for a user's collection
 */
export async function getLastRefreshTime(userId: string): Promise<Date | null> {
  if (!db || !userId) return null;
  
  try {
    const portfolioSnapshot = await getDocs(
      query(collection(db, "portfolios"), where("userId", "==", userId))
    );
    
    if (portfolioSnapshot.empty) return null;
    
    const portfolioData = portfolioSnapshot.docs[0].data();
    return portfolioData.lastRefresh?.toDate() || null;
  } catch (error) {
    console.error("Error getting last refresh time:", error);
    return null;
  }
}

/**
 * Check if collection needs refresh (older than 24 hours)
 */
export async function needsRefresh(userId: string): Promise<boolean> {
  const lastRefresh = await getLastRefreshTime(userId);
  
  if (!lastRefresh) return true; // Never refreshed
  
  const hoursSinceRefresh = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60);
  return hoursSinceRefresh >= 24;
}
