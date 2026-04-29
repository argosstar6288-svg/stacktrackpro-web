"use client";

import Link from "next/link";
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
import StatCard from "@/components/StatCard";
import Watchlist from "../../components/dashboard/Watchlist";
import { useUserCards, getUserCards, getUserFolders, type Card, type Folder } from "../../lib/cards";
import { FLAT_COLLECTIONS } from "../../lib/flatCollections";
import { formatCurrency } from "../../lib/currency";
import { db } from "../../lib/firebase";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { useCurrency } from "../../hooks/useCurrency";

interface MarketplaceListing {
  id: string;
  cardName?: string;
  imageUrl?: string;
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

interface DashboardEventItem {
  id: string;
  title: string;
  date: string;
  detail: string;
  href?: string;
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

const DASHBOARD_PLACEHOLDER_IMAGE = "/placeholder-card.svg";

const isRenderableImageUrl = (value?: string | null): boolean => {
  if (!value || typeof value !== "string") return false;

  const trimmed = value.trim();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  );
};

const resolveDashboardImageUrl = (
  ...candidates: Array<string | undefined | null>
): string => {
  const selected = candidates.find((candidate) => isRenderableImageUrl(candidate));
  return selected?.trim() || DASHBOARD_PLACEHOLDER_IMAGE;
};

const tcgCalendarSource = "https://tcgshowsnearme.com/calendar";

const fallbackEvents: DashboardEventItem[] = [
  {
    id: "hobby-con-scarborough-2026-04-26",
    date: "Apr 26",
    title: "Hobby Con Scarborough",
    detail: "10:00-17:00 • Scarborough, Ontario",
    href: `${tcgCalendarSource}/hobby-con-scarborough-scarborough-2026-04-26`,
  },
  {
    id: "capital-trade-pokemon-shows-ottawa-2026-04-26",
    date: "Apr 26",
    title: "Capital Trade Pokemon Shows",
    detail: "10:00-15:00 • Ottawa, Ontario",
    href: `${tcgCalendarSource}/capital-trade-pokemon-shows-ottawa-2026-04-26`,
  },
  {
    id: "living-sky-collectibles-card-show-moose-jaw-2026-04-26",
    date: "Apr 26",
    title: "Living Sky Collectibles Card Show",
    detail: "10:00-15:00 • Moose Jaw, Saskatchewan",
    href: `${tcgCalendarSource}/living-sky-collectibles-card-show-moose-jaw-2026-04-26`,
  },
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const { currency } = useCurrency();
  const { cards: userCards, loading: cardsLoading } = useUserCards();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEventItem[]>(fallbackEvents);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [listingCount, setListingCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.uid) {
        setFolders([]);
        setMarketplaceListings([]);
        setAuctionItems([]);
        setWatchlistItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userFolders = await getUserFolders(user.uid);

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

        const [marketListingsSnap, auctionsLiveSnap, watchlistsSnap] = await Promise.all([
          getDocs(marketListingsQuery),
          getDocs(auctionsLiveQuery),
          getDocs(watchlistsQuery),
        ]);

        const normalizedMarketplace = marketListingsSnap.docs.map((snapshot) => {
          const data = snapshot.data() as any;
          return {
            id: snapshot.id,
            cardName: data.cardName || data.name || data.cardID,
            imageUrl: resolveDashboardImageUrl(
              data.imageUrl,
              data.image,
              data.photoUrl,
              data.frontImageUrl,
              data.thumbnailUrl
            ),
            price: Number(data.price || 0),
            status: data.status,
            createdAt: data.created,
          } as MarketplaceListing;
        });

        const normalizedAuctions = auctionsLiveSnap.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as any),
        })) as AuctionItem[];

        const normalizedWatchlist = watchlistsSnap.docs
          .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }) as WatchlistItem)
          .filter((item) => !item.deleted);

        setFolders(userFolders);
        setMarketplaceListings(normalizedMarketplace);
        setAuctionItems(normalizedAuctions);
        setWatchlistItems(normalizedWatchlist);

        const [listingCountSnapshot, watchlistCountSnapshot] = await Promise.all([
          getDocs(query(collection(db, FLAT_COLLECTIONS.marketListings), where("userId", "==", user.uid), limit(100))).catch(() => ({ docs: [] } as any)),
          getDocs(query(collection(db, FLAT_COLLECTIONS.watchlists), where("userID", "==", user.uid), limit(100))).catch(() => ({ docs: [] } as any)),
        ]);

        setListingCount(listingCountSnapshot.docs.length || 0);
        setWatchlistCount(watchlistCountSnapshot.docs.length || 0);

        // Auto-refresh collection prices in background so card values match PriceCharting
        if (userCards.length > 0 && user?.uid) {
          try {
            // Trigger authenticated background refresh without blocking UI.
            user.getIdToken().then((token) => {
              fetch("/api/background-price-updater", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  mode: "enqueue",
                  userId: user.uid,
                }),
              }).catch(() => {
                // Silently ignore background refresh errors
              });
            }).catch(() => {
              // Silently ignore token fetch errors
            });
          } catch (err) {
            // Silently ignore
          }
        }
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

  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      try {
        setEventsLoading(true);
        const response = await fetch("/dashboard/api/tcg-events?limit=3&country=CAN", {
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { events?: DashboardEventItem[] };
        if (Array.isArray(payload.events) && payload.events.length > 0) {
          setUpcomingEvents(payload.events);
        }
      } catch {
        // Keep fallback events when source is unavailable.
      } finally {
        if (!controller.signal.aborted) {
          setEventsLoading(false);
        }
      }
    };

    loadEvents();

    return () => controller.abort();
  }, []);

  const totalValue = useMemo(
    () => userCards.reduce((sum, card) => sum + Number(card.marketPrice ?? card.value ?? 0), 0),
    [userCards]
  );

  const baseValue = useMemo(
    () => userCards.reduce((sum, card) => sum + Number(card.value ?? 0), 0),
    [userCards]
  );

  const changePercent =
    baseValue > 0 ? ((totalValue - baseValue) / baseValue) * 100 : 0;

  const recentScans = useMemo(() => {
    return [...userCards]
      .sort((left, right) => toMillis(right.addedAt) - toMillis(left.addedAt))
      .slice(0, 4)
      .map((card) => ({
        id: card.id || `${card.name}-${card.cardNumber || ""}`,
        name: card.name || "Unnamed card",
        imageUrl: resolveDashboardImageUrl(card.imageUrl, card.photoUrl),
        set: [card.brand, card.year, card.cardNumber ? `#${card.cardNumber}` : null]
          .filter(Boolean)
          .join(" • "),
        value: Number(card.marketPrice ?? card.value ?? 0),
      }));
  }, [userCards]);

  const movers = useMemo(() => {
    return userCards
      .filter((card) => Number(card.value) > 0 && typeof card.marketPrice === "number")
      .map((card) => {
        const originalValue = Number(card.value || 0);
        const currentValue = Number(card.marketPrice || 0);
        const pct = originalValue > 0 ? ((currentValue - originalValue) / originalValue) * 100 : 0;

        return {
          id: card.id || `${card.name}-${card.cardNumber || ""}`,
          name: card.name || "Unnamed card",
          imageUrl: resolveDashboardImageUrl(card.imageUrl, card.photoUrl),
          price: currentValue,
          changePercent: pct,
          up: pct >= 0,
        };
      })
      .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
      .slice(0, 4);
  }, [userCards]);

  const trendPoints = useMemo(() => {
    const values = [...userCards]
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
  }, [userCards]);

  const folderPreview = useMemo(() => {
    const cardCountsByFolder = userCards.reduce<Record<string, number>>((accumulator, card) => {
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
  }, [userCards, folders]);

  const collectionCards = useMemo(() => {
    return [...userCards]
      .sort((left, right) => toMillis(right.addedAt) - toMillis(left.addedAt))
      .slice(0, 4)
      .map((card) => ({
        id: card.id || `${card.name}-${card.cardNumber || ""}`,
        name: card.name || "Unnamed card",
        imageUrl: resolveDashboardImageUrl(card.imageUrl, card.photoUrl),
      }));
  }, [userCards]);

  const marketplacePreview = useMemo(() => {
    return marketplaceListings.map((listing) => ({
      id: listing.id,
      name: listing.cardName || "Listing",
      imageUrl: resolveDashboardImageUrl(listing.imageUrl),
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/feature-hub"
            className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            Feature Hub
          </Link>
          <Link
            href="/dashboard/watchlist"
            className="inline-flex items-center justify-center rounded-full border border-sky-300/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/35"
          >
            Watchlist
          </Link>
          <Link
            href="/dashboard/share"
            className="inline-flex items-center justify-center rounded-full border border-orange-300/40 bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/35"
          >
            Flex Share
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <StatCard
          label="Collection Value"
          value={formatCurrency(Math.round(totalValue), currency)}
          loading={loading}
        />

        <StatCard label="Cards Owned" value={userCards.length} loading={cardsLoading} />

        <StatCard label="Folders" value={folders.length} loading={loading} />

        <StatCard label="Active Listings" value={listingCount} loading={loading} />

        <StatCard label="Watchlist" value={watchlistCount} loading={loading} />

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

        <div className="card" style={{ background: "linear-gradient(145deg, rgba(30, 144, 255, 0.95), rgba(10, 54, 114, 0.94))" }}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">Event Calendar</h3>
            <div className="flex items-center gap-3">
              <Link
                href={tcgCalendarSource}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold uppercase tracking-wide text-sky-100 hover:text-white"
              >
                Source
              </Link>
              <Link
                href="/dashboard/breaks"
                className="text-xs font-semibold uppercase tracking-wide text-sky-100 hover:text-white"
              >
                View all
              </Link>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {eventsLoading && (
              <p className="text-xs text-sky-100/80">Refreshing latest events...</p>
            )}
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-white/20 bg-white/10 px-3 py-3"
              >
                <div>
                  {event.href ? (
                    <Link
                      href={event.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-white hover:text-sky-100"
                    >
                      {event.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-white">{event.title}</p>
                  )}
                  <p className="mt-1 text-xs text-sky-100/90">{event.detail}</p>
                </div>
                <span className="rounded-md bg-white/20 px-2 py-1 text-xs font-bold text-white">
                  {event.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardGrid>
    </div>
  );
}
