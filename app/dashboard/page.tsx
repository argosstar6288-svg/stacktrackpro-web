"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import AuctionPreview from "../../components/dashboard/AuctionPreview";
import CardGrid from "../../components/CardGrid";
import CollectionGrid from "../../components/dashboard/CollectionGrid";
import MarketplacePreview from "../../components/dashboard/MarketplacePreview";
import MarketMovers from "../../components/dashboard/MarketMovers";
import PortfolioValue from "../../components/dashboard/PortfolioValue";
import RecentScans from "../../components/dashboard/RecentScans";
import Watchlist from "../../components/dashboard/Watchlist";
import { getUserCards, getUserFolders, type Card, type Folder } from "../../lib/cards";
import { FLAT_COLLECTIONS, type FlatMasterCard, type FlatUserCard } from "../../lib/flatCollections";
import { db } from "../../lib/firebase";
import { useCurrentUser } from "../../lib/useCurrentUser";

interface MarketplaceListing {
  id: string;
  cardName?: string;
  price?: number;
  status?: string;
  createdAt?: any;
}

interface AuctionItem {
  id: string;
  cardName?: string;
  currentBid?: number;
  bidCount?: number;
  endTime?: any;
}

interface WatchlistItem {
  id: string;
  cardID?: string;
  auctionTitle?: string;
  currentPrice?: number;
  deleted?: boolean;
  addedAt?: any;
}

