"use client";

import { useState, useEffect } from "react";
import styles from "./recommendations.module.css";
import {
  getBuyerRecommendations,
  BuyerRecommendation,
} from "../../lib/revenueMetrics";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { getRecommendations, RecommendationResult, explainRecommendation, type CardItem } from "../../lib/recommendationEngine";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function BuyerRecommendations() {
  const { user } = useCurrentUser();
  const [recommendations, setRecommendations] = useState<BuyerRecommendation[]>([]);
  const [advancedRecs, setAdvancedRecs] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"match" | "price" | "resale">("match");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    "collection",
    "collaborative",
    "trending",
    "cold_start",
    "ranking",
    "neural",
  ]);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      if (user?.uid) {
        // Load traditional recommendations
        const recs = await getBuyerRecommendations(user.uid, 20);
        setRecommendations(recs);

        // Load advanced recommendations from new engine
        try {
          const auctions = await getAllAuctions();
          const advRecs = await getRecommendations(user.uid, {
            limit: 20,
            strategies: selectedStrategies,
            allItems: auctions,
          });
          setAdvancedRecs(advRecs.recommendations);
          setMetrics(advRecs.metrics);
        } catch (err) {
          console.error("Error loading advanced recommendations:", err);
        }
      }
    } catch (error) {
      console.error("Error loading recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAllAuctions = async (): Promise<CardItem[]> => {
    try {
      const auctionsRef = collection(db, "auctions");
      const snapshot = await getDocs(auctionsRef);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().cardName || "",
        category: doc.data().category || "",
        price: doc.data().currentBid || 0,
        imageUrl: doc.data().imageUrl,
        bids: (doc.data().bidHistory || []).length,
        views: doc.data().views || 0,
        rarity: doc.data().rarity,
        condition: doc.data().condition,
        yearIssued: doc.data().yearIssued,
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      } as CardItem));
    } catch (error) {
      console.error("Error fetching auctions:", error);
      return [];
    }
  };

  const getSortedRecommendations = () => {
    const recs = showAdvanced ? advancedRecs : recommendations;
    if (showAdvanced) {
      // Advanced recs already sorted by score
      return recs.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    }
    const sorted = [...recs];
    if (sortBy === "match") {
      return sorted.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
    }
    if (sortBy === "price") {
      return sorted.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
    }
    return sorted.sort((a: any, b: any) => (b.estimatedResaleValue || 0) - (a.estimatedResaleValue || 0));
  };

  const getMatchColor = (score: number) => {
    if (score >= 0.8) return "#10b981";
    if (score >= 0.6) return "#f59e0b";
    return "#6b7280";
  };

  const toggleStrategy = (strategy: string) => {
    const updated = selectedStrategies.includes(strategy)
      ? selectedStrategies.filter((s) => s !== strategy)
      : [...selectedStrategies, strategy];
    setSelectedStrategies(updated);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Finding great items for you...</div>
      </div>
    );
  }

  const sorted = getSortedRecommendations();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🎁 AI-Powered Recommendations</h1>
        <p>Personalized items based on your collecting history</p>
      </div>

      <div className={styles.controls}>
        <div className={styles.modeToggle}>
          <button
            className={!showAdvanced ? styles.modeActive : ""}
            onClick={() => {
              setShowAdvanced(false);
              loadRecommendations();
            }}
          >
            Classic
          </button>
          <button
            className={showAdvanced ? styles.modeActive : ""}
            onClick={() => {
              setShowAdvanced(true);
              loadRecommendations();
            }}
          >
            Advanced ML 🚀
          </button>
        </div>

        {showAdvanced && (
          <div className={styles.strategyToggle}>
            <label>Recommendation Strategies:</label>
            <div className={styles.strategies}>
              {[
                { id: "collection", label: "Collection Matching" },
                { id: "collaborative", label: "Collaborative Filtering" },
                { id: "trending", label: "Trending Boost" },
                { id: "cold_start", label: "Cold Start" },
                { id: "ranking", label: "ML Ranking" },
                { id: "neural", label: "Neural Similarity" },
              ].map((s) => (
                <button
                  key={s.id}
                  className={`${styles.strategyBtn} ${selectedStrategies.includes(s.id) ? styles.strategyActive : ""}`}
                  onClick={() => {
                    toggleStrategy(s.id);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!showAdvanced && (
          <div className={styles.sortSection}>
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "match" | "price" | "resale")
              }
              className={styles.sortSelect}
            >
              <option value="match">Match Score</option>
              <option value="price">Price (Low to High)</option>
              <option value="resale">Resale Potential</option>
            </select>
          </div>
        )}

        <button onClick={loadRecommendations} className={styles.refreshBtn}>
          🔄 Refresh
        </button>
      </div>

      {showAdvanced && metrics && (
        <div className={styles.metricsPanel}>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Diversity Score</div>
            <div className={styles.metricValue}>
              {(metrics.diversityScore * 100).toFixed(0)}%
            </div>
            <div className={styles.metricDesc}>Category coverage</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Personalization</div>
            <div className={styles.metricValue}>
              {(metrics.personalizedScore * 100).toFixed(0)}%
            </div>
            <div className={styles.metricDesc}>Tailored to you</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Confidence</div>
            <div className={styles.metricValue}>
              {(metrics.populariryScore * 100).toFixed(0)}%
            </div>
            <div className={styles.metricDesc}>Quality assurance</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Strategies Active</div>
            <div className={styles.metricValue}>{metrics.strategiesUsed.length}</div>
            <div className={styles.metricDesc}>{metrics.strategiesUsed.join(", ")}</div>
          </div>
        </div>
      )}

      <div className={styles.recommendationsGrid}>
        {sorted.length === 0 ? (
          <div className={styles.empty}>
            No recommendations yet. Build your portfolio to get personalized
            suggestions.
          </div>
        ) : showAdvanced ? (
          // Advanced recommendations
          sorted.map((rec: RecommendationResult) => (
            <div key={rec.item.id} className={styles.recCard}>
              <div className={styles.cardHeader}>
                <h3>{rec.item.name}</h3>
                <div
                  className={styles.matchScore}
                  style={{ backgroundColor: getMatchColor(rec.score) }}
                >
                  {(rec.score * 100).toFixed(0)}%
                </div>
              </div>

              <div className={styles.category}>{rec.item.category}</div>

              <div className={styles.metrics}>
                <div className={styles.metricRow}>
                  <span>Strategy</span>
                  <strong className={styles.strategyTag}>
                    {rec.strategy === "collection"
                      ? "📚 Collection"
                      : rec.strategy === "collaborative"
                      ? "👥 Collab"
                      : rec.strategy === "trending"
                      ? "🔥 Trending"
                      : rec.strategy === "cold_start"
                      ? "⭐ New User"
                      : rec.strategy === "ranking"
                      ? "🤖 ML Rank"
                      : "🧠 Neural"}
                  </strong>
                </div>
                <div className={styles.metricRow}>
                  <span>Confidence</span>
                  <strong>{(rec.confidence * 100).toFixed(0)}%</strong>
                </div>
                <div className={styles.metricRow}>
                  <span>Current Price</span>
                  <strong>${rec.item.price.toFixed(2)}</strong>
                </div>
              </div>

              <p className={styles.reason}>{explainRecommendation(rec)}</p>

              <button className={styles.bidBtn}>View Auction</button>
            </div>
          ))
        ) : (
          // Classic recommendations
          sorted.map((rec: BuyerRecommendation) => (
            <div key={rec.itemId} className={styles.recCard}>
              <div className={styles.cardHeader}>
                <h3>{rec.itemName}</h3>
                <div
                  className={styles.matchScore}
                  style={{ backgroundColor: getMatchColor(rec.matchScore / 100) }}
                >
                  {rec.matchScore}%
                </div>
              </div>

              <div className={styles.category}>{rec.category}</div>

              <div className={styles.metrics}>
                <div className={styles.metricRow}>
                  <span>Rarity</span>
                  <strong>{rec.rarity || "Common"}</strong>
                </div>
                <div className={styles.metricRow}>
                  <span>Current Price</span>
                  <strong>${rec.price}</strong>
                </div>
                <div className={styles.metricRow}>
                  <span>Resale Value</span>
                  <strong className={styles.resaleValue}>
                    ${rec.estimatedResaleValue}
                  </strong>
                </div>
              </div>

              {rec.savingsOpportunity && (
                <div className={styles.savings}>💰 Deal: Below market average!</div>
              )}

              <p className={styles.reason}>{rec.reason}</p>

              <button className={styles.bidBtn}>View Auction</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
