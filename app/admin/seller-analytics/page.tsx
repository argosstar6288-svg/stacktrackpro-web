'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRouter } from 'next/navigation';
import { getSellerLeaderboard } from '../../lib/revenueMetrics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import SellerCard from './components/SellerCard';
import styles from './seller-analytics.module.css';

interface SellerData {
  id: string;
  displayName: string;
  email: string;
  totalSales: number;
  lastSaleAt?: any;
  photoUrl?: string;
  gmv: number;
  salesCount: number;
  avgPrice: number;
  platformFees: number;
  rank?: number;
  joinedAt?: any;
  isFounder?: boolean;
  referralBonusEarned?: number;
}

export default function SellerAnalyticsPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const router = useRouter();
  const [sellers, setSellers] = useState<SellerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'gmv' | 'sales'>('gmv');
  const [totalPlatformGmv, setTotalPlatformGmv] = useState(0);
  const [totalPlatformFees, setTotalPlatformFees] = useState(0);

  useEffect(() => {
    if (!user || authLoading) return;
    
    // Check admin access
    const verifyAdmin = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
      } catch (err) {
        console.error('Error verifying admin:', err);
        router.push('/dashboard');
      }
    };
    
    verifyAdmin();
  }, [user, authLoading, router]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getSellerLeaderboard();
      const formattedSellers = data.sellers.map((seller: any, idx: number) => ({
        ...seller,
        rank: idx + 1,
      }));
      setSellers(formattedSellers);
      
      // Calculate totals
      const totalGmv = formattedSellers.reduce((sum: number, s: SellerData) => sum + s.gmv, 0);
      const totalFees = formattedSellers.reduce((sum: number, s: SellerData) => sum + (s.platformFees || 0), 0);
      setTotalPlatformGmv(totalGmv);
      setTotalPlatformFees(totalFees);
    } catch (error) {
      console.error('Failed to load seller analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const sortedSellers = [...sellers].sort((a, b) => {
    if (sortBy === 'gmv') {
      return b.gmv - a.gmv;
    } else {
      return b.salesCount - a.salesCount;
    }
  });

  const topSeller = sortedSellers[0];
  const avgGmvPerSeller = sellers.length > 0 ? totalPlatformGmv / sellers.length : 0;
  const founderCount = sellers.filter(s => s.isFounder).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Seller Analytics</h1>
          <p className={styles.subtitle}>Real-time seller performance metrics and revenue analysis</p>
        </div>
        <button
          onClick={loadLeaderboard}
          disabled={loading}
          className={styles.refreshBtn}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards */}
      <section className={styles.kpiSection}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Sellers</div>
          <div className={styles.statValue}>{sellers.length}</div>
          <div className={styles.statChange}>Active on platform</div>
        </div>
        <div className={styles.statCard} style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fef08a 100%)'}}>
          <div className={styles.statLabel}>Platform GMV</div>
          <div className={styles.statValue}>
            ${(totalPlatformGmv / 1000).toFixed(1)}k
          </div>
          <div className={styles.statChange}>Total gross merchandise value</div>
        </div>
        <div className={styles.statCard} style={{background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'}}>
          <div className={styles.statLabel}>Platform Fees</div>
          <div className={styles.statValue}>
            ${(totalPlatformFees / 1000).toFixed(1)}k
          </div>
          <div className={styles.statChange}>15% commission collected</div>
        </div>
        <div className={styles.statCard} style={{background: 'linear-gradient(135deg, #f8d5e1 0%, #f1c2d8 100%)'}}>
          <div className={styles.statLabel}>Avg GMV/Seller</div>
          <div className={styles.statValue}>
            ${avgGmvPerSeller.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          </div>
          <div className={styles.statChange}>Average across all sellers</div>
        </div>
        <div className={styles.statCard} style={{background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)'}}>
          <div className={styles.statLabel}>Founder Sellers</div>
          <div className={styles.statValue}>{founderCount}</div>
          <div className={styles.statChange}>{founderCount > 0 ? 'Lifetime tier members' : 'No founders'}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Top Seller</div>
          <div className={styles.statValue} style={{fontSize: '16px', fontWeight: 600}}>
            {topSeller?.displayName || 'N/A'}
          </div>
          <div className={styles.statChange}>${(topSeller?.gmv || 0).toFixed(0)} GMV</div>
        </div>
      </section>

      {/* Leaderboard Section */}
      {loading && sellers.length === 0 ? (
        <div className={styles.loading}>Loading seller analytics...</div>
      ) : sellers.length === 0 ? (
        <div className={styles.empty}>
          No seller data available yet.
        </div>
      ) : (
        <section className={styles.leaderboardSection}>
          <div className={styles.tableHeader}>
            <h2 className={styles.sectionTitle}>Seller Leaderboard</h2>
            <div className={styles.sortControls}>
              <button
                onClick={() => setSortBy('gmv')}
                className={`${styles.sortBtn} ${sortBy === 'gmv' ? styles.active : ''}`}
              >
                💰 By GMV
              </button>
              <button
                onClick={() => setSortBy('sales')}
                className={`${styles.sortBtn} ${sortBy === 'sales' ? styles.active : ''}`}
              >
                📦 By Sales Count
              </button>
            </div>
          </div>

          <div className={styles.sellerGrid}>
            {sortedSellers.map((seller) => (
              <SellerCard
                key={seller.id}
                seller={seller}
                rank={seller.rank || 1}
                isTopThree={seller.rank && seller.rank <= 3}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
