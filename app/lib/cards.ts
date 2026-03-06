"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, arrayUnion, arrayRemove } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "./firebase";
import { useCurrentUser } from "./useCurrentUser";

export interface Card {
  id: string;
  userId: string;
  name: string;
  player: string;
  cardNumber?: string; // e.g., "054/112" or "001" for card identification
  sport: "Baseball" | "Basketball" | "Football" | "Hockey" | "Soccer" | "Other";
  brand: string;
  year: number;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
  condition: "Poor" | "Fair" | "Good" | "Excellent" | "Mint";
  value: number;
  marketPrice?: number; // Current market price from PriceCharting
  priceLastUpdated?: string; // ISO date string of last price fetch
  imageUrl?: string;
  photoUrl?: string;
  frontImageUrl?: string;
  thumbnailUrl?: string;
  cardImage?: string;
  image?: string;
  imagePath?: string;
  notes?: string;
  folderId?: string;
  folderIds?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface Folder {
  id?: string;
  name: string;
  userId: string;
  createdAt?: any;
}

function isRenderableImageUrl(value?: string): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();

  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("firebasestorage.googleapis.com/") ||
    trimmed.startsWith("storage.googleapis.com/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  );
}

function normalizeRenderableImageUrl(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (
    trimmed.startsWith("firebasestorage.googleapis.com/") ||
    trimmed.startsWith("storage.googleapis.com/")
  ) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function isStorageReference(value?: string): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();

  return (
    trimmed.startsWith("gs://") ||
    trimmed.startsWith("cards/") ||
    trimmed.startsWith("uploads/") ||
    trimmed.includes("%2F") ||
    (!trimmed.startsWith("http") && trimmed.includes("/"))
  );
}

function extractStoragePath(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.startsWith("gs://")) {
    return trimmed;
  }

  if (trimmed.startsWith("cards/") || trimmed.startsWith("uploads/")) {
    return trimmed;
  }

  const decoded = decodeURIComponent(trimmed);
  if (decoded.startsWith("cards/") || decoded.startsWith("uploads/")) {
    return decoded;
  }

  const candidateUrl =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : trimmed.startsWith("firebasestorage.googleapis.com/") || trimmed.startsWith("storage.googleapis.com/")
      ? `https://${trimmed}`
      : null;

  if (!candidateUrl) {
    return null;
  }

  try {
    const url = new URL(candidateUrl);
    const decodedPath = decodeURIComponent(url.pathname);
    const objectMatch = decodedPath.match(/\/o\/([^/].*)$/);
    if (!objectMatch?.[1]) {
      return null;
    }

    return objectMatch[1];
  } catch {
    return null;
  }
}

async function resolveStorageImageUrl(value?: string): Promise<string | null> {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isRenderableImageUrl(trimmed)) return normalizeRenderableImageUrl(trimmed);
  if (!isStorageReference(trimmed)) return null;

  const storagePath = extractStoragePath(trimmed);
  if (!storagePath) return null;

  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

async function normalizeCardImage(card: Card): Promise<Card> {
  try {
    const imageCandidates = [
      card.imageUrl,
      card.photoUrl,
      card.frontImageUrl,
      card.thumbnailUrl,
      card.cardImage,
      card.image,
      card.imagePath,
    ];

    for (const candidate of imageCandidates) {
      try {
        const resolved = await Promise.race([
          resolveStorageImageUrl(candidate),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)) // 5 sec timeout
        ]);
        if (resolved) {
          return {
            ...card,
            imageUrl: resolved,
          };
        }
      } catch (err) {
        // Continue to next candidate
        continue;
      }
    }

    return card;
  } catch (err) {
    console.error("[normalizeCardImage] Error normalizing card:", card.id, err);
    return card;
  }
}

