"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import styles from "./marketplace.module.css";

interface Listing {
  id: string;
  userId: string;
  userName: string;
  cardName: string;
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
}

export default function MarketplacePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
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
        setIsLoading(false);
        loadListings();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadListings = async () => {
    try {
      const listingsRef = collection(db, "marketplace");
      const q = query(
        listingsRef,
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const loadedListings: Listing[] = [];
      snapshot.forEach((doc) => {
        loadedListings.push({ id: doc.id, ...doc.data() } as Listing);
      });

      setListings(loadedListings);
      setFilteredListings(loadedListings);
    } catch (error) {
      console.error("Error loading listings:", error);
    }
  };

  // Apply filters and search
  useEffect(() => {
    let filtered = [...listings];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (listing) =>
          listing.cardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.player.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.brand.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Link
              key={listing.id}
              href={`/dashboard/marketplace/${listing.id}`}
              className={`panel ${styles.listingCard}`}
            >
              <div className={styles.listingImage}>
                {listing.imageUrl ? (
                  <Image src={listing.imageUrl} alt={listing.cardName} width={300} height={420} sizes="(max-width: 768px) 100vw, 400px" unoptimized />
                ) : (
                  <div className={styles.noImage}>📷</div>
                )}
              </div>

              <div className={styles.listingBadge}>
                {listing.listingType === "sell" && "For Sale"}
                {listing.listingType === "trade" && "For Trade"}
                {listing.listingType === "both" && "Sale/Trade"}
              </div>

              <div className={styles.listingContent}>
                <h3 className={styles.listingTitle}>{listing.cardName}</h3>
                <div className={styles.listingMeta}>
                  <span>{listing.player}</span>
                  <span>•</span>
                  <span>{listing.year}</span>
                  <span>•</span>
                  <span>{listing.sport}</span>
                </div>
                <div className={styles.listingCondition}>{listing.condition}</div>

                {listing.price && (
                  <div className={styles.listingPrice}>${listing.price.toLocaleString()}</div>
                )}

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
              </div>
            </Link>
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
