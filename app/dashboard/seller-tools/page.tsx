"use client";

import { useState, useEffect } from "react";
import styles from "./seller-tools.module.css";
import {
  getSellerOptimization,
  SellerOptimization,
} from "../../lib/revenueMetrics";
import { useCurrentUser } from "../../lib/useCurrentUser";

interface SellerAuction {
  id: string;
  name: string;
  currentPrice: number;
  description: string;
  imageCount: number;
  category: string;
}

export default function SellerOptimizationTools() {
  const { user } = useCurrentUser();
  const [auctions, setAuctions] = useState<SellerAuction[]>([]);
  const [optimizations, setOptimizations] = useState<Map<string, SellerOptimization | null>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSellerAuctions();
  }, []);

  const loadSellerAuctions = async () => {
    try {
      setLoading(true);
      // Mock seller auctions - in production would query Firestore
      const mockAuctions: SellerAuction[] = [
        {
          id: "1",
          name: "Vintage Action Figure",
          currentPrice: 89.99,
          description: "Figure",
          imageCount: 2,
          category: "Toys",
        },
        {
          id: "2",
          name: "Rare Trading Card",
          currentPrice: 45.00,
          description: "A rare card from the 1990s. Good condition.",
          imageCount: 4,
          category: "Cards",
        },
      ];
      setAuctions(mockAuctions);

      // Load optimizations for each
      const opts = new Map<string, SellerOptimization | null>();
      for (const auction of mockAuctions) {
        const opt = await getSellerOptimization(auction.id);
        opts.set(auction.id, opt);
      }
      setOptimizations(opts);
    } catch (error) {
      console.error("Error loading seller auctions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Analyzing your listings...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🛠️ AI Seller Optimization</h1>
        <p>Get AI-powered suggestions to boost your sales</p>
      </div>

      <div className={styles.listingsContainer}>
        {auctions.map(auction => {
          const opt = optimizations.get(auction.id);
          return (
            <div key={auction.id} className={styles.listingCard}>
              <div className={styles.listingHeader}>
                <div>
                  <h3>{auction.name}</h3>
                  <p className={styles.category}>{auction.category}</p>
                </div>
                {opt && (
                  <div
                    className={styles.qualityScore}
                    style={{ borderColor: getQualityColor(opt.listingQualityScore) }}
                  >
                    <span>{opt.listingQualityScore}</span>
                    <p>Quality</p>
                  </div>
                )}
              </div>

              {opt ? (
                <>
                  <div className={styles.priceAnalysis}>
                    <div className={styles.priceItem}>
                      <span>Current Price</span>
                      <strong>${opt.currentPrice}</strong>
                    </div>
                    <div className={styles.arrow}>→</div>
                    <div className={styles.priceItem}>
                      <span>Optimal Price</span>
                      <strong>${opt.optimalPrice}</strong>
                    </div>
                    <div
                      className={`${styles.adjustment} ${opt.priceAdjustment > 0 ? styles.increase : styles.decrease}`}
                    >
                      {opt.priceAdjustment > 0 ? "+" : ""}{opt.priceAdjustment}%
                    </div>
                  </div>

                  <div className={styles.impact}>
                    <strong>Estimated Impact:</strong>
                    <span className={opt.estimatedSalesIncrease > 0 ? styles.positive : styles.negative}>
                      {opt.estimatedSalesIncrease > 0 ? "+" : ""}{opt.estimatedSalesIncrease}% sales increase
                    </span>
                  </div>

                  <div className={styles.titleSuggestion}>
                    <strong>Recommended Title:</strong>
                    <p>{opt.recommendedTitle}</p>
                  </div>

                  <div className={styles.improvements}>
                    <strong>Improvements Needed:</strong>
                    <ul>
                      {opt.improvements.map((improvement, i) => (
                        <li key={i}>{improvement}</li>
                      ))}
                    </ul>
                  </div>

                  <button className={styles.updateBtn}>
                    Review & Update Listing
                  </button>
                </>
              ) : (
                <div className={styles.noOpt}>Unable to generate optimization</div>
              )}
            </div>
          );
        })}
      </div>

      {auctions.length === 0 && (
        <div className={styles.empty}>No active listings. Create a new auction to get optimization tips.</div>
      )}
    </div>
  );
}