interface FlatCollectionFolder {
  id: string;
  userID?: string;
  name?: string;
  created?: any;
}

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const loadMasterCardsByIds = async (cardIds: string[]) => {
  const uniqueCardIds = Array.from(new Set(cardIds.filter(Boolean)));
  const masterByCardId = new Map<string, FlatMasterCard>();

  for (const chunk of chunkArray(uniqueCardIds, 10)) {
    const byDocIdQuery = query(
      collection(db, FLAT_COLLECTIONS.cards),
      where(documentId(), "in", chunk)
    );
    const snapshot = await getDocs(byDocIdQuery);

    snapshot.docs.forEach((docSnapshot) => {
      const data = { id: docSnapshot.id, ...docSnapshot.data() } as FlatMasterCard;
      const resolvedCardID = String(data.cardID || docSnapshot.id);
      masterByCardId.set(resolvedCardID, data);
    });
  }

  const unresolved = uniqueCardIds.filter((cardId) => !masterByCardId.has(cardId));
  for (const chunk of chunkArray(unresolved, 10)) {
    const byCardIdQuery = query(
      collection(db, FLAT_COLLECTIONS.cards),
      where("cardID", "in", chunk)
    );
    const snapshot = await getDocs(byCardIdQuery);

    snapshot.docs.forEach((docSnapshot) => {
      const data = { id: docSnapshot.id, ...docSnapshot.data() } as FlatMasterCard;
      const resolvedCardID = String(data.cardID || docSnapshot.id);
      masterByCardId.set(resolvedCardID, data);
    });
  }

  return masterByCardId;
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.uid) {
        setCards([]);
        setFolders([]);
        setMarketplaceListings([]);
        setAuctionItems([]);
        setWatchlistItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userCardsQuery = query(
          collection(db, FLAT_COLLECTIONS.userCards),
          where("userID", "==", user.uid),
          orderBy("added", "desc"),
          limit(200)
        );

        const collectionsQuery = query(
          collection(db, FLAT_COLLECTIONS.collections),
          where("userID", "==", user.uid),
          limit(30)
        );

        const marketListingsQuery = query(
          collection(db, FLAT_COLLECTIONS.marketListings),
          where("status", "==", "active"),
          orderBy("created", "desc"),
          limit(3)
        );

        const auctionsLiveQuery = query(
          collection(db, FLAT_COLLECTIONS.auctions),
          where("status", "==", "live"),
          orderBy("endTime", "asc"),
          limit(3)
        );

        const watchlistsQuery = query(
          collection(db, FLAT_COLLECTIONS.watchlists),
          where("userID", "==", user.uid),
          orderBy("addedAt", "desc"),
          limit(3)
        );

        let normalizedCards: Card[] = [];
        let normalizedFolders: Folder[] = [];
        let normalizedMarketplace: MarketplaceListing[] = [];
        let normalizedAuctions: AuctionItem[] = [];
        let normalizedWatchlist: WatchlistItem[] = [];

        try {
          const [userCardsSnap, collectionsSnap, marketListingsSnap, auctionsLiveSnap, watchlistsSnap] =
            await Promise.all([
              getDocs(userCardsQuery),
              getDocs(collectionsQuery),
              getDocs(marketListingsQuery),
              getDocs(auctionsLiveQuery),
              getDocs(watchlistsQuery),
            ]);

          const userCardsData = userCardsSnap.docs.map(
            (snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as FlatUserCard
          );

          const cardIds = Array.from(
            new Set(userCardsData.map((record) => record.cardID).filter(Boolean))
          ) as string[];

          const masterById = await loadMasterCardsByIds(cardIds);

          normalizedCards = userCardsData.map((entry) => {
            const master = masterById.get(entry.cardID) || null;

            return {
              id: entry.id || entry.cardID,
              userId: entry.userID,
              name: master?.name || "Unnamed card",
              player: "",
              cardNumber: master?.number || "",
              sport: "Other",
              brand: master?.set || "",
              year: Number(master?.year || new Date().getFullYear()),
              rarity: "Uncommon",
              condition: (entry.condition as Card["condition"]) || "Good",
              value: Number(entry.value ?? master?.avgPrice ?? 0),
              marketPrice: Number(master?.avgPrice ?? entry.value ?? 0),
              imageUrl: master?.image,
              photoUrl: master?.image,
              folderId: entry.folder,
              folderIds: entry.folder ? [entry.folder] : [],
              createdAt: entry.added,
              updatedAt: entry.added,
            };
          });

          normalizedFolders = collectionsSnap.docs.map((snapshot) => {
            const data = snapshot.data() as FlatCollectionFolder;
            return {
              id: snapshot.id,
              name: data.name || "Collection",
              userId: data.userID || user.uid,
              createdAt: data.created,
            } as Folder;
          });

          normalizedMarketplace = marketListingsSnap.docs.map((snapshot) => {
            const data = snapshot.data() as any;
            return {
              id: snapshot.id,
              cardName: data.cardName || data.name || data.cardID,
              price: Number(data.price || 0),
              status: data.status,
              createdAt: data.created,
            } as MarketplaceListing;
          });

          normalizedAuctions = auctionsLiveSnap.docs.map((snapshot) => ({
            id: snapshot.id,
            ...(snapshot.data() as any),
          })) as AuctionItem[];

          normalizedWatchlist = watchlistsSnap.docs
            .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }) as WatchlistItem)
            .filter((item) => !item.deleted);
        } catch (flatError) {
          console.warn("Flat schema read failed, falling back to legacy collections:", flatError);

          const legacyMarketplaceQuery = query(
            collection(db, "marketplace"),
            where("status", "==", "active"),
            orderBy("createdAt", "desc"),
            limit(3)
          );

          const legacyAuctionsQuery = query(
            collection(db, "auctions"),
            where("ended", "==", false),
            orderBy("endTime", "asc"),
            limit(3)
          );

          const legacyWatchlistQuery = query(
            collection(db, "users", user.uid, "watchlist"),
            orderBy("addedAt", "desc"),
            limit(3)
          );

          const [legacyCards, legacyFolders, legacyMarketplaceSnap, legacyAuctionsSnap, legacyWatchlistSnap] =
            await Promise.all([
              getUserCards(user.uid),
              getUserFolders(user.uid),
              getDocs(legacyMarketplaceQuery),
              getDocs(legacyAuctionsQuery),
              getDocs(legacyWatchlistQuery),
            ]);

          normalizedCards = legacyCards;
          normalizedFolders = legacyFolders;
          normalizedMarketplace = legacyMarketplaceSnap.docs.map(
            (snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as MarketplaceListing
          );
          normalizedAuctions = legacyAuctionsSnap.docs.map(
            (snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as AuctionItem
          );
          normalizedWatchlist = legacyWatchlistSnap.docs
            .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as WatchlistItem)
            .filter((item) => !item.deleted);
        }

        setCards(normalizedCards);
        setFolders(normalizedFolders);
        setMarketplaceListings(normalizedMarketplace);
        setAuctionItems(normalizedAuctions);
        setWatchlistItems(normalizedWatchlist);
      } catch (error) {
        console.error("Error loading dashboard preview data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadDashboardData();
    }
  }, [authLoading, user?.uid]);

  const totalValue = useMemo(
    () => cards.reduce((sum, card) => sum + Number(card.marketPrice ?? card.value ?? 0), 0),
    [cards]
  );

  const baseValue = useMemo(
    () => cards.reduce((sum, card) => sum + Number(card.value ?? 0), 0),
    [cards]
  );

  const changePercent =
    baseValue > 0 ? ((totalValue - baseValue) / baseValue) * 100 : 0;

  const recentScans = useMemo(() => {
    return [...cards]
      .sort((left, right) => toMillis(right.addedAt) - toMillis(left.addedAt))
      .slice(0, 4)
      .map((card) => ({
        id: card.id || `${card.name}-${card.cardNumber || ""}`,
        name: card.name || "Unnamed card",
        set: [card.brand, card.year, card.cardNumber ? `#${card.cardNumber}` : null]
          .filter(Boolean)
          .join(" • "),
        value: Number(card.marketPrice ?? card.value ?? 0),
      }));
  }, [cards]);

  const movers = useMemo(() => {
    return cards
      .filter((card) => Number(card.value) > 0 && typeof card.marketPrice === "number")
      .map((card) => {
        const originalValue = Number(card.value || 0);
        const currentValue = Number(card.marketPrice || 0);
        const pct = originalValue > 0 ? ((currentValue - originalValue) / originalValue) * 100 : 0;

        return {
          id: card.id || `${card.name}-${card.cardNumber || ""}`,
          name: card.name || "Unnamed card",
          price: currentValue,
          changePercent: pct,
          up: pct >= 0,
        };
      })
      .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
      .slice(0, 4);
  }, [cards]);

  const trendPoints = useMemo(() => {
    const values = [...cards]
      .sort((left, right) => toMillis(left.addedAt) - toMillis(right.addedAt))
      .map((card) => Number(card.marketPrice ?? card.value ?? 0))
      .filter((value) => value > 0)
      .slice(-7);

    if (values.length === 0) {
      return [25, 33, 40, 46, 58, 62, 68];
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = Math.max(maximum - minimum, 1);

    const normalized = values.map((value) => 30 + ((value - minimum) / spread) * 65);
    while (normalized.length < 7) {
      normalized.unshift(normalized[0]);
    }

    return normalized.map((value) => Math.round(value));
  }, [cards]);

  const folderPreview = useMemo(() => {
    const cardCountsByFolder = cards.reduce<Record<string, number>>((accumulator, card) => {
      (card.folderIds || []).forEach((folderId) => {
        accumulator[folderId] = (accumulator[folderId] || 0) + 1;
      });
      return accumulator;
    }, {});

    return folders.slice(0, 4).map((folder) => ({
      id: folder.id || folder.name,
      name: folder.name,
      count: cardCountsByFolder[folder.id || ""] || 0,
    }));
  }, [cards, folders]);

  const collectionCards = useMemo(() => {
    return [...cards]
      .sort((left, right) => toMillis(right.addedAt) - toMillis(left.addedAt))
      .slice(0, 4)
      .map((card) => ({
        id: card.id || `${card.name}-${card.cardNumber || ""}`,
        name: card.name || "Unnamed card",
      }));
  }, [cards]);

  const marketplacePreview = useMemo(() => {
    return marketplaceListings.map((listing) => ({
      id: listing.id,
      name: listing.cardName || "Listing",
      price: Number(listing.price || 0),
    }));
  }, [marketplaceListings]);

  const auctionPreview = useMemo(() => {
    return auctionItems.map((auction) => ({
      id: auction.id,
      title: auction.cardName || "Auction",
      currentBid: Number(auction.currentBid || 0),
      bidCount: Number(auction.bidCount || 0),
      endTime: auction.endTime,
    }));
  }, [auctionItems]);

  const watchlistPreview = useMemo(() => {
    return watchlistItems.map((item) => ({
      id: item.id,
      name: item.auctionTitle || item.cardID || "Watchlist item",
      price: Number(item.currentPrice || 0),
    }));
  }, [watchlistItems]);

  const marketTrendLabel = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card" style={{ background: "linear-gradient(140deg, rgba(28, 55, 104, 0.85), rgba(12, 28, 56, 0.92))" }}>
          <h3 className="text-gray-300 text-xs uppercase tracking-wide">Collection Value</h3>
          <p className="text-3xl font-extrabold text-white">${Math.round(totalValue).toLocaleString()}</p>
        </div>

        <div className="card" style={{ background: "linear-gradient(140deg, rgba(24, 32, 52, 0.9), rgba(11, 16, 28, 0.94))" }}>
          <h3 className="text-gray-300 text-xs uppercase tracking-wide">Cards Owned</h3>
          <p className="text-3xl font-extrabold">{cards.length}</p>
        </div>

        <div className="card" style={{ background: "linear-gradient(145deg, rgba(63, 30, 7, 0.95), rgba(28, 16, 7, 0.98))", borderColor: "rgba(255,143,0,0.35)" }}>
          <h3 className="text-orange-200 text-xs uppercase tracking-wide">Market Trend</h3>
          <p className={`text-3xl font-extrabold ${changePercent >= 0 ? "text-orange-300" : "text-red-400"}`}>
            {marketTrendLabel}
          </p>
        </div>
      </div>

      <CardGrid className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <PortfolioValue
          totalValue={totalValue}
          changePercent={changePercent}
          trendPoints={trendPoints}
          loading={loading}
        />
        <MarketMovers movers={movers} loading={loading} />
        <RecentScans scans={recentScans} loading={loading} />
        <CollectionGrid folders={folderPreview} cards={collectionCards} loading={loading} />
        <MarketplacePreview listings={marketplacePreview} loading={loading} />
        <AuctionPreview auctions={auctionPreview} loading={loading} />
        <Watchlist items={watchlistPreview} loading={loading} />
      </CardGrid>
    </div>
  );
}
