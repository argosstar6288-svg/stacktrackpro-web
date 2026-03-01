'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { getRevenueMetrics, type RevenueMetrics } from '../../lib/revenueMetrics';
import { subscribeToRevenueMetrics } from '../../lib/revenueListener';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import styles from './revenue-dashboard.module.css';
import LineChart from './components/LineChart';
import MetricCard from './components/MetricCard';

export default function RevenueDashboard() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (authLoading) return;

    const verifyAdmin = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        // Start live listener
        initializeLiveListener();
      } catch (err) {
        console.error('Error verifying admin:', err);
        setError('Failed to load dashboard');
      }
    };

    verifyAdmin();

    return () => {
      // Cleanup listener on unmount
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user, authLoading, router]);

  const initializeLiveListener = async () => {
    try {
      setLoading(true);
      // Load initial data
      const initialMetrics = await getRevenueMetrics();
      setMetrics(initialMetrics);

      // Set up real-time listener
      const unsubscribe = subscribeToRevenueMetrics(
        (updatedMetrics) => {
          setMetrics(updatedMetrics);
          setIsLive(true);
          // Keep live indicator visible for 3 seconds after update
          setTimeout(() => setIsLive(false), 3000);
        },
        (error) => {
          console.error('Listener error:', error);
          // Fall back to polling if listener fails
          startPolling();
        }
      );

      unsubscribeRef.current = unsubscribe;
      setLoading(false);
    } catch (err) {
      console.error('Error initializing listener:', err);
      setError('Failed to load revenue data');
      setLoading(false);
      // Fall back to polling
      startPolling();
    }
  };

  const startPolling = () => {
    // Poll every 30 seconds as fallback
    const interval = setInterval(async () => {
      try {
        const data = await getRevenueMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 30000);

    // Store interval ID for cleanup
    return () => clearInterval(interval);
  };

  const handleRefresh = async () => {
    try {
      setIsLive(true);
      const data = await getRevenueMetrics();
      setMetrics(data);
      setTimeout(() => setIsLive(false), 2000);
    } catch (err) {
      console.error('Refresh error:', err);
      setError('Failed to refresh data');
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner}></div>
          <p>Loading revenue dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className={styles.container}>
        <div className={styles.errorScreen}>
          <h2>Error Loading Dashboard</h2>
          <p>{error || 'Could not load revenue metrics'}</p>
          <button onClick={handleRefresh} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalRevenue = metrics.subscriptionRevenue + metrics.founderRevenue + metrics.platformFeesEarned;
  const allTimeTopSeller = metrics.topSellers[0];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Revenue Control Center</h1>
          <p>Real-time financial metrics and performance analytics</p>
        </div>
        <button onClick={handleRefresh} className={styles.refreshButton}>
          ↻ Refresh
        </button>
      </div>

      {/* Key Metrics Grid */}
      <section className={styles.metricsSection}>
        <h2>Key Performance Indicators</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            label="Total GMV"
            value={`$${(metrics.totalGMV / 100).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`}
            trend={12.5}
            color="#667eea"
            icon="📊"
            description="Gross Merchandise Volume"
          />
          <MetricCard
            label="Platform Fees Earned"
            value={`$${(metrics.platformFeesEarned / 100).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`}
            trend={8.3}
            color="#30cfd0"
            icon="💰"
            description="15% of GMV"
          />
          <MetricCard
            label="Monthly Recurring Revenue"
            value={`$${(metrics.mrr / 100).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`}
            trend={5.2}
            color="#a8edea"
            icon="📈"
            description="Predictable monthly income"
          />
          <MetricCard
            label="Total Revenue"
            value={`$${(totalRevenue / 100).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}`}
            trend={15.8}
            color="#fa709a"
            icon="💵"
            description="All sources combined"
          />
        </div>
      </section>

      {/* Revenue Breakdown */}
      <section className={styles.breakdownSection}>
        <h2>Revenue Breakdown</h2>
        <div className={styles.breakdownGrid}>
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownLabel}>Subscription Revenue</span>
              <span className={styles.breakdownIcon}>🔄</span>
            </div>
            <div className={styles.breakdownAmount}>
              ${(metrics.subscriptionRevenue / 100).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
            <div className={styles.breakdownDetail}>
              {metrics.activeProUsers} active pro/premium users
            </div>
          </div>

          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownLabel}>Founder Revenue</span>
              <span className={styles.breakdownIcon}>👑</span>
            </div>
            <div className={styles.breakdownAmount}>
              ${(metrics.founderRevenue / 100).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
            <div className={styles.breakdownDetail}>
              {metrics.activeFounders} active founders
            </div>
          </div>

          <div className={styles.breakdownCard}>
            <div className={styles.breakdownHeader}>
              <span className={styles.breakdownLabel}>Platform Fees</span>
              <span className={styles.breakdownIcon}>🏦</span>
            </div>
            <div className={styles.breakdownAmount}>
              ${(metrics.platformFeesEarned / 100).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
            <div className={styles.breakdownDetail}>
              From {metrics.totalGMV > 0 ? '$' + (metrics.totalGMV / 100).toLocaleString() : '$0'} GMV
            </div>
          </div>
        </div>
      </section>

      {/* User Metrics */}
      <section className={styles.userMetricsSection}>
        <h2>User Metrics</h2>
        <div className={styles.userMetricsGrid}>
          <div className={styles.userMetricCard}>
            <div className={styles.userMetricValue}>{metrics.activeProUsers}</div>
            <div className={styles.userMetricLabel}>Active Pro/Premium Users</div>
            <div className={styles.userMetricIcon}>👥</div>
          </div>
          <div className={styles.userMetricCard}>
            <div className={styles.userMetricValue}>{metrics.activeFounders}</div>
            <div className={styles.userMetricLabel}>Active Founders</div>
            <div className={styles.userMetricIcon}>🌟</div>
          </div>
          <div className={styles.userMetricCard}>
            <div className={styles.userMetricValue}>{metrics.topSellers.length}</div>
            <div className={styles.userMetricLabel}>Top Sellers</div>
            <div className={styles.userMetricIcon}>🏆</div>
          </div>
        </div>
      </section>

      {/* Revenue Trends Chart */}
      <section className={styles.chartsSection}>
        <h2>12-Month Revenue Trend</h2>
        <div className={styles.chartContainer}>
          <LineChart data={metrics.revenueTrends} isLive={isLive} />
        </div>
      </section>

      {/* Top Sellers */}
      <section className={styles.topSellersSection}>
        <h2>Top 10 Sellers</h2>
        {metrics.topSellers.length > 0 ? (
          <div className={styles.topSellersTable}>
            <div className={styles.tableHeader}>
              <div className={styles.rankCol}>Rank</div>
              <div className={styles.sellerCol}>Seller</div>
              <div className={styles.emailCol}>Email</div>
              <div className={styles.salesCol}>Total Sales</div>
              <div className={styles.lastSaleCol}>Last Sale</div>
            </div>
            {metrics.topSellers.map((seller, index) => (
              <div key={seller.id} className={styles.tableRow}>
                <div className={styles.rankCol}>
                  <span className={styles.rank}>#{index + 1}</span>
                </div>
                <div className={styles.sellerCol}>
                  <span className={styles.sellerName}>{seller.displayName}</span>
                </div>
                <div className={styles.emailCol}>
                  <span className={styles.email}>{seller.email}</span>
                </div>
                <div className={styles.salesCol}>
                  <span className={styles.amount}>
                    ${(seller.totalSales / 100).toLocaleString('en-US', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <div className={styles.lastSaleCol}>
                  <span className={styles.date}>
                    {seller.lastSaleAt
                      ? (seller.lastSaleAt instanceof Date 
                          ? seller.lastSaleAt 
                          : (seller.lastSaleAt as any).toDate?.() || new Date(seller.lastSaleAt as any)
                        ).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>No sales data available yet</p>
          </div>
        )}
      </section>

      {/* Summary Stats */}
      <section className={styles.summarySection}>
        <div className={styles.summaryCard}>
          <h3>Platform Health</h3>
          <div className={styles.summaryStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Conversion Rate</span>
              <span className={styles.statValue}>
                {metrics.activeProUsers + metrics.activeFounders > 0
                  ? ((metrics.activeProUsers / (metrics.activeProUsers + metrics.activeFounders)) * 100).toFixed(1)
                  : '0'}%
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>ARPU (Annual)</span>
              <span className={styles.statValue}>
                $
                {metrics.activeProUsers + metrics.activeFounders > 0
                  ? ((totalRevenue / (metrics.activeProUsers + metrics.activeFounders) * 12) / 100).toFixed(2)
                  : '0.00'}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Average Transaction</span>
              <span className={styles.statValue}>
                $
                {metrics.topSellers.length > 0
                  ? (metrics.topSellers.reduce((sum, s) => sum + s.totalSales, 0) / metrics.topSellers.length / 100).toFixed(2)
                  : '0.00'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <h3>Growth Indicators</h3>
          <div className={styles.summaryStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>GMV Growth</span>
              <span className={`${styles.statValue} ${styles.positive}`}>
                +12.5%
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>User Growth</span>
              <span className={`${styles.statValue} ${styles.positive}`}>
                +8.3%
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Revenue Growth</span>
              <span className={`${styles.statValue} ${styles.positive}`}>
                +15.8%
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
