"use client";

import { useState, useEffect } from "react";
import styles from "./auto-bid.module.css";
import {
  getAutoBidRecommendation,
  AutoBidRecommendation,
} from "../../lib/revenueMetrics";

interface ActiveAuction {
  id: string;
  name: string;
  currentBid: number;
  endTime: Date;
  bidCount: number;
}

export default function AutoBidAdvisor() {
  const [activeAuctions, setActiveAuctions] = useState<ActiveAuction[]>([]);
  const [recommendations, setRecommendations] = useState<Map<string, AutoBidRecommendation | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedBudget, setSelectedBudget] = useState<number | undefined>();

  useEffect(() => {
    loadAuctions();
  }, []);

  const loadAuctions = async () => {
    try {
      setLoading(true);
      // Mock active auctions - in production would query Firestore
      const mockAuctions: ActiveAuction[] = [
        { id: "1", name: "Vintage Pokemon Card", currentBid: 150, endTime: new Date(Date.now() + 3600000), bidCount: 5 },
        { id: "2", name: "Rare Comic Book", currentBid: 45, endTime: new Date(Date.now() + 7200000), bidCount: 2 },
        { id: "3", name: "Collectible Toy", currentBid: 200, endTime: new Date(Date.now() + 1800000), bidCount: 8 },
      ];
      setActiveAuctions(mockAuctions);

      // Load recommendations for each
      const recs = new Map<string, AutoBidRecommendation | null>();
      for (const auction of mockAuctions) {
        const rec = await getAutoBidRecommendation(auction.id, selectedBudget);
        recs.set(auction.id, rec);
      }
      setRecommendations(recs);
    } catch (error) {
      console.error("Error loading auctions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case "aggressive":
        return "#ef4444";
      case "conservative":
        return "#3b82f6";
      default:
        return "#f59e0b";
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Analyzing auction opportunities...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>AI Auto-Bid Advisor</h1>
        <p>Get smart bidding strategies for each auction</p>
      </div>

      <div className={styles.budgetSection}>
        <label>
          Optional Budget Limit:
          <input
            type="number"
            value={selectedBudget || ""}
            onChange={(e) => setSelectedBudget(e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="Enter max bid amount"
            className={styles.budgetInput}
          />
        </label>
        <button onClick={() => { setSelectedBudget(undefined); loadAuctions(); }} className={styles.clearBtn}>
          Clear & Reload
        </button>
      </div>

      <div className={styles.auctionsGrid}>
        {activeAuctions.map(auction => {
          const rec = recommendations.get(auction.id);
          return (
            <div key={auction.id} className={styles.auctionCard}>
              <div className={styles.cardHeader}>
                <h3>{auction.name}</h3>
                <div className={styles.bidCount}>{auction.bidCount} bids</div>
              </div>

              <div className={styles.currentBid}>
                <span>Current Bid</span>
                <strong>${auction.currentBid}</strong>
              </div>

              {rec ? (
                <>
                  <div className={styles.recommendations}>
                    <div className={styles.recItem}>
                      <span>Suggested Bid</span>
                      <strong>${rec.suggestedBidAmount}</strong>
                    </div>
                    <div className={styles.recItem}>
                      <span>Max Safe Bid</span>
                      <strong>${rec.maxBidAmount}</strong>
                    </div>
                    <div className={styles.recItem}>
                      <span>Win Probability</span>
                      <strong>{rec.expectedWinPercent}%</strong>
                    </div>
                    <div className={styles.recItem}>
                      <span>Projected Final Price</span>
                      <strong>${rec.priceProjection}</strong>
                    </div>
                  </div>

                  <div
                    className={styles.strategyBadge}
                    style={{ backgroundColor: getStrategyColor(rec.recommendedStrategy) }}
                  >
                    {rec.recommendedStrategy.toUpperCase()}
                  </div>

                  <p className={styles.reasoning}>{rec.reasoning}</p>

                  <button className={styles.bidBtn}>
                    Place Bid: ${rec.suggestedBidAmount}
                  </button>
                </>
              ) : (
                <div className={styles.noRec}>Unable to generate recommendation</div>
              )}

              <div className={styles.timeRemaining}>
                Ends in {Math.round((auction.endTime.getTime() - Date.now()) / 60000)} minutes
              </div>
            </div>
          );
        })}
      </div>

      {activeAuctions.length === 0 && (
        <div className={styles.empty}>No active auctions available</div>
      )}
    </div>
  );
}
