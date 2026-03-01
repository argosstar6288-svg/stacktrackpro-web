"use client";

import { useState, useEffect } from "react";
import styles from "./pricing-advisor.module.css";
import {
  getTrendingCategories,
  getFastestSellingCategories,
  getPriceSignals,
  getUnderpriceAlerts,
  TrendingCategory,
  FastestSellingCategory,
  PriceSignal,
  UnderpriceAlert,
} from "../../lib/revenueMetrics";

export default function PricingAdvisorPage() {
  const [trendingCategories, setTrendingCategories] = useState<TrendingCategory[]>([]);
  const [fastestSelling, setFastestSelling] = useState<FastestSellingCategory[]>([]);
  const [priceSignals, setPriceSignals] = useState<PriceSignal[]>([]);
  const [underpriceAlerts, setUnderpriceAlerts] = useState<UnderpriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      const [trending, fastest, signals, underpriced] = await Promise.all([
        getTrendingCategories(7),
        getFastestSellingCategories(),
        getPriceSignals(30),
        getUnderpriceAlerts(0.85),
      ]);

      setTrendingCategories(trending);
      setFastestSelling(fastest);
      setPriceSignals(signals);
      setUnderpriceAlerts(underpriced);
    } catch (err) {
      console.error("Error loading pricing analytics:", err);
      setError("Failed to load pricing analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>Loading pricing analytics...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pricing Advisor</h1>
        <p className={styles.subtitle}>
          Real-time market intelligence to optimize your listings
        </p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Trending Cards Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            🔥 Trending Categories
          </h2>
          <p className={styles.sectionDesc}>
            Top performing categories by sales momentum (last 7 days)
          </p>
        </div>

        {trendingCategories.length === 0 ? (
          <div className={styles.empty}>No trending data available yet</div>
        ) : (
          <div className={styles.cardsGrid}>
            {trendingCategories.slice(0, 6).map((category) => (
              <div key={category.category} className={styles.trendingCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.categoryName}>{category.category}</h3>
                  <div
                    className={`${styles.trendBadge} ${styles[`trend_${category.trend}`]}`}
                  >
                    {category.trend === "up" ? "↑" : category.trend === "down" ? "↓" : "→"}{" "}
                    {Math.abs(category.trendPercentage)}%
                  </div>
                </div>

                <div className={styles.metricRow}>
                  <span className={styles.label}>Sales</span>
                  <span className={styles.value}>{category.salesCount}</span>
                </div>

                <div className={styles.metricRow}>
                  <span className={styles.label}>Avg Price</span>
                  <span className={styles.value}>${category.avgPrice}</span>
                </div>

                <div className={styles.metricRow}>
                  <span className={styles.label}>Volume</span>
                  <span className={styles.value}>${category.totalVolume.toLocaleString()}</span>
                </div>

                <div className={styles.momentumBar}>
                  <div
                    className={styles.momentumFill}
                    style={{ width: `${category.momentum}%` }}
                  ></div>
                </div>
                <div className={styles.momentumLabel}>
                  Momentum: {category.momentum}/100
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fastest Selling Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>⚡ Fastest Selling Categories</h2>
          <p className={styles.sectionDesc}>
            Average time to sell with completion rates
          </p>
        </div>

        {fastestSelling.length === 0 ? (
          <div className={styles.empty}>No sales data available</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Avg Time to Sell</th>
                  <th>Sales</th>
                  <th>Completion Rate</th>
                  <th>Avg Price</th>
                  <th>Momentum</th>
                </tr>
              </thead>
              <tbody>
                {fastestSelling.slice(0, 8).map((category) => (
                  <tr key={category.category}>
                    <td className={styles.categoryCell}>{category.category}</td>
                    <td>
                      <strong>{category.avgTimeToSell}h</strong>
                    </td>
                    <td>{category.salesCount}</td>
                    <td>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progress}
                          style={{ width: `${category.completionRate}%` }}
                        ></div>
                        <span>{category.completionRate}%</span>
                      </div>
                    </td>
                    <td>${category.avgPrice}</td>
                    <td>
                      <div className={styles.momentumScore}>
                        {category.momentum}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Price Signals Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>📈 Rising Price Signals</h2>
          <p className={styles.sectionDesc}>
            Categories with significant price momentum (7d vs 30d)
          </p>
        </div>

        {priceSignals.length === 0 ? (
          <div className={styles.empty}>No price signal data available</div>
        ) : (
          <div className={styles.signalsGrid}>
            {priceSignals.slice(0, 6).map((signal) => (
              <div
                key={signal.category}
                className={`${styles.signalCard} ${styles[`signal_${signal.direction}`]}`}
              >
                <div className={styles.signalHeader}>
                  <h3 className={styles.signalCategory}>{signal.category}</h3>
                  <div className={styles.directionIcon}>
                    {signal.direction === "rising"
                      ? "📈"
                      : signal.direction === "falling"
                      ? "📉"
                      : "➡️"}
                  </div>
                </div>

                <div className={styles.signalBody}>
                  <div className={styles.signalMetric}>
                    <span className={styles.label}>7-Day Avg</span>
                    <span className={styles.price}>${signal.avgPrice7d}</span>
                  </div>

                  <div className={styles.signalMetric}>
                    <span className={styles.label}>30-Day Avg</span>
                    <span className={styles.price}>${signal.avgPrice30d}</span>
                  </div>

                  <div className={styles.changeAmount}>
                    {signal.direction === "rising" ? "+" : ""}
                    {signal.percentChange.toFixed(1)}%
                  </div>
                </div>

                <div className={styles.signalFooter}>
                  <p className={styles.reasoning}>{signal.reasoning}</p>
                  <div className={styles.confidence}>
                    Confidence: {signal.confidence}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Underpriced Listings Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🎯 Underpriced Listings Alert</h2>
          <p className={styles.sectionDesc}>
            Items priced 15%+ below market average (potential flip opportunities)
          </p>
        </div>

        {underpriceAlerts.length === 0 ? (
          <div className={styles.empty}>No underpriced listings detected</div>
        ) : (
          <div className={styles.alertsList}>
            {underpriceAlerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className={styles.alertCard}>
                <div className={styles.alertTitle}>{alert.auctionTitle}</div>

                <div className={styles.alertMeta}>
                  <span className={styles.category}>{alert.category}</span>
                  <span className={styles.confidence}>
                    {alert.confidence}% confident
                  </span>
                </div>

                <div className={styles.alertMetrics}>
                  <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Current</div>
                    <div className={styles.metricValue}>${alert.listingPrice}</div>
                  </div>

                  <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Market Avg</div>
                    <div className={styles.metricValue}>
                      ${alert.marketAveragePrice}
                    </div>
                  </div>

                  <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Discount</div>
                    <div className={`${styles.metricValue} ${styles.discount}`}>
                      -{alert.underpricePercentage}%
                    </div>
                  </div>

                  <div className={styles.metricBox}>
                    <div className={styles.metricLabel}>Potential Profit</div>
                    <div className={styles.metricValue} style={{ color: "#059669" }}>
                      +${alert.potentialProfit}
                    </div>
                  </div>
                </div>

                <p className={styles.recommendation}>{alert.recommendation}</p>

                <a href={`/auction/${alert.id}`} className={styles.viewBtn}>
                  View Listing →
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.footer}>
        <button onClick={loadAnalytics} className={styles.refreshBtn}>
          🔄 Refresh Data
        </button>
        <p className={styles.refreshNote}>
          Analytics update every hour. Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
