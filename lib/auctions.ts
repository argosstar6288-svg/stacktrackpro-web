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
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export interface Auction {
  id?: string;
  userId: string;
  cardName: string;
  cardId?: string;
  startingBid: number;
  currentBid: number;
  highestBidder?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  status: "active" | "ended" | "scheduled";
  createdAt?: Timestamp;
  description?: string;
}

// Add new auction to Firestore
export async function createAuction(
  userId: string,
  auction: Omit<Auction, "userId" | "id" | "currentBid" | "createdAt">
): Promise<string> {
  if (!db || !userId) throw new Error("Database or user ID missing");

  try {
    const docRef = await addDoc(collection(db, "auctions"), {
      userId,
      ...auction,
      currentBid: auction.startingBid,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating auction:", error);
    throw error;
  }
}

// Fetch all active auctions
export async function getActiveAuctions(): Promise<Auction[]> {
  if (!db) return [];

  try {
    const q = query(
      collection(db, "auctions"),
      where("status", "==", "active")
    );
    const querySnapshot = await getDocs(q);
    const auctions: Auction[] = [];
    querySnapshot.forEach((doc) => {
      auctions.push({
        id: doc.id,
        ...doc.data(),
      } as Auction);
    });
    return auctions;
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return [];
  }
}

// Fetch user's auctions
export async function getUserAuctions(userId: string): Promise<Auction[]> {
  if (!db || !userId) return [];

  try {
    const q = query(
      collection(db, "auctions"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const auctions: Auction[] = [];
    querySnapshot.forEach((doc) => {
      auctions.push({
        id: doc.id,
        ...doc.data(),
      } as Auction);
    });
    return auctions;
  } catch (error) {
    console.error("Error fetching user auctions:", error);
    return [];
  }
}

// Update auction (place bid, end auction, etc)
export async function updateAuction(
  auctionId: string,
  updates: Partial<Auction>
): Promise<void> {
  if (!db || !auctionId) throw new Error("Database or auction ID missing");

  try {
    await updateDoc(doc(db, "auctions", auctionId), updates);
  } catch (error) {
    console.error("Error updating auction:", error);
    throw error;
  }
}

// Delete auction
export async function deleteAuction(auctionId: string): Promise<void> {
  if (!db || !auctionId) throw new Error("Database or auction ID missing");

  try {
    await deleteDoc(doc(db, "auctions", auctionId));
  } catch (error) {
    console.error("Error deleting auction:", error);
    throw error;
  }
}

// Hook to fetch active auctions in real-time
export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, "auctions"),
        where("status", "==", "active")
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const auctionList: Auction[] = [];
        querySnapshot.forEach((doc) => {
          auctionList.push({
            id: doc.id,
            ...doc.data(),
          } as Auction);
        });
        setAuctions(auctionList);
        setError(null);
      });

      setLoading(false);
      return () => unsubscribe();
    } catch (err) {
      console.error("Error subscribing to auctions:", err);
      setError(err instanceof Error ? err.message : "Failed to load auctions");
      setLoading(false);
    }
  }, []);

  return { auctions, loading, error };
}

// Hook to fetch user's auctions in real-time
export function useUserAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!db) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const q = query(
          collection(db, "auctions"),
          where("userId", "==", user.uid)
        );

        const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
          const auctionList: Auction[] = [];
          querySnapshot.forEach((doc) => {
            auctionList.push({
              id: doc.id,
              ...doc.data(),
            } as Auction);
          });
          setAuctions(auctionList);
          setError(null);
        });

        setLoading(false);
        return () => unsubscribeSnapshot();
      } catch (err) {
        console.error("Error subscribing to user auctions:", err);
        setError(err instanceof Error ? err.message : "Failed to load auctions");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return { auctions, loading, error };
}
