"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CardItem from "@/components/CardItem";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  orderBy, 
  limit,
  deleteDoc,
  doc
} from "firebase/firestore";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import styles from "./marketplace.module.css";

interface Listing {
  id: string;
  userId: string;
  userName: string;
  cardName: string;
  cardNumber?: string;
  player: string;
  year: number;
  brand: string;
  sport: string;
  condition: string;
  listingType: "sell" | "trade" | "both";
  price?: number;
  tradeFor?: string;
  description: string;
  imageUrl?: string;
  status: "active" | "sold" | "traded" | "cancelled";
  createdAt: any;
  views: number;
  cards?: Array<{
    cardId: string;
    cardName: string;
    cardNumber?: string;
  }>;
}

const normalizeListingType = (value: string | undefined): "sell" | "trade" | "both" => {
  if (value === "trade") return "trade";
  if (value === "both") return "both";
  if (value === "sale") return "sell";
  return "sell";
};

const normalizeListing = (id: string, data: any): Listing => {
  return {
    id,
    userId: data.userId || data.userID || data.sellerID || "",
    userName: data.userName || data.sellerName || "Unknown Seller",
    cardName: data.cardName || data.name || data.cardID || "Card",
    cardNumber: data.cardNumber || data.number || "",
    player: data.player || "",
    year: Number(data.year || new Date().getFullYear()),
    brand: data.brand || data.set || "",
    sport: data.sport || "Other",
    condition: data.condition || "Unknown",
    listingType: normalizeListingType(data.listingType),
    price: Number(data.price || 0),
    tradeFor: data.tradeFor || "",
    description: data.description || "",
    imageUrl: data.imageUrl || data.image || "",
    status: data.status || "active",
    createdAt: data.createdAt || data.created || data.timestamp,
    views: Number(data.views || 0),
    cards: Array.isArray(data.cards)
      ? data.cards.map((card: any) => ({
          cardId: card.cardId || card.cardID || "",
          cardName: card.cardName || card.name || card.cardID || "Card",
          cardNumber: card.cardNumber || card.number || "",
        }))
      : [],
  };
};

