"use client";

import { useState, useEffect } from "react";
import styles from "./discover.module.css";
import {
  getBuyerRecommendations,
  BuyerRecommendation,
} from "../../lib/revenueMetrics";
import {
  getWatchlistStats,
  WatchlistStats,
} from "../../lib/retention";
import { useCurrentUser } from "../../lib/useCurrentUser";

type RecommendationType = "general" | "collection" | "similar-bids" | "trending";

interface RecommendationSection {
  type: RecommendationType;
  title: string;
  subtitle: string;
  icon: string;
  items: BuyerRecommendation[];
}

export default function DiscoverPage() {
  const { user } = useCurrentUser();
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [watchlistStats, setWatchlistStats] = useState<WatchlistStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadDiscoverFeed();
    }
  }, [user?.uid]);

  const loadDiscoverFeed = async () => {
    try {
      setLoading(true);
      if (!user?.uid) return;

      // Get all recommendations
      const allRecs = await getBuyerRecommendations(user.uid, 40);
      const stats = await getWatchlistStats(user.uid);
      setWatchlistStats(stats);

      // Split recommendations into sections
      const newSections: RecommendationSection[] = [
        {
          type: "general",
          title: "🔥 Recommended For You",
          subtitle: "Carefully curated based on your interests",
          icon: "✨",
          items: allRecs.slice(0, 8).filter(r => r.matchScore >= 70),
        },
        {
          type: "collection",
          title: "🔥 Based on Your Collection",
          subtitle: "Items similar to what you already own",
          icon: "💎",
          items: allRecs.slice(8, 16).filter(r => r.matchScore >= 65),
        },
        {
          type: "similar-bids",
          title: "🔥 Cards Similar to What You Bid On",
          subtitle: "Keep the momentum with similar finds",
          icon: "🎯",
          items: allRecs.slice(16, 24).filter(r => r.matchScore >= 60),
        },
        {
          type: "trending",
          title: "🔥 Trending in Your Category",
          subtitle: "Hot items gaining attention right now",
          icon: "📈",
          items: allRecs.slice(24, 32).filter(r => r.matchScore >= 55),
        },
      ];

      setSections(newSections);
    } catch (error) {
      console.error("Error loading discover feed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Discovering amazing items for you...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Discover Your Next Treasure</h1>
          <p>Personalized recommendations powered by AI</p>
        </div>
      </div>

      {watchlistStats && watchlistStats.totalWatched > 0 && (
        <div className={styles.watchlistPrompt}>
          <span>📌 You're watching {watchlistStats.totalWatched} items</span>
          <a href="/dashboard/watchlist">View Watchlist →</a>
        </div>
      )}

      <div className={styles.sectionsContainer}>
        {sections.map(section => (
          section.items.length > 0 && (
            <div key={section.type} className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.subtitle}</p>
                </div>
                <a href="/dashboard/buyer-recommendations" className={styles.seeAll}>
                  See All →
                </a>
              </div>

              <div className={styles.itemsGrid}>
                {section.items.slice(0, 6).map(item => (
                  <div key={item.itemId} className={styles.itemCard}>
                    <div className={styles.itemHeader}>
                      <span className={styles.category}>{item.category}</span>
                      <span className={styles.matchScore} style={{
                        backgroundColor: getScoreColor(item.matchScore),
                      }}>
                        {item.matchScore}%
                      </span>
                    </div>

                    <h3 className={styles.itemName}>{item.itemName}</h3>

                    <div className={styles.itemMeta}>
                      <div>
                        <span className={styles.label}>Price</span>
                        <strong>${item.price}</strong>
                      </div>
                      <div>
                        <span className={styles.label}>Resale</span>
                        <strong className={styles.resale}>${item.estimatedResaleValue}</strong>
                      </div>
                    </div>

                    {item.savingsOpportunity && (
                      <div className={styles.savingsBadge}>
                        💰 Deal: Below Market Average
                      </div>
                    )}

                    <p className={styles.reason}>{item.reason}</p>

                    <button className={styles.bidBtn}>
                      View & Bid
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      <div className={styles.cta}>
        <h2>Get notified about new recommendations</h2>
        <p>Turn on deal alerts to never miss a great find</p>
        <a href="/dashboard/notifications" className={styles.ctaBtn}>
          Enable Notifications
        </a>
      </div>

      <button onClick={loadDiscoverFeed} className={styles.refreshBtn}>
        🔄 Refresh Recommendations
      </button>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 70) return "#f59e0b";
  if (score >= 60) return "#3b82f6";
  return "#9ca3af";
}
