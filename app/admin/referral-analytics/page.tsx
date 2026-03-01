'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { REFERRAL_TIERS, formatTierBadge } from '../../lib/referralTiers';
import styles from './admin-analytics.module.css';

interface ReferrerStats {
  id: string;
  displayName: string;
  email: string;
  completedReferrals: number;
  totalBonusEarned: number;
  currentTier: string;
  joiningRank: number;
}

interface TierBreakdown {
  tier: string;
  count: number;
  totalReferrals: number;
  totalBonusEarned: number;
  avgBonusPerFounder: number;
}

interface AdminStats {
  totalFounders: number;
  totalReferrals: number;
  totalBonusPaid: number;
  avgReferralsPerFounder: number;
  tierBreakdown: TierBreakdown[];
  topReferrers: ReferrerStats[];
}

export default function AdminReferralAnalytics() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (authLoading) {
      return;
    }

    // Fetch user data to check role
    const fetchUserRole = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        loadAnalytics();
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserRole();
  }, [user, authLoading, router]);

  const getTierName = (completedReferrals: number): string => {
    if (completedReferrals >= 10) return 'Ambassador';
    if (completedReferrals >= 5) return 'Influencer';
    if (completedReferrals >= 3) return 'Rising';
    return 'Emerging';
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get all founders
      const foundersQuery = query(
        collection(db, 'users'),
        where('subscription.isLifetime', '==', true)
      );

      const foundersSnapshot = await getDocs(foundersQuery);
      const founders: ReferrerStats[] = [];
      let totalRefCount = 0;
      let totalBonusPaid = 0;
      const tierMap: { [key: string]: TierBreakdown } = {
        'Emerging': { tier: 'Emerging', count: 0, totalReferrals: 0, totalBonusEarned: 0, avgBonusPerFounder: 0 },
        'Rising': { tier: 'Rising', count: 0, totalReferrals: 0, totalBonusEarned: 0, avgBonusPerFounder: 0 },
        'Influencer': { tier: 'Influencer', count: 0, totalReferrals: 0, totalBonusEarned: 0, avgBonusPerFounder: 0 },
        'Ambassador': { tier: 'Ambassador', count: 0, totalReferrals: 0, totalBonusEarned: 0, avgBonusPerFounder: 0 },
      };

      foundersSnapshot.forEach((doc) => {
        const data = doc.data();
        const completedReferrals = data.referralStats?.completedReferrals || 0;
        const totalBonusEarned = data.referralStats?.totalBonusEarned || 0;
        const tier = getTierName(completedReferrals);
        const joiningRank = founders.length + 1;

        founders.push({
          id: doc.id,
          displayName: data.displayName || data.email?.split('@')[0] || 'Anonymous',
          email: data.email,
          completedReferrals,
          totalBonusEarned,
          currentTier: tier,
          joiningRank,
        });

        if (completedReferrals > 0) {
          totalRefCount += completedReferrals;
          totalBonusPaid += totalBonusEarned;
          
          tierMap[tier].count += 1;
          tierMap[tier].totalReferrals += completedReferrals;
          tierMap[tier].totalBonusEarned += totalBonusEarned;
        }
      });

      // Calculate averages for tier breakdown
      Object.keys(tierMap).forEach(tierKey => {
        if (tierMap[tierKey].count > 0) {
          tierMap[tierKey].avgBonusPerFounder = tierMap[tierKey].totalBonusEarned / tierMap[tierKey].count;
        }
      });

      // Sort founders by total bonus earned
      founders.sort((a, b) => b.totalBonusEarned - a.totalBonusEarned);
      const topReferrers = founders.slice(0, 10);

      const analyticStats: AdminStats = {
        totalFounders: foundersSnapshot.size,
        totalReferrals: totalRefCount,
        totalBonusPaid,
        avgReferralsPerFounder: foundersSnapshot.size > 0 ? totalRefCount / foundersSnapshot.size : 0,
        tierBreakdown: Object.values(tierMap),
        topReferrers,
      };

      setStats(analyticStats);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading analytics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Failed to load analytics'}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Referral Analytics</h1>
        <p>Monitor the referral program performance and founder tier distribution</p>
      </div>

      {/* Key Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Founders</div>
          <div className={styles.metricValue}>{stats.totalFounders}</div>
          <div className={styles.metricDesc}>Lifetime members</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Referrals</div>
          <div className={styles.metricValue}>{stats.totalReferrals}</div>
          <div className={styles.metricDesc}>Successful referrals</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Bonuses Paid</div>
          <div className={styles.metricValue}>${(stats.totalBonusPaid / 100).toFixed(2)}</div>
          <div className={styles.metricDesc}>Store credit distributed</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Avg Referrals/Founder</div>
          <div className={styles.metricValue}>{stats.avgReferralsPerFounder.toFixed(1)}</div>
          <div className={styles.metricDesc}>Per member average</div>
        </div>
      </div>

      {/* Tier Breakdown */}
      <section className={styles.section}>
        <h2>Tier Distribution</h2>
        <div className={styles.tierGrid}>
          {stats.tierBreakdown.map((tierInfo) => (
            <div key={tierInfo.tier} className={`${styles.tierBox} ${styles[`tier${tierInfo.tier}` as keyof typeof styles]}`}>
              <div className={styles.tierName}>{tierInfo.tier}</div>
              <div className={styles.tierCount}>
                <span className={styles.number}>{tierInfo.count}</span>
                <span className={styles.label}>founders</span>
              </div>
              <div className={styles.tierStats}>
                <div className={styles.stat}>
                  <small>Referrals:</small>
                  <strong>{tierInfo.totalReferrals}</strong>
                </div>
                <div className={styles.stat}>
                  <small>Bonus Paid:</small>
                  <strong>${(tierInfo.totalBonusEarned / 100).toFixed(2)}</strong>
                </div>
                <div className={styles.stat}>
                  <small>Avg/Founder:</small>
                  <strong>${(tierInfo.avgBonusPerFounder / 100).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Referrers */}
      <section className={styles.section}>
        <h2>Top 10 Referrers</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.topReferrersTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Founder</th>
                <th>Tier</th>
                <th>Referrals</th>
                <th>Bonus Earned</th>
                <th>Join Rank</th>
              </tr>
            </thead>
            <tbody>
              {stats.topReferrers.map((referrer, index) => (
                <tr key={referrer.id}>
                  <td className={styles.rank}>{index + 1}</td>
                  <td>
                    <div className={styles.founderInfo}>
                      <div className={styles.founderName}>{referrer.displayName}</div>
                      <div className={styles.founderEmail}>{referrer.email}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.tierBadge} ${styles[`tier${referrer.currentTier}` as keyof typeof styles]}`}>
                      {formatTierBadge(referrer.completedReferrals)}
                    </span>
                  </td>
                  <td className={styles.center}>{referrer.completedReferrals}</td>
                  <td className={styles.center}>${(referrer.totalBonusEarned / 100).toFixed(2)}</td>
                  <td className={styles.center}>#{referrer.joiningRank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tier Bonus Reference */}
      <section className={styles.section}>
        <h2>Tier Bonus Structure</h2>
        <div className={styles.tierReference}>
          {Object.entries(REFERRAL_TIERS).map(([, tier]) => (
            <div key={tier.name} className={styles.refRow}>
              <div className={styles.refTierName}>{tier.badge} {tier.name}</div>
              <div className={styles.refMinReferrals}>{tier.minReferrals}+ referrals</div>
              <div className={styles.refBonus}>${(tier.bonusPerReferral / 100).toFixed(2)}/referral</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
