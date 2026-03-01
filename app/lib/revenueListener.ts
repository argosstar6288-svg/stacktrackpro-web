/**
 * Real-time Revenue Listener
 * Uses Firestore onSnapshot for live updates
 */

import { db } from './firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  QueryConstraint,
} from 'firebase/firestore';
import { RevenueMetrics } from './revenueMetrics';

export type RevenueListener = (metrics: RevenueMetrics) => void;
export type UnsubscribeFn = () => void;

const PLATFORM_FEE_PERCENTAGE = 0.15;
const PRO_MONTHLY = 999;
const PRO_YEARLY = 9999;
const PREMIUM_MONTHLY = 2999;
const PREMIUM_YEARLY = 29999;
const LIFETIME_PRICE = 29999;

/**
 * Set up a real-time listener for revenue metrics
 * Returns an unsubscribe function
 */
export function subscribeToRevenueMetrics(
  onUpdate: RevenueListener,
  onError?: (error: Error) => void
): UnsubscribeFn {
  const unsubscribers: UnsubscribeFn[] = [];

  try {
    // Listen to users collection for subscription changes
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(
      usersRef,
      async (snapshot) => {
        try {
          const metrics = await calculateRealtimeMetrics();
          onUpdate(metrics);
        } catch (error) {
          onError?.(error as Error);
        }
      },
      (error) => {
        onError?.(error);
      }
    );

    unsubscribers.push(unsubscribeUsers);

    // Also listen to auctions for GMV changes
    const auctionsRef = collection(db, 'auctions');
    const completedQuery = query(
      auctionsRef,
      where('status', '==', 'completed')
    );

    const unsubscribeAuctions = onSnapshot(
      completedQuery,
      async (snapshot) => {
        try {
          const metrics = await calculateRealtimeMetrics();
          onUpdate(metrics);
        } catch (error) {
          onError?.(error as Error);
        }
      },
      (error) => {
        onError?.(error);
      }
    );

    unsubscribers.push(unsubscribeAuctions);

    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  } catch (error) {
    onError?.(error as Error);
    return () => {};
  }
}

/**
 * Calculate metrics from real-time Firestore data
 */
async function calculateRealtimeMetrics(): Promise<RevenueMetrics> {
  try {
    const [
      gmvData,
      subscriptionData,
      founderData,
      topSellers,
      monthlyTrends,
    ] = await Promise.all([
      calculateGMV(),
      calculateSubscriptionRevenue(),
      calculateFounderRevenue(),
      getTopSellersMetrics(),
      getMonthlyRevenueTrends(),
    ]);

    const platformFees = Math.floor(gmvData * PLATFORM_FEE_PERCENTAGE);

    return {
      totalGMV: gmvData,
      platformFeesEarned: platformFees,
      subscriptionRevenue: subscriptionData.totalRevenue,
      founderRevenue: founderData,
      mrr: calculateMRR(subscriptionData),
      activeProUsers: subscriptionData.activeProUsers,
      activeFounders: subscriptionData.activeFounders,
      topSellers,
      revenueTrends: monthlyTrends,
    };
  } catch (error) {
    console.error('Error calculating real-time metrics:', error);
    throw error;
  }
}

/**
 * Calculate GMV from completed auctions
 */
async function calculateGMV(): Promise<number> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const q = query(auctionsRef, where('status', '==', 'completed'));

    const snapshot = await getDocs(q);
    let totalGMV = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.finalPrice) {
        totalGMV += data.finalPrice;
      }
    });

    return totalGMV;
  } catch (error) {
    console.warn('Could not calculate GMV:', error);
    return 0;
  }
}

interface SubscriptionMetrics {
  totalRevenue: number;
  activeProUsers: number;
  activeFounders: number;
}

/**
 * Calculate subscription revenue
 */
async function calculateSubscriptionRevenue(): Promise<SubscriptionMetrics> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    let totalRevenue = 0;
    let activeProUsers = 0;
    let activeFounders = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const subscription = data.subscription || {};

      if (subscription.status === 'active') {
        if (subscription.tier === 'pro' || subscription.tier === 'premium') {
          activeProUsers += 1;

          if (subscription.tier === 'pro') {
            totalRevenue += subscription.interval === 'year'
              ? Math.floor(PRO_YEARLY / 12)
              : PRO_MONTHLY;
          } else if (subscription.tier === 'premium') {
            totalRevenue += subscription.interval === 'year'
              ? Math.floor(PREMIUM_YEARLY / 12)
              : PREMIUM_MONTHLY;
          }
        }

        if (subscription.isLifetime || data.role === 'founder') {
          activeFounders += 1;
        }
      }
    });

    return {
      totalRevenue,
      activeProUsers,
      activeFounders,
    };
  } catch (error) {
    console.warn('Could not calculate subscription revenue:', error);
    return {
      totalRevenue: 0,
      activeProUsers: 0,
      activeFounders: 0,
    };
  }
}

/**
 * Calculate founder revenue
 */