export default function MarketplacePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sell" | "trade" | "both">("all");
  const [filterSport, setFilterSport] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high" | "popular">("newest");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserId(user.uid);
        setIsLoading(false);
        loadListings();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadListings = async () => {
    try {
      let loadedListings: Listing[] = [];

      try {
        const flatQuery = query(
          collection(db, FLAT_COLLECTIONS.marketListings),
          where("status", "==", "active"),
          orderBy("created", "desc"),
          limit(100)
        );

        const flatSnapshot = await getDocs(flatQuery);
        loadedListings = flatSnapshot.docs.map((snapshot) =>
          normalizeListing(snapshot.id, snapshot.data())
        );
      } catch (flatError) {
        console.warn("Falling back to legacy marketplace collection:", flatError);
      }

      if (loadedListings.length === 0) {
        const legacyQuery = query(
          collection(db, "marketplace"),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
          limit(100)
        );

        const legacySnapshot = await getDocs(legacyQuery);
        loadedListings = legacySnapshot.docs.map((snapshot) =>
          normalizeListing(snapshot.id, snapshot.data())
        );
      }

      setListings(loadedListings);
      setFilteredListings(loadedListings);
    } catch (error) {
      console.error("Error loading listings:", error);
    }
  };

  const handleDeleteListing = async (listingId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    try {
      const flatRef = doc(db, FLAT_COLLECTIONS.marketListings, listingId);
      const legacyRef = doc(db, "marketplace", listingId);

      const [flatSnap, legacySnap] = await Promise.all([
        getDoc(flatRef),
        getDoc(legacyRef),
      ]);

      const deleteOps: Promise<void>[] = [];
      if (flatSnap.exists()) deleteOps.push(deleteDoc(flatRef));
      if (legacySnap.exists()) deleteOps.push(deleteDoc(legacyRef));

      if (deleteOps.length === 0) {
        deleteOps.push(deleteDoc(flatRef));
      }

      await Promise.all(deleteOps);
      
      // Remove from local state
      setListings(prev => prev.filter(l => l.id !== listingId));
      setFilteredListings(prev => prev.filter(l => l.id !== listingId));
    } catch (error) {
      console.error("Error deleting listing:", error);
      alert("Failed to delete listing. Please try again.");
    }
  };

  // Apply filters and search
  useEffect(() => {
    let filtered = [...listings];

    // Search filter
    if (searchQuery) {
      const queryText = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (listing) => {
          const multiCardMatch = (listing.cards || []).some((card) => {
            const cardNameMatch = (card.cardName || "").toLowerCase().includes(queryText);
            const cardNumberMatch = (card.cardNumber || "").toLowerCase().includes(queryText);
            return cardNameMatch || cardNumberMatch;
          });

          return (
            listing.cardName.toLowerCase().includes(queryText) ||
            listing.player.toLowerCase().includes(queryText) ||
            listing.brand.toLowerCase().includes(queryText) ||
            (listing.cardNumber || "").toLowerCase().includes(queryText) ||
            multiCardMatch
          );
        }
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(
        (listing) => listing.listingType === filterType || listing.listingType === "both"
      );
    }

    // Sport filter
    if (filterSport !== "all") {
      filtered = filtered.filter((listing) => listing.sport === filterSport);
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        break;
      case "price-high":
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "popular":
        filtered.sort((a, b) => b.views - a.views);
        break;
      case "newest":
      default:
        // Already sorted by newest from query
        break;
    }

    setFilteredListings(filtered);
  }, [searchQuery, filterType, filterSport, sortBy, listings]);

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Marketplace</p>
          <h1 className={styles.title}>Buy, Sell & Trade</h1>
        </div>
        <Link href="/dashboard/marketplace/create" className={styles.createButton}>
          + Create Listing
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{listings.length}</div>
          <div className={styles.statLabel}>Active Listings</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {listings.filter((l) => l.listingType === "sell" || l.listingType === "both").length}
          </div>
          <div className={styles.statLabel}>For Sale</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {listings.filter((l) => l.listingType === "trade" || l.listingType === "both").length}
          </div>
          <div className={styles.statLabel}>For Trade</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`panel ${styles.filterPanel}`}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search cards, players, brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className={styles.filterSelect}
          >
            <option value="all">All Types</option>
            <option value="sell">For Sale</option>
            <option value="trade">For Trade</option>
            <option value="both">Sale or Trade</option>
          </select>

          <select
            value={filterSport}
            onChange={(e) => setFilterSport(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Sports</option>
            <option value="Baseball">Baseball</option>
            <option value="Basketball">Basketball</option>
            <option value="Football">Football</option>
            <option value="Hockey">Hockey</option>
            <option value="Soccer">Soccer</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.filterSelect}
          >
            <option value="newest">Newest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </div>

      {/* Listings Grid */}
      <div className={styles.listingsGrid}>
        {filteredListings.length > 0 ? (
          filteredListings.map((listing) => (
            <div key={listing.id} className={styles.listingCardWrapper}>
              <Link
                href={`/dashboard/marketplace/${listing.id}`}
                className={`panel ${styles.listingCard}`}
              >
                <CardItem
                  card={{
                    cardName: listing.cardName,
                    imageUrl: listing.imageUrl,
                    player: listing.player,
                    year: listing.year,
                    sport: listing.sport,
                    condition: listing.condition,
                    price: listing.price
                  }}
                  badge={
                    listing.listingType === "sell" ? "For Sale" :
                    listing.listingType === "trade" ? "For Trade" :
                    "Sale/Trade"
                  }
                />

                <div className={styles.listingIdentifier}>
                  {listing.cards && listing.cards.length > 1
                    ? `IDs: ${listing.cards
                        .slice(0, 3)
                        .map((card) => (card.cardNumber ? `#${card.cardNumber}` : card.cardName))
                        .join(", ")}${listing.cards.length > 3 ? "..." : ""}`
                    : listing.cardNumber
                    ? `Card #${listing.cardNumber}`
                    : `Card: ${listing.cardName}`}
                </div>

                {listing.tradeFor && (
                  <div className={styles.listingTrade}>
                    <span className={styles.tradeLabel}>Trade for:</span>
                    <span className={styles.tradeText}>{listing.tradeFor}</span>
                  </div>
                )}

                <div className={styles.listingFooter}>
                  <span className={styles.listingSeller}>by {listing.userName}</span>
                  <span className={styles.listingViews}>👁 {listing.views}</span>
                </div>
              </Link>
              
              {userId && listing.userId === userId && (
                <button
                  onClick={(e) => handleDeleteListing(listing.id, e)}
                  className={styles.deleteButton}
                  title="Delete listing"
                >
                  ×
                </button>
              )}
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🛍️</div>
            <h3>No listings found</h3>
            <p>Try adjusting your filters or create the first listing!</p>
          </div>
        )}
      </div>
    </div>
  );
}
