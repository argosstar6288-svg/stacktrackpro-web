"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "./firebase";
import { useCurrentUser } from "./useCurrentUser";

export interface Card {
  id: string;
  userId: string;
  name: string;
  player: string;
  sport: "Baseball" | "Basketball" | "Football" | "Hockey" | "Soccer" | "Other";
  brand: string;
  year: number;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
  condition: "Poor" | "Fair" | "Good" | "Excellent" | "Mint";
  value: number;
  imageUrl?: string;
  photoUrl?: string;
  frontImageUrl?: string;
  thumbnailUrl?: string;
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
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Card));
      setCards(data);
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

  const cardsQuery = query(
    collection(db, "cards"),
    where("userId", "==", userId),
    where("folderIds", "array-contains", folderId)
  );
  const snapshot = await getDocs(cardsQuery);

  return snapshot.docs.map((cardDoc) => ({
    id: cardDoc.id,
    ...cardDoc.data(),
  } as Card));
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