async function calculateFounderRevenue(): Promise<number> {
  try {
    const usersRef = collection(db, 'users');
    const founderQuery = query(
      usersRef,
      where('subscription.isLifetime', '==', true)
    );

    const snapshot = await getDocs(founderQuery);
    const lifetimeCount = snapshot.size;
    const lifetimeRevenue = lifetimeCount * LIFETIME_PRICE;

    let referralBonusPaid = 0;
    try {
      const bonusesRef = collection(db, 'admin/logs/referralBonuses');
      const bonusSnapshot = await getDocs(bonusesRef);
      bonusSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.event === 'bonus_awarded') {
          referralBonusPaid += data.bonusAmount || 0;
        }
      });
    } catch (e) {
      // Referral bonuses collection might not exist
    }

    return lifetimeRevenue + referralBonusPaid;
  } catch (error) {
    console.warn('Could not calculate founder revenue:', error);
    return 0;
  }
}

interface TopSeller {
  id: string;
  displayName: string;
  email: string;
  totalSales: number;
  lastSaleAt?: any;
}

/**
 * Get top sellers
 */
/**
 * Get top sellers using simplified version (name only, not full metrics)
 */
async function getTopSellersMetrics(): Promise<TopSeller[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const completedQuery = query(
      auctionsRef,
      where('status', '==', 'completed')
    );

    const snapshot = await getDocs(completedQuery);
    const sellerMap = new Map<string, TopSeller>();

    snapshot.forEach(doc => {
      const data = doc.data();
      const sellerId = data.sellerId;
      const finalPrice = data.finalPrice || 0;
      const completedAt = data.completedAt;

      if (sellerId) {
        if (!sellerMap.has(sellerId)) {
          sellerMap.set(sellerId, {
            id: sellerId,
            displayName: data.sellerName || 'Unknown',
            email: '',
            totalSales: 0,
          });
        }

        const seller = sellerMap.get(sellerId)!;
        seller.totalSales += finalPrice;
        if (completedAt && (!seller.lastSaleAt || completedAt > seller.lastSaleAt)) {
          seller.lastSaleAt = completedAt;
        }
      }
    });

    const sellers = Array.from(sellerMap.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);

    for (const seller of sellers) {
      try {
        const userDoc = await getDoc(doc(db, 'users', seller.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          seller.email = userData.email || '';
          seller.displayName = userData.displayName || seller.displayName;
        }
      } catch (e) {
        // Skip if user not found
      }
    }

    return sellers;
  } catch (error) {
    console.warn('Could not fetch top sellers:', error);
    return [];
  }
}

interface RevenueTrend {
  date: string;
  month: string;
  revenue: number;
  subscriptions: number;
  founders: number;
  platformFees: number;
}

/**
 * Get monthly revenue trends (last 12 months)
 */
async function getMonthlyRevenueTrends(): Promise<RevenueTrend[]> {
  try {
    const trends: RevenueTrend[] = [];
    const now = new Date();
    const monthsBack = 12;

    // Create map for each month
    const monthlyMap = new Map<string, RevenueTrend>();

    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = date.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });

      monthlyMap.set(monthStr, {
        date: monthStr,
        month: monthLabel,
        revenue: 0,
        subscriptions: 0,
        founders: 0,
        platformFees: 0,
      });
    }

    // Get all users and auctions
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    const auctionsRef = collection(db, 'auctions');
    const auctionsSnapshot = await getDocs(auctionsRef);

    // Aggregate user data by month
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.()
        ? data.createdAt.toDate()
        : new Date(data.createdAt);
      const monthStr = createdAt.toISOString().slice(0, 7);

      if (monthlyMap.has(monthStr)) {
        const trend = monthlyMap.get(monthStr)!;

        // Add subscription revenue
        if (data.subscription?.status === 'active') {
          if (data.subscription.tier === 'pro') {
            trend.subscriptions += data.subscription.interval === 'year'
              ? Math.floor(PRO_YEARLY / 12)
              : PRO_MONTHLY;
          } else if (data.subscription.tier === 'premium') {
            trend.subscriptions += data.subscription.interval === 'year'
              ? Math.floor(PREMIUM_YEARLY / 12)
              : PREMIUM_MONTHLY;
          }
        }

        // Add founder revenue
        if (data.subscription?.isLifetime) {
          trend.founders += Math.floor(LIFETIME_PRICE / 12);
        }
      }
    });

    // Aggregate auction data by month
    auctionsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed' && data.finalPrice) {
        const completedAt = data.completedAt?.toDate?.()
          ? data.completedAt.toDate()
          : new Date(data.completedAt);
        const monthStr = completedAt.toISOString().slice(0, 7);

        if (monthlyMap.has(monthStr)) {
          const trend = monthlyMap.get(monthStr)!;
          trend.revenue += data.finalPrice;
          trend.platformFees = Math.floor(trend.revenue * PLATFORM_FEE_PERCENTAGE);
        }
      }
    });

    // Convert to sorted array
    const sortedTrends = Array.from(monthlyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return sortedTrends;
  } catch (error) {
    console.warn('Could not fetch monthly revenue trends:', error);
    return [];
  }
}

function calculateMRR(subscriptionData: SubscriptionMetrics): number {
  return subscriptionData.totalRevenue;
}
