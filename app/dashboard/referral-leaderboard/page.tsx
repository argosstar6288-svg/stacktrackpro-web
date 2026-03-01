'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getUserReferralTier, getUnlockedPerks, REFERRAL_TIERS, REFERRAL_PERKS, formatTierBadge } from '../../lib/referralTiers';
import { useCurrentUser } from '../../lib/useCurrentUser';
import styles from './referral-leaderboard.module.css';

interface ReferrerData {
  id: string;
  displayName: string;
  email: string;
  avatar?: string;
  referralStats?: {
    completedReferrals: number;
    totalBonusEarned: number;
    currentTier?: string;
  };
}

export default function ReferralLeaderboard() {
  const [referrers, setReferrers] = useState<ReferrerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'referrals' | 'bonus' | 'tier'>('referrals');
  const [currentUserData, setCurrentUserData] = useState<any>(null);
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

        if (userData?.role !== 'founder') {
          router.push('/dashboard/pricing');
          return;
        }

        setCurrentUserData(userData);
        loadReferrers();
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserRole();
  }, [user, authLoading, router]);

  const loadReferrers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(
        collection(db, 'users'),
        where('subscription.isLifetime', '==', true)
      );

      const snapshot = await getDocs(usersQuery);
      const referrersList: ReferrerData[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.referralStats?.completedReferrals && data.referralStats.completedReferrals > 0) {
          referrersList.push({
            id: doc.id,
            displayName: data.displayName || data.email?.split('@')[0] || 'Anonymous',
            email: data.email,
            avatar: data.avatar,
            referralStats: data.referralStats,
          });
        }
      });

      // Sort by completed referrals (descending)
      referrersList.sort((a, b) => 
        (b.referralStats?.completedReferrals || 0) - (a.referralStats?.completedReferrals || 0)
      );

      setReferrers(referrersList);
    } catch (error) {
      console.error('Error loading referrers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortedReferrers = () => {
    const sorted = [...referrers];
    
    switch (sortBy) {
      case 'referrals':
        sorted.sort((a, b) => (b.referralStats?.completedReferrals || 0) - (a.referralStats?.completedReferrals || 0));
        break;
      case 'bonus':
        sorted.sort((a, b) => (b.referralStats?.totalBonusEarned || 0) - (a.referralStats?.totalBonusEarned || 0));
        break;
      case 'tier':
        const tierOrder = { 'Ambassador': 4, 'Influencer': 3, 'Rising': 2, 'Emerging': 1 };
        sorted.sort((a, b) => {
          const tierA = tierOrder[(a.referralStats?.currentTier || 'Emerging') as keyof typeof tierOrder] || 0;
          const tierB = tierOrder[(b.referralStats?.currentTier || 'Emerging') as keyof typeof tierOrder] || 0;
          return tierB - tierA || (b.referralStats?.completedReferrals || 0) - (a.referralStats?.completedReferrals || 0);
        });
        break;
    }
    
    return sorted;
  };

  const getTierInfo = (completedReferrals: number) => {
    return getUserReferralTier(completedReferrals);
  };

  const getNextBonus = (completedReferrals: number) => {
    const currentTier = getUserReferralTier(completedReferrals);
    const tiers = Object.values(REFERRAL_TIERS).sort((a, b) => a.minReferrals - b.minReferrals);
    const currentIndex = tiers.findIndex(t => t.name === currentTier.name);
    
    if (currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1].bonusPerReferral / 100;
    }
    
    return tiers[tiers.length - 1].bonusPerReferral / 100;
  };

  if (!user) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading leaderboard...</div>
      </div>
    );
  }

  const sortedReferrers = getSortedReferrers();
  const currentUserRank = sortedReferrers.findIndex(r => r.id === user?.uid) + 1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Referral Leaderboard</h1>
        <p>Compete with other founders and earn higher tier bonuses</p>
      </div>

      {/* Current User Stats */}
      {currentUserData && (
        <div className={styles.currentUserCard}>
          <div className={styles.cardContent}>
            <div className={styles.ranking}>
              <span className={styles.rankNumber}>#{currentUserRank}</span>
              <span className={styles.rankLabel}>Your Rank</span>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.label}>Referrals</span>
                <span className={styles.value}>{currentUserData.referralStats?.completedReferrals || 0}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Bonus Earned</span>
                <span className={styles.value}>${((currentUserData.referralStats?.totalBonusEarned || 0) / 100).toFixed(2)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Current Tier</span>
                <span className={styles.tierBadge}>{formatTierBadge(currentUserData.referralStats?.completedReferrals || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className={styles.controls}>
        <div className={styles.sortButtons}>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'referrals' ? styles.active : ''}`}
            onClick={() => setSortBy('referrals')}
          >
            Most Referrals
          </button>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'bonus' ? styles.active : ''}`}
            onClick={() => setSortBy('bonus')}
          >
            Most Bonuses
          </button>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'tier' ? styles.active : ''}`}
            onClick={() => setSortBy('tier')}
          >
            Highest Tier
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      {sortedReferrers.length > 0 ? (
        <div className={styles.tableWrapper}>
          <table className={styles.leaderboard}>
            <thead>
              <tr>
                <th className={styles.rankCol}>#</th>
                <th className={styles.nameCol}>Founder</th>
                <th className={styles.tierCol}>Tier</th>
                <th className={styles.referralsCol}>Referrals</th>
                <th className={styles.bonusCol}>Bonus Earned</th>
                <th className={styles.nextCol}>Next Bonus</th>
              </tr>
            </thead>
            <tbody>
              {sortedReferrers.map((referrer, index) => {
                const completedReferrals = referrer.referralStats?.completedReferrals || 0;
                const tier = getTierInfo(completedReferrals);
                const nextBonus = getNextBonus(completedReferrals);
                const isCurrentUser = referrer.id === user?.uid;

                return (
                  <tr key={referrer.id} className={isCurrentUser ? styles.currentUserRow : ''}>
                    <td className={styles.rankCol}>
                      <span className={styles.rank}>{index + 1}</span>
                    </td>
                    <td className={styles.nameCol}>
                      <div className={styles.nameInfo}>
                        {referrer.avatar && (
                          <Image src={referrer.avatar} alt={referrer.displayName} className={styles.avatar} width={36} height={36} />
                        )}
                        <div className={styles.nameText}>
                          <div className={styles.name}>{referrer.displayName}</div>
                          {isCurrentUser && <span className={styles.youBadge}>You</span>}
                        </div>
                      </div>
                    </td>
                    <td className={styles.tierCol}>
                      <span className={`${styles.tierBadge} ${styles[`tier${tier.name}` as keyof typeof styles]}`}>
                        {formatTierBadge(completedReferrals)}
                      </span>
                    </td>
                    <td className={styles.referralsCol}>
                      <span className={styles.count}>{completedReferrals}</span>
                    </td>
                    <td className={styles.bonusCol}>
                      <span className={styles.bonus}>${((referrer.referralStats?.totalBonusEarned || 0) / 100).toFixed(2)}</span>
                    </td>
                    <td className={styles.nextCol}>
                      <span className={styles.nextBonus}>${nextBonus.toFixed(2)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          <p>No founders with referrals yet.</p>
          <p>Start sharing your referral code to join the leaderboard!</p>
        </div>
      )}

      {/* Tier Info Cards */}
      <div className={styles.tierSection}>
        <h2>Tier Progression</h2>
        <div className={styles.tierCards}>
          {Object.entries(REFERRAL_TIERS).map(([tierNum, tier]) => (
            <div key={tierNum} className={`${styles.tierCard} ${styles[`tier${tier.name}` as keyof typeof styles]}`}>
              <div className={styles.tierHeader}>
                <h3>{tier.badge} {tier.name}</h3>
                <span className={styles.requirement}>{tier.minReferrals}+ referrals</span>
              </div>
              <div className={styles.tierBonus}>
                <strong>${(tier.bonusPerReferral / 100).toFixed(2)}</strong> per referral
              </div>
              <div className={styles.tierPerks}>
                <p className={styles.perkTitle}>Unlocks:</p>
                <ul>
                  {REFERRAL_PERKS.filter(p => p.unlockedAt <= tier.minReferrals).map(perk => (
                    <li key={perk.id} className={styles.perk}>
                      <span className={styles.perkIcon}>✓</span> {perk.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
