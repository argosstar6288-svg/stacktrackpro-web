"use client";

import { useState, useEffect } from "react";
import styles from "./ai-dashboard.module.css";
import {
  getPricingTrendAnalysis,
  getCollectionValuation,
  getDealAlerts,
  BuyerRecommendation,
  PricingTrend,
  DealAlert,
  CollectionValuation,
} from "../../lib/revenueMetrics";
import { useCurrentUser } from "../../lib/useCurrentUser";

type TabType = 'pricing' | 'valuation' | 'deals';

export default function AIDashboard() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabType>('pricing');
  const [loading, setLoading] = useState(true);
  
  const [trends, setTrends] = useState<PricingTrend[]>([]);
  const [valuation, setValuation] = useState<CollectionValuation | null>(null);
  const [dealAlerts, setDealAlerts] = useState<DealAlert[]>([]);

  useEffect(() => {
    loadAIData();
  }, []);

  const loadAIData = async () => {
    try {
      setLoading(true);
      
      if (user?.uid) {
        const [pricingData, valuationData, dealsData] = await Promise.all([
          getPricingTrendAnalysis(),
          getCollectionValuation(user.uid),
          getDealAlerts(),
        ]);

        setTrends(pricingData);
        setValuation(valuationData);
        setDealAlerts(dealsData);
      }
    } catch (error) {
      console.error("Error loading AI data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Analyzing market data...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>AI Market Intelligence</h1>
        <p>Machine learning-powered insights for smarter collecting</p>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'pricing' ? styles.active : ''}`} onClick={() => setActiveTab('pricing')}>
          Pricing Trends
        </button>
        <button className={`${styles.tab} ${activeTab === 'valuation' ? styles.active : ''}`} onClick={() => setActiveTab('valuation')}>
          Collection Value
        </button>
        <button className={`${styles.tab} ${activeTab === 'deals' ? styles.active : ''}`} onClick={() => setActiveTab('deals')}>
          Deal Alerts
        </button>
      </div>

      {activeTab === 'pricing' && (
        <div className={styles.section}>
          {trends.length === 0 ? (
            <div className={styles.empty}>No trend data available</div>
          ) : (
            <div className={styles.trendGrid}>
              {trends.map(trend => (
                <div key={trend.category} className={styles.trendCard}>
                  <h3>{trend.category}</h3>
                  <div className={`${styles.trendBadge} ${styles[`trend_${trend.direction}`]}`}>
                    {trend.direction === 'uptrend' ? '📈 Uptrend' : trend.direction === 'downtrend' ? '📉 Downtrend' : '➡️ Stable'}
                  </div>
                  <div className={styles.metrics}>
                    <div><span>Current Avg:</span> <strong>${trend.confidence || 0}</strong></div>
                    <div><span>7-Day Projection:</span> <strong>${trend.predictedPrice7d}</strong></div>
                    <div><span>30-Day Projection:</span> <strong>${trend.predictedPrice30d}</strong></div>
                    <div><span>Momentum:</span> <strong>{trend.momentum}/100</strong></div>
                  </div>
                  <p className={styles.reasoning}>{trend.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'valuation' && valuation && (
        <div className={styles.section}>
          <h2>💎 AI Collection Valuation</h2>
          <div className={styles.valuationGrid}>
            <div className={styles.valuationCard}>
              <div className={styles.valuationMetric}>
                <span>Current Value</span>
                <strong>${valuation.estimatedValue.toLocaleString()}</strong>
              </div>
            </div>
            <div className={styles.valuationCard}>
              <div className={styles.valuationMetric}>
                <span>Potential Value</span>
                <strong>${valuation.potentialValue.toLocaleString()}</strong>
              </div>
            </div>
            <div className={styles.valuationCard}>
              <div className={styles.valuationMetric}>
                <span>Growth Potential</span>
                <strong className={styles.positive}>+${valuation.gainPotential.toLocaleString()}</strong>
              </div>
            </div>
            <div className={styles.valuationCard}>
              <div className={styles.valuationMetric}>
                <span>Risk Level</span>
                <strong>{valuation.riskAdjustment > 50 ? 'High' : valuation.riskAdjustment > 30 ? 'Medium' : 'Low'}</strong>
              </div>
            </div>
          </div>
          <div className={styles.recommendation}>{valuation.recommendation}</div>
          {valuation.topPerformers.length > 0 && (
            <div className={styles.topPerformers}>
              <h3>Top Performers</h3>
              {valuation.topPerformers.map(item => (
                <div key={item.name} className={styles.performerItem}>
                  <span>{item.name}</span>
                  <span>${item.value}</span>
                  <span className={styles.growth}>+{item.growth}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'deals' && (
        <div className={styles.section}>
          <h2>🎯 AI Deal Finder</h2>
          {dealAlerts.length === 0 ? (
            <div className={styles.empty}>No deals matching your criteria</div>
          ) : (
            <div className={styles.dealsList}>
              {dealAlerts.map(deal => (
                <div key={deal.id} className={styles.dealCard}>
                  <div className={styles.dealHeader}>
                    <h3>{deal.itemName}</h3>
                    <div className={styles.dealScore}>{deal.dealScore}/100</div>
                  </div>
                  <div className={styles.dealMetrics}>
                    <div><span>Current Price:</span> <strong>${deal.currentPrice}</strong></div>
                    <div><span>Market Value:</span> <strong>${deal.predictedMarketValue}</strong></div>
                    <div><span>Discount:</span> <strong className={styles.savings}>-{deal.discountPercentage}%</strong></div>
                    <div><span>Profit Potential:</span> <strong>${deal.estimatedProfit}</strong></div>
                  </div>
                  <p className={styles.dealReason}>{deal.reason}</p>
                  <div className={styles.dealTime}>Expires in {deal.expiresIn} minutes</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={loadAIData} className={styles.refreshBtn}>🔄 Refresh Analysis</button>
    </div>
  );
}
