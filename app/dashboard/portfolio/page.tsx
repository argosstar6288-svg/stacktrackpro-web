"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CustomBarChart } from "@/lib/charts";
import { useUserCards } from "@/lib/cards";
import { 
  calculatePortfolioMetrics, 
  getPortfolioTimeSeries, 
  getCardValueHistory,
  calculateTrendIndicator,
  PortfolioMetrics,
  PortfolioTimeSeries,
  CardValueHistory
} from "../../lib/revenueMetrics";
import styles from "./portfolio.module.css";
import "../../signup/dashboard.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function PortfolioPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const { cards, loading: cardsLoading } = useUserCards();
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<PortfolioTimeSeries[]>([]);
  const [cardHistory, setCardHistory] = useState<CardValueHistory[]>([]);
  const [trendData, setTrendData] = useState<any>(null);

  // Map real card data to chart format
  const portfolioData = (cards || []).slice(0, 7).map((card, idx) => ({
    name: card.name.substring(0, 10),
    value: card.value,
    earnings: Math.floor(card.value * (0.05 + Math.random() * 0.15))
  }));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUserId(user.uid);
        // Load portfolio analytics
        const metrics = await calculatePortfolioMetrics(user.uid);
        const series = await getPortfolioTimeSeries(user.uid, 30);
        const history = await getCardValueHistory(user.uid);
        const trend = calculateTrendIndicator(series);

        setPortfolioMetrics(metrics);
        setTimeSeries(series);
        setCardHistory(history);
        setTrendData(trend);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dash-root">
      {/* SIDEBAR */}
      <div className="dash-sidebar">
        <nav>
          <Link href="/dashboard" title="Home">
            🏠
          </Link>
          <Link href="/dashboard/portfolio" title="Portfolio">
            📊
          </Link>
          <Link href="/dashboard/market" title="Market">
            📈
          </Link>
          <Link href="/auction" title="Auctions">
            🔨
          </Link>
          <Link href="/dashboard/profile" title="Profile">
            👤
          </Link>
          <Link href="/dashboard/settings" title="Settings">
            ⚙️
          </Link>
        </nav>
      </div>

      {/* MAIN CONTENT */}
      <div className="dash-main">
        {/* TOP BAR */}
        <div className="dash-top">
          <h1>📊 Portfolio</h1>
          <div className="dash-search">
            <input type="text" placeholder="Search portfolio..." />
          </div>
          <div className="dash-user">
            <span>👤 User</span>
          </div>
        </div>

        {/* CONTENT */}
        <div className="dash-content">
          {/* CENTER */}
          <div className="dash-center">
            {/* KEY METRICS CARDS */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total Collection Value</div>
                <div className={styles.metricValue}>
                  ${portfolioMetrics?.totalValue.toLocaleString() || "0"}
                </div>
                <div className={styles.metricSubtext}>
                  {portfolioMetrics?.itemCount || 0} Items
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Estimated Appreciation</div>
                <div className={`${styles.metricValue} ${(portfolioMetrics?.estimatedAppreciation || 0) >= 0 ? styles.positive : styles.negative}`}>
                  ${portfolioMetrics?.estimatedAppreciation.toLocaleString() || "0"}
                </div>
                <div className={styles.metricSubtext}>
                  +{portfolioMetrics?.appreciationPercentage.toFixed(1) || "0"}% Gain
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Price Movement</div>
                <div className={`${styles.metricValue} ${styles[`trend_${trendData?.trend}`]}`}>
                  {trendData?.trend === 'bullish' ? '📈' : trendData?.trend === 'bearish' ? '📉' : '➡️'}
                  {trendData?.direction.toFixed(2)}%
                </div>
                <div className={styles.metricSubtext}>
                  {trendData?.trend === 'bullish' ? 'Strong Uptrend' : trendData?.trend === 'bearish' ? 'Downtrend' : 'Stable'}
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Trend Strength</div>
                <div className={styles.trendStrengthBar}>
                  <div 
                    className={styles.trendStrengthFill}
                    style={{
                      width: `${trendData?.strength || 50}%`,
                      backgroundColor: trendData?.trend === 'bullish' ? '#10b3f0' : trendData?.trend === 'bearish' ? '#ff6b6b' : '#ffc107'
                    }}
                  ></div>
                </div>
                <div className={styles.metricSubtext}>
                  {trendData?.strength || 50}/100
                </div>
              </div>
            </div>

            {/* VALUE OVER TIME CHART */}
            <div className={styles.chartSection}>
              <h3>Portfolio Value Over Time (30 Days)</h3>
              {timeSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeries} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                      interval={Math.floor(timeSeries.length / 5)}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Portfolio Value ($)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111827', border: '1px solid #10b3f0', borderRadius: '8px' }}
                      labelStyle={{ color: '#10b3f0' }}
                      formatter={(value: any) => `$${value.toLocaleString()}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#10b3f0" 
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  Loading chart data...
                </div>
              )}
            </div>

            {/* PORTFOLIO PERFORMANCE BAR CHART */}
            <div className="market-box">
              <h3>Portfolio Performance (7 Days)</h3>
              <CustomBarChart 
                data={portfolioData} 
                dataKey="value" 
                dataKey2="earnings"
                height={250}
                color="#10b3f0"
              />
            </div>

            {/* TOP GAINERS */}
            {cardHistory.length > 0 && (
              <div className={styles.topGainersSection}>
                <h3>Top Gainers</h3>
                <div className={styles.cardChangesList}>
                  {cardHistory.slice(0, 5).map((card) => (
                    <div key={card.cardId} className={styles.cardChangeItem}>
                      <div className={styles.cardChangeName}>{card.cardName}</div>
                      <div className={styles.cardChangeValue}>
                        ${card.priorValue} → <strong>${card.currentValue}</strong>
                      </div>
                      <div className={`${styles.cardChangePercent} ${card.change >= 0 ? styles.positive : styles.negative}`}>
                        {card.change >= 0 ? '+' : ''}{card.changePercent.toFixed(1)}% ({card.change >= 0 ? '+' : '-'}${Math.abs(card.change)})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PORTFOLIO BREAKDOWN */}
            <div>
              <h3>Your Cards</h3>
              <div className="portfolio-cards">
                {cardsLoading ? (
                  <div style={{ color: "#999" }}>Loading cards...</div>
                ) : (cards || []).length > 0 ? (
                  (cards || []).slice(0, 5).map((card) => (
                    <div key={card.id} className="card" style={{ borderLeft: `4px solid ${
                      card.rarity === "Legendary" ? "#FFD700" :
                      card.rarity === "Rare" ? "#C0C0C0" :
                      card.rarity === "Uncommon" ? "#CD7F32" :
                      "#999"
                    }` }}>
                      <div style={{ fontWeight: "bold" }}>{card.name}</div>
                      <div style={{ fontSize: "0.85em", color: "#bbb" }}>{card.player || "N/A"}</div>
                      <div style={{ fontSize: "0.9em", color: "#10b3f0" }}>${card.value.toLocaleString()}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#999" }}>No cards yet. Add your first card!</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="dash-right">
            <div className="folders">
              <h3>By Sport</h3>
              {(cards || []).length > 0 ? (
                Object.entries(
                  (cards || []).reduce((acc: Record<string, number>, card) => {
                    acc[card.sport || "Other"] = (acc[card.sport || "Other"] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([sport, count]) => (
                  <div key={sport} className="folder">
                    <span>{sport}</span>
                    <span>{count}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#999" }}>No cards yet</div>
              )}
            </div>

            <div className="total-value">
              <h4>Highest Value</h4>
              <strong>{(cards || []).length > 0 ? `$${Math.max(...(cards || []).map(c => c.value)).toLocaleString()}` : "$0"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