export function useUserCards() {
  const { user } = useCurrentUser();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "cards"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      void (async () => {
        try {
          const rawCards = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Card));

          const normalizedCards = await Promise.allSettled(
            rawCards.map((card) => normalizeCardImage(card))
          );
          
          const successfulCards = normalizedCards
            .filter((result) => result.status === "fulfilled")
            .map((result) => (result as PromiseFulfilledResult<Card>).value);
          
          setCards(successfulCards);
          setLoading(false);
        } catch (error) {
          console.error("[useUserCards] Error loading cards:", error);
          setCards([]);
          setLoading(false);
        }
      })();
    }, (error) => {
      console.error("[useUserCards] Snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { cards, loading };
}

// Create a new card
export async function createCard(userId: string, card: Omit<Card, "id" | "userId" | "createdAt" | "updatedAt">) {
  const docRef = await addDoc(collection(db, "cards"), {
    ...card,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// Update a card
export async function updateCard(cardId: string, updates: Partial<Card>) {
  const cardRef = doc(db, "cards", cardId);
  await updateDoc(cardRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Delete a card
export async function deleteCard(cardId: string) {
  const cardRef = doc(db, "cards", cardId);
  await deleteDoc(cardRef);
}

// Calculate portfolio value
export function calculatePortfolioValue(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.value, 0);
}

// Calculate portfolio stats
export function calculatePortfolioStats(cards: Card[]) {
  const totalValue = calculatePortfolioValue(cards);
  const avgValue = cards.length > 0 ? Math.floor(totalValue / cards.length) : 0;
  const highestValue = cards.length > 0 ? Math.max(...cards.map(c => c.value)) : 0;
  
  const sportBreakdown = cards.reduce((acc: Record<string, number>, card) => {
    acc[card.sport] = (acc[card.sport] || 0) + 1;
    return acc;
  }, {});

  const rarityBreakdown = cards.reduce((acc: Record<string, number>, card) => {
    acc[card.rarity] = (acc[card.rarity] || 0) + 1;
    return acc;
  }, {});

  return {
    totalValue,
    averageValue: avgValue,
    highestValue,
    cardCount: cards.length,
    sportBreakdown,
    rarityBreakdown,
  };
}

export async function createFolder(userId: string, name: string): Promise<string> {
  const trimmedName = name.trim();
  if (!userId || !trimmedName) throw new Error("Missing required fields");

  const folderRef = await addDoc(collection(db, "folders"), {
    name: trimmedName,
    userId,
    createdAt: serverTimestamp(),
  });

  return folderRef.id;
}

export async function getUserFolders(userId: string): Promise<Folder[]> {
  if (!userId) return [];

  const foldersQuery = query(collection(db, "folders"), where("userId", "==", userId));
  const snapshot = await getDocs(foldersQuery);

  return snapshot.docs.map((folderDoc) => ({
    id: folderDoc.id,
    ...folderDoc.data(),
  } as Folder));
}

export async function deleteFolder(folderId: string): Promise<void> {
  if (!folderId) throw new Error("Folder ID missing");

  await deleteDoc(doc(db, "folders", folderId));
}

export async function addCardToFolder(cardId: string, folderId: string): Promise<void> {
  if (!cardId || !folderId) throw new Error("Card ID or Folder ID missing");

  await updateDoc(doc(db, "cards", cardId), {
    folderIds: arrayUnion(folderId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeCardFromFolder(cardId: string, folderId: string): Promise<void> {
  if (!cardId || !folderId) throw new Error("Card ID or Folder ID missing");

  await updateDoc(doc(db, "cards", cardId), {
    folderIds: arrayRemove(folderId),
    updatedAt: serverTimestamp(),
  });
}

export async function getCardsInFolder(folderId: string, userId: string): Promise<Card[]> {
  if (!folderId || !userId) return [];

  try {
    const cardsQuery = query(
      collection(db, "cards"),
      where("userId", "==", userId),
      where("folderIds", "array-contains", folderId)
    );
    const snapshot = await getDocs(cardsQuery);

    const cards = snapshot.docs.map((cardDoc) => ({
      id: cardDoc.id,
      ...cardDoc.data(),
    } as Card));

    const normalizedCards = await Promise.allSettled(
      cards.map((card) => normalizeCardImage(card))
    );

    return normalizedCards
      .filter((result) => result.status === "fulfilled")
      .map((result) => (result as PromiseFulfilledResult<Card>).value);
  } catch (error) {
    console.error("[getCardsInFolder] Error loading cards:", error);
    return [];
  }
}

export function useUserFolders() {
  const { user } = useCurrentUser();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFolders([]);
      setLoading(false);
      return;
    }

    const foldersQuery = query(collection(db, "folders"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(foldersQuery, (snapshot) => {
      const nextFolders = snapshot.docs.map((folderDoc) => ({
        id: folderDoc.id,
        ...folderDoc.data(),
      } as Folder));
      setFolders(nextFolders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { folders, loading };
}

// ==================== COLLECTION VALUE REFRESH ====================

/**
 * Simulates fetching current market price for a card
 * In production, this would call a real market data API
 */
async function fetchMarketPrice(card: Card): Promise<number> {
  const currentValue = Number(card.value);
  const safeCurrentValue = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : 1;

  // Simulate market price fluctuation (-5% to +10% of current value)
  const fluctuation = (Math.random() * 0.15) - 0.05; // -5% to +10%
  const newValue = Math.max(1, Math.round(safeCurrentValue * (1 + fluctuation)));
  
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
 * Get user cards by userId (not using hook)
 */
export async function getUserCards(userId: string): Promise<Card[]> {
  if (!userId) return [];

  const cardsQuery = query(collection(db, "cards"), where("userId", "==", userId));
  const snapshot = await getDocs(cardsQuery);

  return snapshot.docs.map((cardDoc) => ({
    id: cardDoc.id,
    ...cardDoc.data(),
  } as Card));
}

/**
 * Refresh collection values for a specific user
 */
export async function refreshUserCollectionValues(userId: string): Promise<{
  updatedCards: number;
  totalValue: number;
}> {
  if (!userId) throw new Error("User ID missing");
  
  try {
    const cards = await getUserCards(userId);
    let updatedCards = 0;
    let totalValue = 0;

    // Update each card with new market value
    for (const card of cards) {
      if (!card.id) continue;
      
      const newValue = await fetchMarketPrice(card);
      const currentValue = Number(card.value);
      const safeCurrentValue = Number.isFinite(currentValue) ? currentValue : 0;
      
      // Only update if value changed
      if (newValue !== safeCurrentValue) {
        try {
          await updateDoc(doc(db, "cards", card.id), {
            value: newValue,
            updatedAt: serverTimestamp(),
          });
          updatedCards++;
        } catch (cardUpdateError) {
          console.error(`Failed to update card ${card.id}:`, cardUpdateError);
          // Continue processing other cards instead of failing entire refresh
        }
      }
      
      totalValue += newValue;
    }

    // Update or create user's portfolio metadata (best effort)
    try {
      const portfoliosQuery = query(collection(db, "portfolios"), where("userId", "==", userId));
      const portfolioSnapshot = await getDocs(portfoliosQuery);

      if (portfolioSnapshot.empty) {
        await addDoc(collection(db, "portfolios"), {
          userId,
          lastRefresh: serverTimestamp(),
          totalValue,
          totalCards: cards.length,
        });
      } else {
        const portfolioDoc = portfolioSnapshot.docs[0];
        await updateDoc(doc(db, "portfolios", portfolioDoc.id), {
          lastRefresh: serverTimestamp(),
          totalValue,
          totalCards: cards.length,
        });
      }
    } catch (portfolioError) {
      console.error("Portfolio metadata update skipped:", portfolioError);
    }

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
  try {
    // Get all unique user IDs from cards collection
    const cardsSnapshot = await getDocs(collection(db, "cards"));
    const userIds = new Set<string>();
    
    cardsSnapshot.forEach((cardDoc) => {
      const card = cardDoc.data() as Card;
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
  if (!userId) return null;
  
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
