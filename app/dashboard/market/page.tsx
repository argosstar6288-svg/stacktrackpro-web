"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";
import { CustomLineChart } from "@/lib/charts";
import { useUserCards } from "@/lib/cards";
import {
  getPricingTrendAnalysis,
  getCollectionValuation,
  getDealAlerts,
  type PricingTrend,
  type CollectionValuation,
  type DealAlert,
} from "../../lib/revenueMetrics";
import styles from "./market.module.css";

type AITab = "pricing" | "valuation" | "deals";

export default function MarketPage() {
  const router = useRouter();
  const { currency } = useCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeAiTab, setActiveAiTab] = useState<AITab>("pricing");
  const [aiLoading, setAiLoading] = useState(true);
  const [trends, setTrends] = useState<PricingTrend[]>([]);
  const [valuation, setValuation] = useState<CollectionValuation | null>(null);
  const [dealAlerts, setDealAlerts] = useState<DealAlert[]>([]);
  const { cards, loading: cardsLoading } = useUserCards();
  
  const marketData = useMemo(() => {
    const safeValues = (cards || [])
      .map((card) => Number(card.value))
      .filter((value) => Number.isFinite(value) && value >= 0);

    const baseAverage =
      safeValues.length > 0
        ? safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length
        : 100;

    return Array.from({ length: 30 }).map((_, idx) => {
      const trend = 1 + idx * 0.0025;
      const seasonality = 1 + Math.sin(idx / 4) * 0.05;
      const avgPrice = Math.max(1, Math.round(baseAverage * trend * seasonality));
      const volume = 18 + ((idx * 7) % 31);

      return {
        name: `Day ${idx + 1}`,
        avgPrice,
        volume,
      };
    });
  }, [cards]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserId(user.uid);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadAIData = async () => {
    if (!userId) {
      setAiLoading(false);
      return;
    }

    try {
      setAiLoading(true);
      const [pricingData, valuationData, dealsData] = await Promise.all([
        getPricingTrendAnalysis(),
        getCollectionValuation(userId),
        getDealAlerts(userId),
      ]);

      setTrends(pricingData);
      setValuation(valuationData);
      setDealAlerts(dealsData);
    } catch (error) {
      console.error("Error loading AI market intelligence:", error);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadAIData();
  }, [userId]);

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Market</p>
          <h1 className={styles.title}>Market Overview</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.search}>
            <input type="text" placeholder="Search market..." />
          </div>
          <Link className={styles.actionLink} href="/auction">
            Live Auctions
          </Link>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.highlight}>
              <div>
                <p className={styles.highlightLabel}>Market Pulse</p>
                <p className={styles.highlightValue}>+3.2%</p>
                <p className={styles.highlightSub}>Last 7 days</p>
              </div>
              <button className={styles.primaryButton} type="button">
                Browse Listings
              </button>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Market Overview (30 Days)</h2>
                <p className={styles.panelSubtitle}>Average price from your collection</p>
              </div>
              <span className={styles.panelBadge}>Updated today</span>
            </div>
            <div className={styles.chartWrap}>
              <div className={styles.chartCanvas}>
                <CustomLineChart
                  data={marketData}
                  dataKey="avgPrice"
                  height={300}
                  color="#ff7a47"
                />
              </div>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>AI Market Intelligence</h2>
                <p className={styles.panelSubtitle}>Pricing trends, valuation, and deal alerts</p>
              </div>
              <button
                className={styles.aiRefreshBtn}
                type="button"
                onClick={loadAIData}
                disabled={aiLoading}
              >
                {aiLoading ? "Analyzing..." : "Refresh AI"}
              </button>
            </div>

            <div className={styles.aiTabs}>
              <button
                type="button"
                className={`${styles.aiTab} ${activeAiTab === "pricing" ? styles.aiTabActive : ""}`}
                onClick={() => setActiveAiTab("pricing")}
              >
                Pricing Trends
              </button>
              <button
                type="button"
                className={`${styles.aiTab} ${activeAiTab === "valuation" ? styles.aiTabActive : ""}`}
                onClick={() => setActiveAiTab("valuation")}
              >
                Collection Value
              </button>
              <button
                type="button"
                className={`${styles.aiTab} ${activeAiTab === "deals" ? styles.aiTabActive : ""}`}
                onClick={() => setActiveAiTab("deals")}
              >
                Deal Alerts
              </button>
            </div>

            {aiLoading ? (
              <div className={styles.muted}>Analyzing market data...</div>
            ) : activeAiTab === "pricing" ? (
              trends.length === 0 ? (
                <div className={styles.muted}>No trend data available</div>
              ) : (
                <div className={styles.aiGrid}>
                  {trends.map((trend) => (
                    <div key={trend.category} className={styles.aiCard}>
                      <div className={styles.aiCardHeader}>
                        <h3>{trend.category}</h3>
                        <span className={`${styles.aiTrendBadge} ${styles[`aiTrend_${trend.direction}`]}`}>
                          {trend.direction === "uptrend"
                            ? "📈 Uptrend"
                            : trend.direction === "downtrend"
                            ? "📉 Downtrend"
                            : "➡️ Stable"}
                        </span>
                      </div>
                      <div className={styles.aiMetrics}>
                        <div><span>7-Day:</span><strong>{formatCurrency(trend.predictedPrice7d, currency)}</strong></div>
                        <div><span>30-Day:</span><strong>{formatCurrency(trend.predictedPrice30d, currency)}</strong></div>
                        <div><span>Momentum:</span><strong>{trend.momentum}/100</strong></div>
                        <div><span>Confidence:</span><strong>{trend.confidence}%</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeAiTab === "valuation" ? (
              valuation ? (
                <div className={styles.aiValuationWrap}>
                  <div className={styles.aiStatsGrid}>
                    <div className={styles.aiStatCard}>
                      <span>Current Value</span>
                      <strong>{formatCurrency(valuation.estimatedValue, currency)}</strong>
                    </div>
                    <div className={styles.aiStatCard}>
                      <span>Potential Value</span>
                      <strong>{formatCurrency(valuation.potentialValue, currency)}</strong>
                    </div>
                    <div className={styles.aiStatCard}>
                      <span>Growth Potential</span>
                      <strong>+{formatCurrency(valuation.gainPotential, currency)}</strong>
                    </div>
                    <div className={styles.aiStatCard}>
                      <span>Risk Level</span>
                      <strong>{valuation.riskAdjustment > 50 ? "High" : valuation.riskAdjustment > 30 ? "Medium" : "Low"}</strong>
                    </div>
                  </div>
                  <p className={styles.aiRecommendation}>{valuation.recommendation}</p>
                </div>
              ) : (
                <div className={styles.muted}>No valuation data available</div>
              )
            ) : dealAlerts.length === 0 ? (
              <div className={styles.muted}>No deals matching your criteria</div>
            ) : (
              <div className={styles.aiDealsList}>
                {dealAlerts.slice(0, 6).map((deal) => (
                  <div key={deal.id} className={styles.aiDealCard}>
                    <div className={styles.aiDealHeader}>
                      <h3>{deal.itemName}</h3>
                      <span className={styles.aiDealScore}>{deal.dealScore}/100</span>
                    </div>
                    <div className={styles.aiMetrics}>
                      <div><span>Current:</span><strong>{formatCurrency(deal.currentPrice, currency)}</strong></div>
                      <div><span>Market:</span><strong>{formatCurrency(deal.predictedMarketValue, currency)}</strong></div>
                      <div><span>Discount:</span><strong>-{deal.discountPercentage}%</strong></div>
                      <div><span>Profit:</span><strong>{formatCurrency(deal.estimatedProfit, currency)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Your Collection</h2>
                <p className={styles.panelSubtitle}>Top cards by value</p>
              </div>
              <Link className={styles.panelLink} href="/dashboard/portfolio">
                View all
              </Link>
            </div>
            <div className={styles.cardsGrid}>
              {cardsLoading ? (
                <div className={styles.muted}>Loading cards...</div>
              ) : (cards || []).length > 0 ? (
                (cards || []).slice(0, 6).map((card) => (
                  <div key={card.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardName}>{card.name}</div>
                      <div className={styles.cardBadge}>{card.rarity || "Common"}</div>
                    </div>
                    <div className={styles.cardMeta}>{card.year || "N/A"}</div>
                    <div className={styles.cardValue}>
                      {formatCurrency(card.value, currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.muted}>No cards in collection</div>
              )}
            </div>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>By Value</h2>
                <p className={styles.panelSubtitle}>Inventory breakdown</p>
              </div>
            </div>
            {(cards || []).length > 0 ? (
              <div className={styles.rarityList}>
                {(() => {
                  const valueRanges = [
                    { label: `Under ${formatCurrency(100, currency)}`, min: 0, max: 100 },
                    { label: `${formatCurrency(100, currency)} - ${formatCurrency(500, currency)}`, min: 100, max: 500 },
                    { label: `${formatCurrency(500, currency)} - ${formatCurrency(1000, currency)}`, min: 500, max: 1000 },
                    { label: `${formatCurrency(1000, currency)} - ${formatCurrency(5000, currency)}`, min: 1000, max: 5000 },
                    { label: `Over ${formatCurrency(5000, currency)}`, min: 5000, max: Infinity },
                  ];
                  
                  const breakdown = valueRanges.map(range => {
                    const cardsInRange = (cards || []).filter(
                      card => card.value >= range.min && card.value < range.max
                    );
                    const totalValue = cardsInRange.reduce((sum, c) => sum + c.value, 0);
                    return {
                      label: range.label,
                      count: cardsInRange.length,
                      value: totalValue,
                    };
                  }).filter(item => item.count > 0);
                  
                  return breakdown.map((item) => (
                    <div key={item.label} className={styles.rarityRow}>
                      <span>{item.label}</span>
                      <span>{formatCurrency(item.value, currency)}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className={styles.muted}>No cards yet</div>
            )}
          </section>

          <section className={`panel ${styles.panel} ${styles.valuePanel}`}>
            <p className={styles.valueLabel}>Average Price</p>
            <div className={styles.valueAmount}>
              {(cards || []).length > 0
                ? formatCurrency(Math.floor(
                    cards.reduce((sum, c) => sum + c.value, 0) / cards.length
                  ), currency)
                : formatCurrency(0, currency)}
            </div>
            <p className={styles.valueNote}>Based on your tracked cards</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
