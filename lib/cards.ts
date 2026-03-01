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
  condition?: string;
  imageUrl?: string;
  photoUrl?: string;
  frontImageUrl?: string;
  thumbnailUrl?: string;
  addedAt?: any;
}

export interface Portfolio {
  userId: string;
  totalCards: number;
  totalValue: number;
  lastUpdated?: any;
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
