"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./seller-boosts.module.css";
import {
  getBoostRecommendations,
  createSellerBoost,
  BoostRecommendation,
} from "../../lib/retention";
import { useCurrentUser } from "../../lib/useCurrentUser";

export default function SellerBoostsPage() {
  const { user } = useCurrentUser();
  const [recommendations, setRecommendations] = useState<BoostRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      if (user?.uid) {
        const recs = await getBoostRecommendations(user.uid);
        setRecommendations(recs);
      }
    } catch (error) {
      console.error("Error loading boost recommendations:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      loadRecommendations();
    }
  }, [user?.uid, loadRecommendations]);

  const handleCreateBoost = async (auctionId: string, boostType: "featured" | "highlighted" | "promoted") => {
    try {
      setBoosting(true);
      if (user?.uid) {
        await createSellerBoost(user.uid, auctionId, boostType);
        await loadRecommendations();
      }
    } catch (error) {
      console.error("Error creating boost:", error);
    } finally {
      setBoosting(false);
    }
  };

  const getBoostConfig = (type: "featured" | "highlighted" | "promoted") => {
    switch (type) {
      case "featured":
        return { price: 1500, label: "Featured", color: "#d97706", description: "Top placement, 3 days" };
      case "highlighted":
        return { price: 1000, label: "Highlighted", color: "#f59e0b", description: "Premium visibility, 3 days" };
      case "promoted":
        return { price: 500, label: "Promoted", color: "#10b981", description: "Standard boost, 3 days" };
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading boost opportunities...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🚀 Seller Boost Dashboard</h1>
        <p>Increase visibility, attract more bids, and boost sales</p>
      </div>

      {recommendations.length === 0 ? (
        <div className={styles.empty}>
          <p>No boost recommendations at the moment</p>
          <p>All your active listings are performing well!</p>
        </div>
      ) : (
        <div className={styles.recommendationsGrid}>
          {recommendations.map(rec => (
            <div key={rec.auctionId} className={styles.recCard}>
              <div className={styles.cardHeader}>
                <h3>{rec.itemName}</h3>
                <span className={styles.roi}>{rec.estimatedROI}% ROI</span>
              </div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span>Current Bids</span>
                  <strong>{rec.currentBids}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Projected With Boost</span>
                  <strong className={styles.projected}>{rec.estimatedBidsWithBoost}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Extra Bids Expected</span>
                  <strong className={styles.increase}>+{rec.estimatedBidsWithBoost - rec.currentBids}</strong>
                </div>
              </div>

              <p className={styles.reason}>{rec.reason}</p>

              <div className={styles.boostOptions}>
                {(["promoted", "highlighted", "featured"] as const).map(boostType => {
                  const config = getBoostConfig(boostType);
                  return (
                    <button
                      key={boostType}
                      className={styles.boostBtn}
                      style={{ borderColor: config.color, "--boost-color": config.color } as any}
                      onClick={() => handleCreateBoost(rec.auctionId, boostType)}
                      disabled={boosting}
                    >
                      <div className={styles.boostLabel} style={{ color: config.color }}>
                        {config.label}
                      </div>
                      <div className={styles.boostPrice}>${(config.price / 100).toFixed(2)}</div>
                      <div className={styles.boostDesc}>{config.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
