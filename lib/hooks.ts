import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  QueryConstraint,
} from "firebase/firestore";

export function useFirestoreData<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, collectionName),
          ...constraints
        );
        const querySnapshot = await getDocs(q);
        const items: T[] = [];
        querySnapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(items);
        setError(null);
      } catch (err) {
        console.error("Error fetching Firestore data:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    if (db) {
      fetchData();
    }
  }, [collectionName]);

  return { data, loading, error };
}

// Generate mock data for development
export function generateMockChartData(days: number = 7) {
  const data = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    data.push({
      name: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.floor(Math.random() * 50000) + 20000,
      trades: Math.floor(Math.random() * 100) + 10,
      earnings: Math.floor(Math.random() * 5000) + 500,
    });
  }

  return data;
}

// Generate mock portfolio data
export function generateMockPortfolioData() {
  return [
    { id: "1", name: "1952 Mickey Mantle", value: 12500, rarity: "Legendary" },
    { id: "2", name: "1957 Ted Williams", value: 8900, rarity: "Rare" },
    { id: "3", name: "1970 Nolan Ryan", value: 6200, rarity: "Rare" },
    { id: "4", name: "1984 Michael Jordan", value: 9800, rarity: "Rare" },
    { id: "5", name: "2000 Tom Brady RC", value: 4500, rarity: "Uncommon" },
  ];
}

// Generate mock market data
export function generateMockMarketData(days: number = 30) {
  const data = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    data.push({
      name: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      avgPrice: Math.floor(Math.random() * 30000) + 5000,
      volume: Math.floor(Math.random() * 500) + 50,
      trend: Math.random() > 0.5 ? 1 : -1,
    });
  }

  return data;
}
