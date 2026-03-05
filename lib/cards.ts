import { db } from "./firebase";
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
  name: string;
  value: number;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
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
  createdAt?: any;
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
    return cards;
  } catch (error) {
    console.error("Error fetching cards:", error);
    return [];
  }
}

// Add new card to collection
export async function addCard(userId: string, card: Omit<Card, "userId" | "id">): Promise<string> {
  if (!db || !userId) throw new Error("Database or user ID missing");
  
  try {
    const docRef = await addDoc(collection(db, "cards"), {
      userId,
      ...card,
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

// Delete card
export async function deleteCard(cardId: string): Promise<void> {
  if (!db || !cardId) throw new Error("Database or card ID missing");
  
  try {
    await deleteDoc(doc(db, "cards", cardId));
  } catch (error) {
    console.error("Error deleting card:", error);
    throw error;
  }
}

// Calculate portfolio stats
export async function calculatePortfolioStats(userId: string) {
  const cards = await getUserCards(userId);
  const totalValue = cards.reduce((sum, card) => sum + (card.value || 0), 0);
  
  return {
    totalCards: cards.length,
    totalValue,
    averageValue: cards.length > 0 ? Math.round(totalValue / cards.length) : 0,
    rarityBreakdown: {
      common: cards.filter(c => c.rarity === "Common").length,
      uncommon: cards.filter(c => c.rarity === "Uncommon").length,
      rare: cards.filter(c => c.rarity === "Rare").length,
      legendary: cards.filter(c => c.rarity === "Legendary").length,
    },
  };
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
        const portfolioStats = await calculatePortfolioStats(user.uid);
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
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating folder:", error);
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
    const cardRef = doc(db, "cards", cardId);
    await updateDoc(cardRef, {
      folderIds: arrayUnion(folderId),
    });
  } catch (error) {
    console.error("Error adding card to folder:", error);
    throw error;
  }
}

// Remove a card from a folder
export async function removeCardFromFolder(cardId: string, folderId: string): Promise<void> {
  if (!db || !cardId || !folderId) throw new Error("Card ID or Folder ID missing");
  
  try {
    const cardRef = doc(db, "cards", cardId);
    await updateDoc(cardRef, {
      folderIds: arrayRemove(folderId),
    });
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
    return cards;
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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

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

  return { folders, loading, error };
}

// ==================== COLLECTION VALUE REFRESH ====================

/**
 * Simulates fetching current market price for a card
 * In production, this would call a real market data API
 */
async function fetchMarketPrice(card: Card): Promise<number> {
  // Simulate market price fluctuation (-5% to +10% of current value)
  const fluctuation = (Math.random() * 0.15) - 0.05; // -5% to +10%
  const newValue = Math.max(1, Math.round(card.value * (1 + fluctuation)));
  
  // Add some realistic price movement based on rarity
  let rarityMultiplier = 1;
  switch (card.rarity) {
    case "Legendary":
      rarityMultiplier = 1.02; // Legendary cards tend to appreciate
      break;
    case "Rare":
      rarityMultiplier = 1.01;
      break;
    case "Common":
      rarityMultiplier = 0.99; // Common cards depreciate slightly
      break;
  }
  
  return Math.round(newValue * rarityMultiplier);
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
      if (newValue !== card.value) {
        await updateDoc(doc(db, "cards", card.id), {
          value: newValue,
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
