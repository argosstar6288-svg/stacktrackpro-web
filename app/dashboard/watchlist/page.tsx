"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./watchlist.module.css";
import { getWatchlist, removeFromWatchlist, getWatchlistStats, WatchlistItem, WatchlistStats } from "../../lib/retention";
import { useCurrentUser } from "../../lib/useCurrentUser";

export default function WatchlistPage() {
  const { user } = useCurrentUser();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [stats, setStats] = useState<WatchlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "price-drop" | "ending-soon">("all");

  const loadWatchlist = useCallback(async () => {
    try {
      setLoading(true);
      if (user?.uid) {
        const [items, watchStats] = await Promise.all([
          getWatchlist(user.uid),
          getWatchlistStats(user.uid),
        ]);
        setWatchlist(items);
        setStats(watchStats);
      }
    } catch (error) {
      console.error("Error loading watchlist:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      loadWatchlist();
    }
  }, [user?.uid, loadWatchlist]);

  const handleRemove = async (watchlistId: string) => {
    if (user?.uid) {
      await removeFromWatchlist(user.uid, watchlistId);
      setWatchlist(watchlist.filter(item => item.id !== watchlistId));
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading your watchlist...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Watchlist</h1>
        <p>Track your favorite items and get price alerts</p>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Watching</span>
            <strong>{stats.totalWatched}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Avg Price</span>
            <strong>${stats.avgWatchedPrice}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Top Category</span>
            <strong>
              {Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
            </strong>
          </div>
          <div className={styles.statCard}>
            <span>Price Alerts</span>
            <strong>{stats.priceDropsNotified}</strong>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.filterButtons}>
          <button
            className={`${styles.filterBtn} ${filter === "all" ? styles.active : ""}`}
            onClick={() => setFilter("all")}
          >
            All Items ({watchlist.length})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "price-drop" ? styles.active : ""}`}
            onClick={() => setFilter("price-drop")}
          >
            Price Drops
          </button>
          <button
            className={`${styles.filterBtn} ${filter === "ending-soon" ? styles.active : ""}`}
            onClick={() => setFilter("ending-soon")}
          >
            Ending Soon
          </button>
        </div>
        <button onClick={loadWatchlist} className={styles.refreshBtn}>🔄 Refresh</button>
      </div>

      {watchlist.length === 0 ? (
        <div className={styles.empty}>
          <p>No items in your watchlist yet</p>
          <p>Start watching items to track prices and get alerts!</p>
        </div>
      ) : (
        <div className={styles.watchlistGrid}>
          {watchlist.map(item => (
            <div key={item.id} className={styles.watchlistCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>{item.auctionTitle}</h3>
                  <span className={styles.category}>{item.category}</span>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemove(item.id)}
                  title="Remove from watchlist"
                >
                  ✕
                </button>
              </div>

              <div className={styles.priceSection}>
                <div className={styles.currentPrice}>
                  <span>Current Bid</span>
                  <strong>${item.currentPrice}</strong>
                </div>
                {item.watchPrice && (
                  <div className={styles.alertPrice}>
                    <span>Alert Price</span>
                    <strong>${item.watchPrice}</strong>
                  </div>
                )}
              </div>

              <div className={styles.addedDate}>
                Added {Math.round((Date.now() - item.addedAt.toMillis()) / (1000 * 60 * 60 * 24))} days ago
              </div>

              <button className={styles.bidBtn}>View Auction</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
