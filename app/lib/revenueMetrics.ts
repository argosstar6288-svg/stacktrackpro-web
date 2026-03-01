/**
 * Revenue Metrics Module
 * Calculates and retrieves all revenue-related data from Firestore
 */

import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';

export interface RevenueMetrics {
  totalGMV: number;
  platformFeesEarned: number;
  subscriptionRevenue: number;
  founderRevenue: number;
  mrr: number;
  activeProUsers: number;
  activeFounders: number;
  topSellers: TopSeller[];
  revenueTrends: RevenueTrend[];
}

export interface TopSeller {
  id: string;
  displayName: string;
  email: string;
  totalSales: number;
  lastSaleAt?: Timestamp;
}

export interface SellerLeaderboard {
  sellers: Array<TopSeller & {
    photoUrl?: string;
    gmv: number;
    salesCount: number;
    avgPrice: number;
    platformFees: number;
    rank?: number;
    joinedAt?: Timestamp;
    isFounder?: boolean;
    referralBonusEarned?: number;
  }>;
  topSeller?: TopSeller & {
    photoUrl?: string;
    gmv: number;
    salesCount: number;
    avgPrice: number;
    platformFees: number;
    rank?: number;
    joinedAt?: Timestamp;
    isFounder?: boolean;
    referralBonusEarned?: number;
  };
  totalSellersTracked: number;
  aggregatedAt: Date;
}

export interface RevenueTrend {
  date: string;
  month?: string;
  revenue: number;
  subscriptions: number;
  founders: number;
  platformFees: number;
}

export interface SubscriptionData {
  tier: 'pro' | 'premium';
  interval: 'month' | 'year';
  status: 'active' | 'canceled' | 'past_due';
  amount: number;
  nextBillingDate?: Timestamp;
}

const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee on GMV
const PRO_MONTHLY = 999; // $9.99 in cents
const PRO_YEARLY = 9999; // $99.99 in cents
const PREMIUM_MONTHLY = 2999; // $29.99 in cents
const PREMIUM_YEARLY = 29999; // $299.99 in cents
const LIFETIME_PRICE = 29999; // $299.99 in cents

/**
 * Get all revenue metrics for the dashboard
 */
export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  try {
    const [
      gmvData,
      subscriptionData,
      founderData,
      topSellers,
      trends,
    ] = await Promise.all([
      calculateGMV(),
      calculateSubscriptionRevenue(),
      calculateFounderRevenue(),
      getTopSellers(),
      getRevenueTrends(),
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
      revenueTrends: trends,
    };
  } catch (error) {
    console.error('Error calculating revenue metrics:', error);
    throw error;
  }
}

/**
 * Calculate Gross Merchandise Volume from auctions/sales
 */
async function calculateGMV(): Promise<number> {
  try {
    // Query completed auctions or sales
    // This assumes an 'auctions' or 'sales' collection exists
    // Adjust based on your actual data structure
    const auctionsRef = collection(db, 'auctions');
    const q = query(
      auctionsRef,
      where('status', '==', 'completed')
    );

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
 * Calculate subscription revenue from Stripe payments
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

      // Count active subscriptions
      if (subscription.status === 'active') {
        if (subscription.tier === 'pro' || subscription.tier === 'premium') {
          activeProUsers += 1;

          // Calculate monthly revenue from subscriptions
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

        // Count founders
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
 * Calculate founder revenue (lifetime purchases + referral bonuses)
 */
async function calculateFounderRevenue(): Promise<number> {
  try {
    // Count lifetime purchases at $299.99 each
    const usersRef = collection(db, 'users');
    const founderQuery = query(
      usersRef,
      where('subscription.isLifetime', '==', true)
    );

    const snapshot = await getDocs(founderQuery);
    const lifetimeCount = snapshot.size;
    const lifetimeRevenue = lifetimeCount * LIFETIME_PRICE;

    // Add referral bonuses paid out (if tracked in a dedicated collection)
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
      // Referral bonuses collection might not exist yet
    }

    return lifetimeRevenue + referralBonusPaid;
  } catch (error) {
    console.warn('Could not calculate founder revenue:', error);
    return 0;
  }
}

/**
 * Get top sellers by sales volume
 */
async function getTopSellers(): Promise<TopSeller[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const completedQuery = query(
      auctionsRef,
      where('status', '==', 'completed')
    );

    const snapshot = await getDocs(completedQuery);
    const sellerMap = new Map<string, TopSeller>();

    // Aggregate sales by seller
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

    // Convert to array and sort by total sales
    const sellers = Array.from(sellerMap.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10); // Top 10

    // Fetch email addresses
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

/**
 * Calculate Monthly Recurring Revenue (MRR)
 */
function calculateMRR(subscriptionData: SubscriptionMetrics): number {
  // MRR is the predictable monthly revenue from active subscriptions
  // Plus 1/50 of lifetime purchases (amortized over 50 months)
  try {
    const lifetimeMonthlization = Math.floor(LIFETIME_PRICE / 50);
    const founderContribution = 0; // Founders don't generate recurring revenue
    
    return subscriptionData.totalRevenue + founderContribution;
  } catch (error) {
    console.warn('Could not calculate MRR:', error);
    return 0;
  }
}

/**
 * Get revenue trends for the last 30 days
 */
async function getRevenueTrends(): Promise<RevenueTrend[]> {
  try {
    const trends: RevenueTrend[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all users with payment data
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    // Create a map of daily revenue
    const dailyRevenueMap = new Map<string, RevenueTrend>();

    snapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

      if (createdAt >= thirtyDaysAgo) {
        const dateStr = createdAt.toISOString().split('T')[0];

        if (!dailyRevenueMap.has(dateStr)) {
          dailyRevenueMap.set(dateStr, {
            date: dateStr,
            revenue: 0,
            subscriptions: 0,
            founders: 0,
            platformFees: 0,
          });
        }

        const trend = dailyRevenueMap.get(dateStr)!;

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
          trend.founders += Math.floor(LIFETIME_PRICE / 30); // Amortize daily
        }

        trend.revenue = trend.subscriptions + trend.founders;
        trend.platformFees = Math.floor(trend.revenue * PLATFORM_FEE_PERCENTAGE);
      }
    });

    // Convert to sorted array
    const sortedTrends = Array.from(dailyRevenueMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    return sortedTrends;
  } catch (error) {
    console.warn('Could not fetch revenue trends:', error);
    return [];
  }
}

/**
 * Get seller leaderboard with full metrics (GMV, sales count, etc.)
 */
export async function getSellerLeaderboard(): Promise<SellerLeaderboard> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const completedQuery = query(
      auctionsRef,
      where('status', '==', 'completed')
    );

    const snapshot = await getDocs(completedQuery);
    const sellerMap = new Map<string, any>();

    // Aggregate sales by seller
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
            gmv: 0,
            salesCount: 0,
            avgPrice: 0,
            platformFees: 0,
            totalSales: 0,
          });
        }

        const seller = sellerMap.get(sellerId)!;
        seller.gmv += finalPrice;
        seller.salesCount += 1;
        seller.totalSales += finalPrice;

        if (completedAt && (!seller.lastSaleAt || completedAt > seller.lastSaleAt)) {
          seller.lastSaleAt = completedAt;
        }
      }
    });

    // Calculate derived metrics
    sellerMap.forEach(seller => {
      seller.avgPrice = seller.salesCount > 0 ? Math.floor(seller.gmv / seller.salesCount) : 0;
      seller.platformFees = Math.floor(seller.gmv * PLATFORM_FEE_PERCENTAGE);
    });

    // Get user data in parallel
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const userDataMap = new Map<string, any>();

    usersSnapshot.forEach(doc => {
      userDataMap.set(doc.id, doc.data());
    });

    // Sort and rank
    const sellers = Array.from(sellerMap.values())
      .map((seller, index) => {
        const userData = userDataMap.get(seller.id);
        return {
          ...seller,
          displayName: userData?.displayName || seller.displayName,
          email: userData?.email || seller.email,
          photoUrl: userData?.photoUrl,
          joinedAt: userData?.createdAt,
          isFounder: userData?.subscription?.isLifetime === true,
          referralBonusEarned: userData?.referralBonusEarned || 0,
          rank: index + 1,
        };
      })
      .sort((a, b) => b.gmv - a.gmv)
      .map((seller, index) => ({
        ...seller,
        rank: index + 1,
      }))
      .slice(0, 10);

    return {
      sellers,
      topSeller: sellers.length > 0 ? sellers[0] : undefined,
      totalSellersTracked: sellerMap.size,
      aggregatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error calculating seller leaderboard:', error);
    throw error;
  }
}

// ============================================================================
// PAYOUT SYSTEM (Seller Earnings & Transfers)
// ============================================================================

export interface PayoutRequest {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  amount: number;
  platformFees: number;
  requestedAt: Timestamp;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectionReason?: string;
  stripeTransferId?: string;
  transferredAt?: Timestamp;
  payoutMethod?: 'stripe_connect' | 'bank_transfer';
}

export interface PayoutLedgerEntry {
  id: string;
  transactionType: 'sale' | 'platform_fee' | 'payout_request' | 'payout_approved' | 'payout_completed' | 'payout_rejected';
  sellerId: string;
  sellerName: string;
  amount: number;
  balance: number;
  relatedAuctionId?: string;
  relatedPayoutId?: string;
  notes?: string;
  createdAt: Timestamp;
  createdBy?: string;
}

export interface SellerEarnings {
  sellerId: string;
  displayName: string;
  email: string;
  totalEarned: number;
  totalFeesPaid: number;
  currentBalance: number;
  pendingEarnings: number;
  allTimePaid: number;
  stripeConnectId?: string;
  lastPayoutDate?: Timestamp;
  nextPayoutEligible: boolean;
}

export interface AdminPayoutStats {
  totalEarningsTracked: number;
  totalFeesCollected: number;
  totalPaidOut: number;
  pendingPayouts: number;
  pendingAmount: number;
  processingPayouts: number;
  completedPayouts: number;
  averagePayoutAmount: number;
  payoutRequestsCount: number;
}

/**
 * Calculate seller's current earnings
 */
export async function calculateSellerEarnings(sellerId: string): Promise<SellerEarnings> {
  try {
    const sellerDoc = await getDoc(doc(db, 'users', sellerId));
    if (!sellerDoc.exists()) {
      throw new Error('Seller not found');
    }

    const sellerData = sellerDoc.data();
    const platform_fee_rate = 0.15;

    const auctionsRef = collection(db, 'auctions');
    const completedQuery = query(
      auctionsRef,
      where('sellerId', '==', sellerId),
      where('status', '==', 'completed')
    );
    const auctionSnapshots = await getDocs(completedQuery);

    let totalEarned = 0;
    let totalFeesPaid = 0;

    auctionSnapshots.forEach(docSnap => {
      const auctionData = docSnap.data();
      const finalPrice = auctionData.finalPrice || 0;
      const platformFees = finalPrice * platform_fee_rate;
      const sellerPayment = finalPrice - platformFees;

      totalEarned += sellerPayment;
      totalFeesPaid += platformFees;
    });

    const ledgerRef = collection(db, 'payoutLedger');
    const ledgerQuery = query(
      ledgerRef,
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc')
    );
    const ledgerSnapshots = await getDocs(ledgerQuery);

    let currentBalance = totalEarned;
    let pendingEarnings = 0;
    let allTimePaid = 0;

    ledgerSnapshots.forEach(ledgerDoc => {
      const entry = ledgerDoc.data();
      if (entry.transactionType === 'payout_completed') {
        allTimePaid += entry.amount;
      }
    });

    const payoutsRef = collection(db, 'payoutRequests');
    const pendingQuery = query(
      payoutsRef,
      where('sellerId', '==', sellerId),
      where('status', '==', 'pending')
    );
    const pendingSnapshots = await getDocs(pendingQuery);
    pendingSnapshots.forEach(pDoc => {
      pendingEarnings += pDoc.data().amount;
    });

    currentBalance = Math.max(0, totalEarned - allTimePaid - pendingEarnings);

    return {
      sellerId,
      displayName: sellerData.displayName || 'Unknown',
      email: sellerData.email || '',
      totalEarned,
      totalFeesPaid,
      currentBalance,
      pendingEarnings,
      allTimePaid,
      stripeConnectId: sellerData.stripeConnectId,
      lastPayoutDate: sellerData.lastPayoutDate,
      nextPayoutEligible: currentBalance >= 100,
    };
  } catch (error) {
    console.error('Error calculating seller earnings:', error);
    throw error;
  }
}

/**
 * Create payout request
 */
export async function createPayoutRequest(
  sellerId: string,
  amount: number,
  stripeConnectId?: string
): Promise<PayoutRequest> {
  try {
    const earnings = await calculateSellerEarnings(sellerId);

    if (amount > earnings.currentBalance) {
      throw new Error(
        `Insufficient balance. Available: $${earnings.currentBalance.toFixed(2)}`
      );
    }

    if (amount < 100) {
      throw new Error('Minimum payout amount is $100');
    }

    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = serverTimestamp();

    const payoutRequest: PayoutRequest = {
      id: payoutId,
      sellerId,
      sellerName: earnings.displayName,
      sellerEmail: earnings.email,
      amount,
      platformFees: 0,
      requestedAt: now as any,
      status: 'pending',
      payoutMethod: 'stripe_connect',
    };

    await setDoc(doc(db, 'payoutRequests', payoutId), payoutRequest);

    await recordLedgerEntry({
      transactionType: 'payout_request',
      sellerId,
      sellerName: earnings.displayName,
      amount: -amount,
      balance: earnings.currentBalance - amount,
      relatedPayoutId: payoutId,
      notes: `Payout request created`,
    });

    return payoutRequest;
  } catch (error) {
    console.error('Error creating payout request:', error);
    throw error;
  }
}

/**
 * Get payout requests
 */
export async function getPayoutRequests(
  status?: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected',
  pageSize = 20
) {
  try {
    const payoutsRef = collection(db, 'payoutRequests');
    let q: any;

    if (status) {
      q = query(
        payoutsRef,
        where('status', '==', status),
        orderBy('requestedAt', 'desc'),
        limit(pageSize)
      );
    } else {
      q = query(
        payoutsRef,
        orderBy('requestedAt', 'desc'),
        limit(pageSize)
      );
    }

    const snapshots = await getDocs(q);
    return snapshots.docs.map(d => d.data() as PayoutRequest);
  } catch (error) {
    console.error('Error getting payout requests:', error);
    throw error;
  }
}

/**
 * Get seller's payouts
 */
export async function getSellerPayouts(sellerId: string) {
  try {
    const payoutsRef = collection(db, 'payoutRequests');
    const q = query(
      payoutsRef,
      where('sellerId', '==', sellerId),
      orderBy('requestedAt', 'desc')
    );

    const snapshots = await getDocs(q);
    return snapshots.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest));
  } catch (error) {
    console.error('Error getting seller payouts:', error);
    throw error;
  }
}

/**
 * Approve payout
 */
export async function approvePayoutRequest(
  payoutId: string,
  approvedBy: string
): Promise<PayoutRequest> {
  try {
    const payoutDoc = await getDoc(doc(db, 'payoutRequests', payoutId));
    if (!payoutDoc.exists()) {
      throw new Error('Payout request not found');
    }

    const payout = payoutDoc.data() as PayoutRequest;

    await updateDoc(doc(db, 'payoutRequests', payoutId), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy,
    });

    await recordLedgerEntry({
      transactionType: 'payout_approved',
      sellerId: payout.sellerId,
      sellerName: payout.sellerName,
      amount: payout.amount,
      relatedPayoutId: payoutId,
      notes: `Payout approved by admin`,
      createdBy: approvedBy,
    });

    return { ...payout, status: 'approved', approvedAt: serverTimestamp() as any, approvedBy };
  } catch (error) {
    console.error('Error approving payout:', error);
    throw error;
  }
}

/**
 * Reject payout
 */
export async function rejectPayoutRequest(
  payoutId: string,
  rejectionReason: string,
  rejectedBy: string
): Promise<PayoutRequest> {
  try {
    const payoutDoc = await getDoc(doc(db, 'payoutRequests', payoutId));
    if (!payoutDoc.exists()) {
      throw new Error('Payout request not found');
    }

    const payout = payoutDoc.data() as PayoutRequest;

    await updateDoc(doc(db, 'payoutRequests', payoutId), {
      status: 'rejected',
      rejectionReason,
    });

    await recordLedgerEntry({
      transactionType: 'payout_rejected',
      sellerId: payout.sellerId,
      sellerName: payout.sellerName,
      amount: 0,
      relatedPayoutId: payoutId,
      notes: `Payout rejected: ${rejectionReason}`,
      createdBy: rejectedBy,
    });

    return { ...payout, status: 'rejected', rejectionReason };
  } catch (error) {
    console.error('Error rejecting payout:', error);
    throw error;
  }
}

/**
 * Process Stripe transfer
 */
export async function processStripeTransfer(
  payoutId: string,
  stripeConnectAccountId: string,
  adminId: string
): Promise<{ transactionType: 'payout_completed'; transferId: string }> {
  try {
    const payoutDoc = await getDoc(doc(db, 'payoutRequests', payoutId));
    if (!payoutDoc.exists()) {
      throw new Error('Payout request not found');
    }

    const payout = payoutDoc.data() as PayoutRequest;
    const stripeTransferId = `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await updateDoc(doc(db, 'payoutRequests', payoutId), {
      status: 'completed',
      stripeTransferId,
      transferredAt: serverTimestamp(),
    });

    await recordLedgerEntry({
      transactionType: 'payout_completed',
      sellerId: payout.sellerId,
      sellerName: payout.sellerName,
      amount: payout.amount,
      relatedPayoutId: payoutId,
      notes: `Payout transferred via Stripe. Transfer ID: ${stripeTransferId}`,
      createdBy: adminId,
    });

    await updateDoc(doc(db, 'users', payout.sellerId), {
      lastPayoutDate: serverTimestamp(),
    });

    return { transactionType: 'payout_completed', transferId: stripeTransferId };
  } catch (error) {
    console.error('Error processing Stripe transfer:', error);
    throw error;
  }
}

/**
 * Record ledger entry
 */
export async function recordLedgerEntry(data: {
  transactionType: PayoutLedgerEntry['transactionType'];
  sellerId: string;
  sellerName: string;
  amount: number;
  balance?: number;
  relatedAuctionId?: string;
  relatedPayoutId?: string;
  notes?: string;
  createdBy?: string;
}): Promise<PayoutLedgerEntry> {
  try {
    const entryId = `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const entry: PayoutLedgerEntry = {
      id: entryId,
      transactionType: data.transactionType,
      sellerId: data.sellerId,
      sellerName: data.sellerName,
      amount: data.amount,
      balance: data.balance || 0,
      relatedAuctionId: data.relatedAuctionId,
      relatedPayoutId: data.relatedPayoutId,
      notes: data.notes,
      createdAt: serverTimestamp() as any,
      createdBy: data.createdBy,
    };

    await setDoc(doc(db, 'payoutLedger', entryId), entry);
    return entry;
  } catch (error) {
    console.error('Error recording ledger entry:', error);
    throw error;
  }
}

/**
 * Get seller ledger
 */
export async function getSellerLedger(sellerId: string, ledgerLimit = 50) {
  try {
    const ledgerRef = collection(db, 'payoutLedger');
    const q = query(
      ledgerRef,
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
      limit(ledgerLimit)
    );

    const snapshots = await getDocs(q);
    return snapshots.docs.map(d => ({ id: d.id, ...d.data() } as PayoutLedgerEntry));
  } catch (error) {
    console.error('Error getting seller ledger:', error);
    throw error;
  }
}

/**
 * Get admin ledger
 */
export async function getAdminLedger(ledgerLimit = 100) {
  try {
    const ledgerRef = collection(db, 'payoutLedger');
    const q = query(
      ledgerRef,
      orderBy('createdAt', 'desc'),
      limit(ledgerLimit)
    );

    const snapshots = await getDocs(q);
    return snapshots.docs.map(d => ({ id: d.id, ...d.data() } as PayoutLedgerEntry));
  } catch (error) {
    console.error('Error getting admin ledger:', error);
    throw error;
  }
}

/**
 * Get admin payout stats
 */
export async function getAdminPayoutStats(): Promise<AdminPayoutStats> {
  try {
    const payoutsRef = collection(db, 'payoutRequests');
    const payoutsSnapshots = await getDocs(payoutsRef);

    let totalEarningsTracked = 0;
    let totalPaidOut = 0;
    let pendingAmount = 0;

    const payouts = payoutsSnapshots.docs.map(d => d.data() as PayoutRequest);

    payouts.forEach(payout => {
      if (payout.status === 'completed') {
        totalPaidOut += payout.amount;
      } else if (payout.status === 'pending') {
        pendingAmount += payout.amount;
      }
    });

    let totalFeesCollected = 0;
    const ledgerRef = collection(db, 'payoutLedger');
    const ledgerSnapshots = await getDocs(ledgerRef);

    ledgerSnapshots.forEach(lDoc => {
      const entry = lDoc.data() as PayoutLedgerEntry;
      if (entry.transactionType === 'platform_fee') {
        totalFeesCollected += entry.amount;
      }
    });

    totalEarningsTracked = totalPaidOut + pendingAmount;
    const completedPayouts = payouts.filter(p => p.status === 'completed').length;
    const averagePayoutAmount = completedPayouts > 0 ? totalPaidOut / completedPayouts : 0;

    return {
      totalEarningsTracked,
      totalFeesCollected,
      totalPaidOut,
      pendingPayouts: payouts.filter(p => p.status === 'pending').length,
      pendingAmount,
      processingPayouts: payouts.filter(p => p.status === 'processing').length,
      completedPayouts,
      averagePayoutAmount,
      payoutRequestsCount: payouts.length,
    };
  } catch (error) {
    console.error('Error getting payout stats:', error);
    throw error;
  }
}

// ============================================================================
// PRICING INTELLIGENCE & RECOMMENDATIONS
// ============================================================================

export interface PriceStats {
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  price30Day: number;
  priceVolatility: number; // Standard deviation
  salesCount: number;
  sellThroughRate: number; // % of listings that sold
}

export interface PricingRecommendation {
  suggestedListingPrice: number;
  suggestedStartingBid: number;
  suggestedBidIncrement: number;
  sellThroughProbability: number; // 0-100%
  confidence: number; // 0-100%
  priceAlert: 'underpriced' | 'overpriced' | 'fair' | null;
  reasoning: string;
  comparableListings: number;
}

/**
 * Get price statistics for a product category/type
 */
export async function getPriceStats(
  category?: string,
  daysBack: number = 30
): Promise<PriceStats> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysBack);

    const auctionsRef = collection(db, 'auctions');
    let q: any;

    if (category) {
      q = query(
        auctionsRef,
        where('status', '==', 'completed'),
        where('category', '==', category),
        where('completedAt', '>=', thirtyDaysAgo)
      );
    } else {
      q = query(
        auctionsRef,
        where('status', '==', 'completed'),
        where('completedAt', '>=', thirtyDaysAgo)
      );
    }

    const snapshot = await getDocs(q);
    const prices: number[] = [];
    let totalListings = 0;
    let soldListings = 0;

    // Collect all final prices
    snapshot.forEach(doc => {
      const data = doc.data() as any;
      const finalPrice = data.finalPrice || 0;
      if (finalPrice > 0) {
        prices.push(finalPrice);
        soldListings += 1;
      }
    });

    // Get all listings in category to calculate sell-through
    let totalQuery: any;
    if (category) {
      totalQuery = query(
        auctionsRef,
        where('category', '==', category)
      );
    } else {
      totalQuery = query(auctionsRef);
    }

    const totalSnapshot = await getDocs(totalQuery);
    totalListings = totalSnapshot.size;

    // Calculate statistics
    prices.sort((a, b) => a - b);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length || 0;
    const medianPrice = prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

    // Calculate volatility (standard deviation)
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const priceVolatility = Math.sqrt(variance);

    return {
      avgPrice: Math.round(avgPrice),
      medianPrice: Math.round(medianPrice),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      price30Day: avgPrice, // 30-day average
      priceVolatility: Math.round(priceVolatility),
      salesCount: soldListings,
      sellThroughRate: totalListings > 0 ? (soldListings / totalListings) * 100 : 0,
    };
  } catch (error) {
    console.error('Error getting price stats:', error);
    throw error;
  }
}

/**
 * Get pricing recommendation for a listing
 */
export async function getPricingRecommendation(
  basePrice: number,
  category?: string,
  condition?: string
): Promise<PricingRecommendation> {
  try {
    const priceStats = await getPriceStats(category);

    if (priceStats.salesCount === 0) {
      return {
        suggestedListingPrice: basePrice,
        suggestedStartingBid: Math.round(basePrice * 0.7), // 70% of asking
        suggestedBidIncrement: Math.round(basePrice * 0.05), // 5% increments
        sellThroughProbability: 50,
        confidence: 20,
        priceAlert: null,
        reasoning: 'Insufficient historical data for this category',
        comparableListings: 0,
      };
    }

    // Determine if price is fair, under, or overpriced
    const priceRatio = basePrice / priceStats.avgPrice;
    let priceAlert: 'underpriced' | 'overpriced' | 'fair' | null = null;

    if (priceRatio < 0.85) {
      priceAlert = 'underpriced';
    } else if (priceRatio > 1.2) {
      priceAlert = 'overpriced';
    } else {
      priceAlert = 'fair';
    }

    // Calculate sell-through probability
    let sellThroughProbability = priceStats.sellThroughRate;
    if (priceAlert === 'overpriced') {
      sellThroughProbability *= 0.7; // 30% less likely
    } else if (priceAlert === 'underpriced') {
      sellThroughProbability *= 1.15; // 15% more likely (capped at 100)
    }
    sellThroughProbability = Math.min(100, sellThroughProbability);

    // Suggest optimal listing price (median for better sell-through)
    const suggestedListingPrice = Math.round(priceStats.medianPrice * 1.05); // 5% above median

    // Calculate starting bid (typically 60-80% of expected final price)
    const expectedFinalPrice = Math.round(priceStats.avgPrice * 0.95); // Assume slight discount
    const suggestedStartingBid = Math.round(expectedFinalPrice * 0.65);

    // Suggest bid increment (2-5% of asking price)
    const suggestedBidIncrement = Math.round(suggestedListingPrice * 0.03);

    // Confidence based on data volume
    const confidence = Math.min(
      100,
      20 + (priceStats.salesCount / 10) * 10 // Confidence grows with sample size
    );

    return {
      suggestedListingPrice,
      suggestedStartingBid,
      suggestedBidIncrement,
      sellThroughProbability: Math.round(sellThroughProbability),
      confidence: Math.round(confidence),
      priceAlert,
      reasoning: generatePricingReasoning(
        basePrice,
        priceStats,
        priceAlert,
        sellThroughProbability
      ),
      comparableListings: priceStats.salesCount,
    };
  } catch (error) {
    console.error('Error getting pricing recommendation:', error);
    throw error;
  }
}

/**
 * Generate human-readable reasoning for pricing
 */
function generatePricingReasoning(
  basePrice: number,
  stats: PriceStats,
  alert: string,
  probability: number
): string {
  const parts: string[] = [];

  parts.push(
    `Based on ${stats.salesCount} recent sales in this category:`
  );

  if (alert === 'underpriced') {
    const savingsPercent = Math.round(((stats.avgPrice - basePrice) / stats.avgPrice) * 100);
    parts.push(
      `This price is ${savingsPercent}% below market average ($${stats.avgPrice}), which increases sell-through to ${Math.round(probability)}%.`
    );
  } else if (alert === 'overpriced') {
    const premiumPercent = Math.round(((basePrice - stats.avgPrice) / stats.avgPrice) * 100);
    parts.push(
      `This price is ${premiumPercent}% above market average ($${stats.avgPrice}), reducing sell-through to ${Math.round(probability)}%.`
    );
  } else {
    parts.push(
      `This price is in line with the market average ($${stats.avgPrice}), with expected sell-through of ${Math.round(probability)}%.`
    );
  }

  parts.push(
    `Recent median price: $${stats.medianPrice}. Price volatility: $${stats.priceVolatility}.`
  );

  return parts.join(' ');
}

/**
 * Get all sellers with their current balances (for admin view)
 */
export async function getAllSellerBalances(limitCount = 50) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'seller'),
      limit(limitCount)
    );

    const snapshots = await getDocs(q);
    const sellers: Array<{
      id: string;
      displayName: string;
      email: string;
      currentBalance: number;
    }> = [];

    for (const userDoc of snapshots.docs) {
      const seller = userDoc.data();
      const earnings = await calculateSellerEarnings(userDoc.id);

      sellers.push({
        id: userDoc.id,
        displayName: seller.displayName || 'Unknown',
        email: seller.email || '',
        currentBalance: earnings.currentBalance,
      });
    }

    return sellers.sort((a, b) => b.currentBalance - a.currentBalance);
  } catch (error) {
    console.error('Error getting seller balances:', error);
    throw error;
  }
}

// ============================================================================
// PRICING ANALYTICS & MARKET INTELLIGENCE
// ============================================================================

export interface TrendingCategory {
  category: string;
  salesCount: number;
  totalVolume: number;
  avgPrice: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  momentum: number; // Sales momentum score 0-100
}

export interface FastestSellingCategory {
  category: string;
  avgTimeToSell: number; // In hours
  salesCount: number;
  completionRate: number; // % of listings that sold
  avgPrice: number;
  momentum: number;
}

export interface PriceSignal {
  category: string;
  direction: 'rising' | 'falling' | 'stable';
  percentChange: number;
  avgPrice7d: number;
  avgPrice30d: number;
  confidence: number; // 0-100
  reasoning: string;
}

export interface UnderpriceAlert {
  id: string;
  auctionTitle: string;
  category: string;
  listingPrice: number;
  marketAveragePrice: number;
  underpricePercentage: number;
  potentialProfit: number;
  confidence: number;
  recommendation: string;
}

/**
 * Get trending categories by sales volume and price momentum
 */
export async function getTrendingCategories(daysBack: number = 7): Promise<TrendingCategory[]> {
  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const auctionsRef = collection(db, 'auctions');
    const q = query(
      auctionsRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', sinceDate)
    );

    const snapshot = await getDocs(q);
    const categoryMap = new Map<string, {
      salesCount: number;
      totalVolume: number;
      prices: number[];
    }>();

    // Collect data by category
    snapshot.forEach(doc => {
      const data = doc.data() as any;
      const category = data.category || 'Uncategorized';
      const finalPrice = data.finalPrice || 0;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { salesCount: 0, totalVolume: 0, prices: [] });
      }

      const cat = categoryMap.get(category)!;
      cat.salesCount += 1;
      cat.totalVolume += finalPrice;
      cat.prices.push(finalPrice);
    });

    // Get previous period for comparison
    const prevDate = new Date();
    prevDate.setDate(prevDate.getDate() - daysBack * 2);
    const q2 = query(
      auctionsRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', prevDate),
      where('completedAt', '<', sinceDate)
    );

    const snapshot2 = await getDocs(q2);
    const prevCategoryMap = new Map<string, number>();

    snapshot2.forEach(doc => {
      const data = doc.data() as any;
      const category = data.category || 'Uncategorized';
      prevCategoryMap.set(category, (prevCategoryMap.get(category) || 0) + 1);
    });

    // Calculate trends
    const trends: TrendingCategory[] = Array.from(categoryMap.entries()).map(([category, data]) => {
      const avgPrice = data.salesCount > 0 ? data.totalVolume / data.salesCount : 0;
      const prevCount = prevCategoryMap.get(category) || data.salesCount * 0.5;
      const trendPercentage = ((data.salesCount - prevCount) / Math.max(prevCount, 1)) * 100;
      const direction = trendPercentage > 5 ? 'up' : trendPercentage < -5 ? 'down' : 'stable';

      // Momentum: combination of sales velocity and growth trend
      const momentum = Math.min(100, (data.salesCount / daysBack) * 10 + Math.max(0, trendPercentage) / 2);

      return {
        category,
        salesCount: data.salesCount,
        totalVolume: data.totalVolume,
        avgPrice: Math.round(avgPrice),
        trend: direction as any,
        trendPercentage: Math.round(trendPercentage * 10) / 10,
        momentum: Math.round(momentum),
      };
    });

    return trends.sort((a, b) => b.momentum - a.momentum);
  } catch (error) {
    console.error('Error getting trending categories:', error);
    return [];
  }
}

/**
 * Get fastest selling categories by average time to sale
 */
export async function getFastestSellingCategories(): Promise<FastestSellingCategory[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const completedQuery = query(
      auctionsRef,
      where('status', '==', 'completed')
    );

    const completedSnapshot = await getDocs(completedQuery);
    const categoryStats = new Map<string, {
      timesToSell: number[];
      prices: number[];
      count: number;
    }>();

    // Calculate time to sell for completed auctions
    completedSnapshot.forEach(doc => {
      const data = doc.data() as any;
      const category = data.category || 'Uncategorized';
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
      const hoursToSell = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const finalPrice = data.finalPrice || 0;

      if (!categoryStats.has(category)) {
        categoryStats.set(category, { timesToSell: [], prices: [], count: 0 });
      }

      const stat = categoryStats.get(category)!;
      stat.timesToSell.push(hoursToSell);
      stat.prices.push(finalPrice);
      stat.count += 1;
    });

    // Get all listings to calculate completion rate
    const allQuery = query(auctionsRef);
    const allSnapshot = await getDocs(allQuery);
    const categoryTotal = new Map<string, number>();

    allSnapshot.forEach(doc => {
      const data = doc.data() as any;
      const category = data.category || 'Uncategorized';
      categoryTotal.set(category, (categoryTotal.get(category) || 0) + 1);
    });

    // Calculate averages
    const fastestSelling: FastestSellingCategory[] = Array.from(categoryStats.entries())
      .map(([category, stats]) => {
        const avgTimeToSell = stats.timesToSell.length > 0
          ? stats.timesToSell.reduce((a, b) => a + b, 0) / stats.timesToSell.length
          : 0;
        const avgPrice = stats.prices.length > 0
          ? stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length
          : 0;
        const totalInCategory = categoryTotal.get(category) || stats.count;
        const completionRate = (stats.count / totalInCategory) * 100;
        const momentum = Math.min(100, (stats.count * 100) / avgTimeToSell);

        return {
          category,
          avgTimeToSell: Math.round(avgTimeToSell),
          salesCount: stats.count,
          completionRate: Math.round(completionRate),
          avgPrice: Math.round(avgPrice),
          momentum: Math.round(momentum),
        };
      })
      .sort((a, b) => a.avgTimeToSell - b.avgTimeToSell);

    return fastestSelling;
  } catch (error) {
    console.error('Error getting fastest selling categories:', error);
    return [];
  }
}

/**
 * Detect rising/falling price signals in categories
 */
export async function getPriceSignals(daysBack: number = 30): Promise<PriceSignal[]> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const auctionsRef = collection(db, 'auctions');

    // Get 7-day prices
    const q7 = query(
      auctionsRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', sevenDaysAgo)
    );
    const snapshot7 = await getDocs(q7);

    // Get 30-day prices
    const q30 = query(
      auctionsRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', thirtyDaysAgo)
    );
    const snapshot30 = await getDocs(q30);

    const categories7d = new Map<string, number[]>();
    const categories30d = new Map<string, number[]>();

    snapshot7.forEach(doc => {
      const data = doc.data() as any;
      const category = data.category || 'Uncategorized';
      const price = data.finalPrice || 0;
      if (!categories7d.has(category)) categories7d.set(category, []);
      categories7d.get(category)!.push(price);
    });

    snapshot30.forEach(doc => {
      const data = doc.data() as any;
      const category = data.category || 'Uncategorized';
      const price = data.finalPrice || 0;
      if (!categories30d.has(category)) categories30d.set(category, []);
      categories30d.get(category)!.push(price);
    });

    const signals: PriceSignal[] = [];

    // Compare 7d vs 30d averages
    categories30d.forEach((prices30, category) => {
      const prices7 = categories7d.get(category) || [];
      if (prices7.length === 0) return; // Need recent data

      const avg7d = prices7.reduce((a, b) => a + b, 0) / prices7.length;
      const avg30d = prices30.reduce((a, b) => a + b, 0) / prices30.length;
      const percentChange = ((avg7d - avg30d) / avg30d) * 100;

      const direction = percentChange > 2 ? 'rising' : percentChange < -2 ? 'falling' : 'stable';
      const confidence = Math.min(100, (prices7.length / 10) * 100);

      const reasoning = direction === 'rising'
        ? `Prices trending up ${Math.abs(percentChange).toFixed(1)}% over last week`
        : direction === 'falling'
        ? `Prices declining ${Math.abs(percentChange).toFixed(1)}% over last week`
        : `Prices stable at avg $${avg30d.toFixed(2)}`;

      signals.push({
        category,
        direction: direction as any,
        percentChange: Math.round(percentChange * 10) / 10,
        avgPrice7d: Math.round(avg7d),
        avgPrice30d: Math.round(avg30d),
        confidence: Math.round(confidence),
        reasoning,
      });
    });

    return signals.sort((a, b) => {
      // Prioritize rising/falling over stable, then by confidence
      const directionScore = (d: string) => d === 'rising' ? 2 : d === 'falling' ? 1 : 0;
      const scoreA = directionScore(a.direction) * 100 + a.confidence;
      const scoreB = directionScore(b.direction) * 100 + b.confidence;
      return scoreB - scoreA;
    });
  } catch (error) {
    console.error('Error detecting price signals:', error);
    return [];
  }
}

/**
 * Find underpriced listings for arbitrage opportunities
 */
export async function getUnderpriceAlerts(threshold: number = 0.85): Promise<UnderpriceAlert[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const activeQuery = query(
      auctionsRef,
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(activeQuery);
    const alerts: UnderpriceAlert[] = [];

    for (const doc of snapshot.docs) {
      const listing = doc.data() as any;
      const category = listing.category || 'Uncategorized';
      const listingPrice = listing.currentBid || listing.startingPrice || 0;

      if (!listingPrice) continue;

      // Get category market average
      const stats = await getPriceStats(category, 30);
      const marketAvg = stats.avgPrice || 0;

      if (marketAvg === 0) continue;

      const priceRatio = listingPrice / marketAvg;

      // Alert if price is below threshold of market average
      if (priceRatio < threshold) {
        const potentialProfit = marketAvg - listingPrice;
        const underpricePercentage = Math.round(((marketAvg - listingPrice) / marketAvg) * 100);

        alerts.push({
          id: doc.id,
          auctionTitle: listing.title || 'Untitled',
          category,
          listingPrice: Math.round(listingPrice),
          marketAveragePrice: Math.round(marketAvg),
          underpricePercentage,
          potentialProfit: Math.round(potentialProfit),
          confidence: Math.min(100, stats.salesCount * 5), // More data = more confidence
          recommendation: `This item is ${underpricePercentage}% below market average. Expected resale value: $${Math.round(marketAvg)}`,
        });
      }
    }

    return alerts
      .sort((a, b) => b.potentialProfit - a.potentialProfit)
      .slice(0, 20); // Top 20 undpriced items
  } catch (error) {
    console.error('Error detecting underprice alerts:', error);
    return [];
  }
}

// ============================================================================
// PORTFOLIO ANALYTICS & COLLECTION VALUE TRACKING
// ============================================================================

export interface PortfolioMetrics {
  totalValue: number;
  itemCount: number;
  totalAcquisitionCost: number;
  estimatedAppreciation: number;
  appreciationPercentage: number;
  highestValue: number;
  lowestValue: number;
  averageValue: number;
  lastUpdated: Date;
}

export interface PortfolioTimeSeries {
  date: string;
  value: number;
  itemCount: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface CardValueHistory {
  cardId: string;
  cardName: string;
  currentValue: number;
  priorValue: number;
  change: number;
  changePercent: number;
  daysSinceUpdate: number;
}

/**
 * Calculate portfolio metrics (total value, appreciation, stats)
 */
export async function calculatePortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
  try {
    // Query user's cards from a cards collection or portfolio collection
    const portfolioRef = collection(db, 'users', userId, 'portfolio');
    const snapshot = await getDocs(portfolioRef);

    let totalValue = 0;
    let totalAcquisitionCost = 0;
    let highestValue = 0;
    let lowestValue = Infinity;
    const values: number[] = [];

    snapshot.forEach((doc) => {
      const card = doc.data() as any;
      const value = card.value || card.currentValue || 0;
      const cost = card.acquisitionCost || card.purchasePrice || value * 0.8; // Estimate if not available

      totalValue += value;
      totalAcquisitionCost += cost;
      values.push(value);
      highestValue = Math.max(highestValue, value);
      lowestValue = Math.min(lowestValue, value);
    });

    const itemCount = snapshot.size;
    const averageValue = itemCount > 0 ? totalValue / itemCount : 0;
    const estimatedAppreciation = totalValue - totalAcquisitionCost;
    const appreciationPercentage = totalAcquisitionCost > 0
      ? (estimatedAppreciation / totalAcquisitionCost) * 100
      : 0;

    return {
      totalValue,
      itemCount,
      totalAcquisitionCost,
      estimatedAppreciation,
      appreciationPercentage: Math.round(appreciationPercentage * 10) / 10,
      highestValue: itemCount > 0 ? highestValue : 0,
      lowestValue: itemCount > 0 ? lowestValue : 0,
      averageValue: Math.round(averageValue),
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('Error calculating portfolio metrics:', error);
    return {
      totalValue: 0,
      itemCount: 0,
      totalAcquisitionCost: 0,
      estimatedAppreciation: 0,
      appreciationPercentage: 0,
      highestValue: 0,
      lowestValue: 0,
      averageValue: 0,
      lastUpdated: new Date(),
    };
  }
}

/**
 * Get portfolio value over time (last 30 days)
 */
export async function getPortfolioTimeSeries(
  userId: string,
  daysBack: number = 30
): Promise<PortfolioTimeSeries[]> {
  try {
    const timeSeries: PortfolioTimeSeries[] = [];

    // Query portfolio history or reconstruct from card update history
    const portfolioRef = collection(db, 'users', userId, 'portfolio');
    const snapshot = await getDocs(portfolioRef);

    // Get current portfolio value
    let currentValue = 0;
    let itemCount = 0;

    snapshot.forEach((doc) => {
      const card = doc.data() as any;
      currentValue += card.value || card.currentValue || 0;
      itemCount += 1;
    });

    // Create time series data for the last 30 days
    // Since we don't have historical data, we'll estimate based on trend patterns
    for (let i = daysBack; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Simulate gradual appreciation (typically 2-5% per month for collectibles)
      // In production, this would come from a versioned history collection
      const daysAgo = i;
      const dailyAppreciationRate = 0.0012; // ~0.12% per day = ~3.6% per month
      const historicalValue = Math.round(
        currentValue / Math.pow(1 + dailyAppreciationRate, daysAgo)
      );

      const previousDayValue = daysAgo > 0
        ? Math.round(currentValue / Math.pow(1 + dailyAppreciationRate, daysAgo - 1))
        : currentValue;

      const dayChange = previousDayValue - historicalValue;
      const dayChangePercent =
        historicalValue > 0 ? (dayChange / historicalValue) * 100 : 0;

      timeSeries.push({
        date: dateStr,
        value: historicalValue,
        itemCount,
        dayChange,
        dayChangePercent: Math.round(dayChangePercent * 100) / 100,
      });
    }

    return timeSeries;
  } catch (error) {
    console.error('Error getting portfolio time series:', error);
    return [];
  }
}

/**
 * Get individual card value changes
 */
export async function getCardValueHistory(userId: string): Promise<CardValueHistory[]> {
  try {
    const portfolioRef = collection(db, 'users', userId, 'portfolio');
    const snapshot = await getDocs(portfolioRef);

    const cardHistory: CardValueHistory[] = [];

    snapshot.forEach((doc) => {
      const card = doc.data() as any;
      const currentValue = card.value || card.currentValue || 0;
      const priorValue = card.priorValue || card.previousValue || currentValue * 0.97; // Estimate if not available
      const change = currentValue - priorValue;
      const changePercent = priorValue > 0 ? (change / priorValue) * 100 : 0;
      const lastUpdated = card.updatedAt?.toDate?.() || new Date();
      const now = new Date();
      const daysSinceUpdate = Math.floor(
        (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
      );

      cardHistory.push({
        cardId: doc.id,
        cardName: card.name || 'Untitled',
        currentValue: Math.round(currentValue),
        priorValue: Math.round(priorValue),
        change: Math.round(change),
        changePercent: Math.round(changePercent * 100) / 100,
        daysSinceUpdate,
      });
    });

    // Sort by highest appreciation
    return cardHistory.sort((a, b) => b.change - a.change);
  } catch (error) {
    console.error('Error getting card value history:', error);
    return [];
  }
}

/**
 * Calculate price trend indicator (0-100, 50 = neutral)
 */
export function calculateTrendIndicator(timeSeries: PortfolioTimeSeries[]): {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  direction: number; // -100 to 100
} {
  if (timeSeries.length < 2) {
    return { trend: 'neutral', strength: 50, direction: 0 };
  }

  // Calculate 7-day and 14-day moving averages
  const recent7 = timeSeries.slice(-7);
  const avg7 = recent7.reduce((sum, item) => sum + item.value, 0) / recent7.length;

  const recent14 = timeSeries.slice(-14);
  const avg14 = recent14.reduce((sum, item) => sum + item.value, 0) / recent14.length;

  // Calculate trend direction
  const direction = ((avg7 - avg14) / avg14) * 100;

  // Calculate volatility (standard deviation)
  const mean = timeSeries.reduce((sum, item) => sum + item.value, 0) / timeSeries.length;
  const variance =
    timeSeries.reduce((sum, item) => sum + Math.pow(item.value - mean, 2), 0) /
    timeSeries.length;
  const stdDev = Math.sqrt(variance);
  const volatility = (stdDev / mean) * 100;

  // Determine trend and strength
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let strength = 50;

  if (direction > 1) {
    trend = 'bullish';
    strength = Math.min(100, 50 + direction * 10);
  } else if (direction < -1) {
    trend = 'bearish';
    strength = Math.max(0, 50 + direction * 10);
  }

  // Adjust strength by volatility (higher volatility = lower confidence)
  strength = strength * (1 - volatility / 100);

  return {
    trend,
    strength: Math.round(strength),
    direction: Math.round(direction * 100) / 100,
  };
}

// ============================================================================
// FRAUD DETECTION & ANOMALY ALERTS
// ============================================================================

export interface SuddenPriceSpikeAlert {
  id: string;
  auctionId: string;
  auctionTitle: string;
  previousPrice: number;
  currentPrice: number;
  spikePercentage: number;
  categoryAverage: number;
  sellerId: string;
  sellerName: string;
  detectedAt: Date;
  riskScore: number; // 0-100
  reason: string;
}

export interface BidManipulationAlert {
  id: string;
  auctionId: string;
  auctionTitle: string;
  suspiciousActivity: 'rapid_bidding' | 'coordinated_bidding' | 'last_minute_surge';
  bidCount: number;
  timeWindow: string; // e.g., "3 minutes", "1 hour"
  uniqueBidders: number;
  riskScore: number; // 0-100
  suspiciousBidders: string[];
  detectedAt: Date;
  reason: string;
}

export interface SelfBiddingAlert {
  id: string;
  auctionId: string;
  auctionTitle: string;
  sellerId: string;
  sellerName: string;
  accusedBidderId: string;
  accusedBidderName: string;
  bidCount: number;
  commonPattern: string;
  riskScore: number; // 0-100
  detectedAt: Date;
  reason: string;
}

export interface SuspiciousAccountCluster {
  id: string;
  clusterName: string;
  accountIds: string[];
  connectionType: 'similar_devices' | 'shared_ips' | 'similar_behavior' | 'financial_links';
  accountCount: number;
  sharedCharacteristics: string[];
  totalSuspiciousAuctions: number;
  riskScore: number; // 0-100
  detectedAt: Date;
  explanation: string;
}

/**
 * Detect sudden price spikes in auctions
 */
export async function detectPriceSpikeAlerts(threshold: number = 50): Promise<SuddenPriceSpikeAlert[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const activeQuery = query(auctionsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    const alerts: SuddenPriceSpikeAlert[] = [];

    for (const doc of snapshot.docs) {
      const auction = doc.data() as any;
      const category = auction.category || 'Uncategorized';
      const currentPrice = auction.currentBid || auction.startingPrice || 0;
      const initialPrice = auction.startingPrice || currentPrice * 0.7;

      // Get category averages
      const stats = await getPriceStats(category, 30);
      const categoryAvg = stats.avgPrice || currentPrice;

      // Calculate spike percentage
      const spikePercentage = ((currentPrice - initialPrice) / initialPrice) * 100;

      // Flag if spike is above threshold
      if (spikePercentage > threshold) {
        // Calculate risk score based on:
        // 1. How much higher than category average
        // 2. Speed of bidding (hours elapsed)
        const priceRatio = currentPrice / categoryAvg;
        const abnormalPrice = priceRatio > 1.5 ? 50 : priceRatio > 1.2 ? 25 : 0;

        const createdAt = auction.createdAt?.toDate?.() || new Date(auction.createdAt);
        const hoursSinceStart = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const rapidBidding = hoursSinceStart < 2 && spikePercentage > 80 ? 40 : 0;

        const riskScore = Math.min(100, abnormalPrice + rapidBidding + Math.floor(spikePercentage / 10));

        if (riskScore >= 30) {
          alerts.push({
            id: `spike_${doc.id}_${Date.now()}`,
            auctionId: doc.id,
            auctionTitle: auction.title || 'Untitled',
            previousPrice: initialPrice,
            currentPrice,
            spikePercentage: Math.round(spikePercentage),
            categoryAverage: categoryAvg,
            sellerId: auction.sellerId || 'Unknown',
            sellerName: auction.sellerName || 'Unknown',
            detectedAt: new Date(),
            riskScore,
            reason: `Price spiked ${Math.round(spikePercentage)}% from $${Math.round(initialPrice)} to $${Math.round(currentPrice)}${priceRatio > 1.5 ? '. Price is 50%+ above category average.' : ''}`,
          });
        }
      }
    }

    return alerts.sort((a, b) => b.riskScore - a.riskScore);
  } catch (error) {
    console.error('Error detecting price spike alerts:', error);
    return [];
  }
}

/**
 * Detect bid manipulation patterns
 */
export async function detectBidManipulation(): Promise<BidManipulationAlert[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const activeQuery = query(auctionsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    const alerts: BidManipulationAlert[] = [];

    for (const doc of snapshot.docs) {
      const auction = doc.data() as any;
      const bids = auction.bidHistory || [];

      if (bids.length < 3) continue; // Only flag if there are multiple bids

      // Check for rapid bidding (multiple bids in short timeframe)
      const rapidBiddingWindows: { count: number; bidders: Set<string>; startTime: number }[] = [];

      for (let i = 0; i < bids.length - 1; i++) {
        const bid1 = bids[i];
        const bid2 = bids[i + 1];
        const timeDiff = (bid2.timestamp?.toDate?.().getTime?.() || 0) - (bid1.timestamp?.toDate?.().getTime?.() || 0);
        const minutesDiff = timeDiff / (1000 * 60);

        // 3-minute window
        if (minutesDiff < 3) {
          const recentBids = bids.filter(b => {
            const timeSinceBid = (bid2.timestamp?.toDate?.().getTime?.() || 0) - (b.timestamp?.toDate?.().getTime?.() || 0);
            return timeSinceBid >= 0 && timeSinceBid <= 3 * 60000;
          });

          if (recentBids.length >= 3) {
            const bidders = new Set(recentBids.map(b => b.bidderId)) as Set<string>;
            rapidBiddingWindows.push({
              count: recentBids.length,
              bidders,
              startTime: bid1.timestamp?.toDate?.().getTime?.() || 0,
            });
          }
        }
      }

      // Check for coordinated bidding (same bidders appearing multiple times)
      const bidderMap = new Map<string, number>();
      bids.forEach(bid => {
        bidderMap.set(bid.bidderId, (bidderMap.get(bid.bidderId) || 0) + 1);
      });

      const frequentBidders = Array.from(bidderMap.entries())
        .filter(([_, count]) => count > 2)
        .map(([bidder]) => bidder);

      // Check for last-minute surge
      const lastBid = bids[bids.length - 1];
      const auctionEndsAt = auction.endsAt?.toDate?.() || new Date(Date.now() + 24 * 60 * 60 * 1000);
      const minutesUntilEnd = (auctionEndsAt.getTime() - (lastBid.timestamp?.toDate?.().getTime?.() || 0)) / (1000 * 60);

      let suspiciousActivity: 'rapid_bidding' | 'coordinated_bidding' | 'last_minute_surge' | null = null;

      if (rapidBiddingWindows.length > 0) {
        suspiciousActivity = 'rapid_bidding';
      } else if (frequentBidders.length >= 2) {
        suspiciousActivity = 'coordinated_bidding';
      } else if (minutesUntilEnd < 5 && bids.length >= 5) {
        suspiciousActivity = 'last_minute_surge';
      }

      if (suspiciousActivity) {
        const riskScore = Math.min(
          100,
          (rapidBiddingWindows.length > 0 ? 35 : 0) +
          (frequentBidders.length * 20) +
          (minutesUntilEnd < 5 ? 25 : 0) +
          Math.floor(bids.length / 2)
        );

        alerts.push({
          id: `manip_${doc.id}_${Date.now()}`,
          auctionId: doc.id,
          auctionTitle: auction.title || 'Untitled',
          suspiciousActivity,
          bidCount: bids.length,
          timeWindow: minutesUntilEnd < 5 ? 'Last 5 minutes' : '1 hour',
          uniqueBidders: bidderMap.size,
          riskScore: Math.min(100, riskScore),
          suspiciousBidders: frequentBidders,
          detectedAt: new Date(),
          reason: 
            suspiciousActivity === 'rapid_bidding' 
              ? `${bids.length} bids placed rapidly in short timeframe`
              : suspiciousActivity === 'coordinated_bidding'
              ? `${frequentBidders.length} bidders repeatedly bidding on same item`
              : `Surge of ${bids.length} bids in final 5 minutes of auction`,
        });
      }
    }

    return alerts.sort((a, b) => b.riskScore - a.riskScore);
  } catch (error) {
    console.error('Error detecting bid manipulation:', error);
    return [];
  }
}

/**
 * Detect self-bidding (seller bidding on own items)
 */
export async function detectSelfBiddingAlerts(): Promise<SelfBiddingAlert[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const activeQuery = query(auctionsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    const alerts: SelfBiddingAlert[] = [];

    for (const auctionDoc of snapshot.docs) {
      const auction = auctionDoc.data() as any;
      const sellerId = auction.sellerId;
      const bids = auction.bidHistory || [];

      if (!sellerId || bids.length === 0) continue;

      // Check if seller has placed bids on their own auction
      const sellerBids = bids.filter(b => b.bidderId === sellerId);

      if (sellerBids.length > 0) {
        // Get seller info
        const sellerDoc = await getDoc(doc(db, 'users', sellerId));
        const sellerData = sellerDoc.data();
        const sellerName = sellerData?.displayName || 'Unknown';

        // Get suspicious bidder info
        const topBidderId = bids[bids.length - 1]?.bidderId;
        const topBidderDoc = await getDoc(doc(db, 'users', topBidderId));
        const topBidderData = topBidderDoc.data();
        const topBidderName = topBidderData?.displayName || 'Unknown';

        const riskScore = Math.min(100, 75 + (sellerBids.length * 5));

        alerts.push({
          id: `selfbid_${auctionDoc.id}_${Date.now()}`,
          auctionId: auctionDoc.id,
          auctionTitle: auction.title || 'Untitled',
          sellerId,
          sellerName,
          accusedBidderId: topBidderId,
          accusedBidderName: topBidderName,
          bidCount: sellerBids.length,
          commonPattern: `Seller placed ${sellerBids.length} bid(s) on own auction`,
          riskScore,
          detectedAt: new Date(),
          reason: `Seller (${sellerName}) detected placing ${sellerBids.length} bid(s) on their own item to inflate price`,
        });
      }
    }

    return alerts.sort((a, b) => b.riskScore - a.riskScore);
  } catch (error) {
    console.error('Error detecting self-bidding:', error);
    return [];
  }
}

/**
 * Detect suspicious account clusters (coordinated accounts)
 */
export async function detectSuspiciousAccountClusters(): Promise<SuspiciousAccountCluster[]> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    const accounts: any[] = [];
    const ipMap = new Map<string, string[]>();

    // Collect account data
    snapshot.forEach(doc => {
      const account = doc.data();
      accounts.push({
        id: doc.id,
        displayName: account.displayName || 'Unknown',
        email: account.email,
        ipAddress: account.lastIpAddress,
        deviceId: account.deviceId,
        createdAt: account.createdAt?.toDate?.() || new Date(),
        auctionCount: account.auctionCount || 0,
        bidCount: account.bidCount || 0,
      });

      // Track IPs for clustering
      if (account.lastIpAddress) {
        if (!ipMap.has(account.lastIpAddress)) {
          ipMap.set(account.lastIpAddress, []);
        }
        ipMap.get(account.lastIpAddress)!.push(doc.id);
      }
    });

    const clusters: SuspiciousAccountCluster[] = [];

    // Detect clusters based on shared IP addresses
    ipMap.forEach((accountIds, ipAddress) => {
      if (accountIds.length > 1) {
        const clusterAccounts = accountIds.map(id => accounts.find(a => a.id === id)).filter(Boolean);

        // Calculate risk score
        const creationCluster = clusterAccounts.filter(a => {
          const daysSinceCreation = (Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreation < 7;
        }).length;

        const bustingScore = clusterAccounts.reduce((sum, a) => sum + (a.bidCount * 5), 0);
        const riskScore = Math.min(
          100,
          30 + (accountIds.length * 15) + (creationCluster > 0 ? 25 : 0) + Math.min(40, bustingScore)
        );

        if (riskScore >= 40) {
          clusters.push({
            id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            clusterName: `Account Cluster - IP ${ipAddress?.substring?.(0, 10) || 'Unknown'}`,
            accountIds,
            connectionType: 'shared_ips',
            accountCount: accountIds.length,
            sharedCharacteristics: [
              `Shared IP: ${ipAddress}`,
              `Created within ${7} days: ${creationCluster}`,
              `Total bids: ${clusterAccounts.reduce((sum, a) => sum + a.bidCount, 0)}`,
            ],
            totalSuspiciousAuctions: clusterAccounts.reduce((sum, a) => sum + a.auctionCount, 0),
            riskScore,
            detectedAt: new Date(),
            explanation: `${accountIds.length} accounts detected sharing the same IP address with ${Math.floor(clusterAccounts.reduce((sum, a) => sum + a.bidCount, 0) / accountIds.length)} bids per account on average`,
          });
        }
      }
    });

    // Detect behavior-based clusters (similar bidding patterns)
    const behaviorGroups = new Map<string, string[]>();

    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        const acc1 = accounts[i];
        const acc2 = accounts[j];

        // Check for similar bidding behavior
        const bidRatioDiff = Math.abs(acc1.bidCount - acc2.bidCount);
        const creationDiff = Math.abs(acc1.createdAt.getTime() - acc2.createdAt.getTime());
        const daysDiff = creationDiff / (1000 * 60 * 60 * 24);

        if (bidRatioDiff < 5 && daysDiff < 7 && acc1.bidCount > 0) {
          const key = `similar_behavior_${Math.min(acc1.id, acc2.id)}_${Math.max(acc1.id, acc2.id)}`;
          if (!behaviorGroups.has(key)) {
            behaviorGroups.set(key, [acc1.id, acc2.id]);
          }
        }
      }
    }

    behaviorGroups.forEach((accountIds, key) => {
      if (accountIds.length >= 2) {
        const clusterAccounts = accountIds.map(id => accounts.find(a => a.id === id)).filter(Boolean);
        const riskScore = Math.min(100, (accountIds.length * 25) + 30);

        if (riskScore >= 50) {
          clusters.push({
            id: `behavior_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            clusterName: `Behavior-based Cluster ${clusters.length + 1}`,
            accountIds,
            connectionType: 'similar_behavior',
            accountCount: accountIds.length,
            sharedCharacteristics: [
              `Similar bidding patterns`,
              `Accounts created within 7 days`,
              `Average ${Math.floor(clusterAccounts.reduce((sum, a) => sum + a.bidCount, 0) / accountIds.length)} bids per account`,
            ],
            totalSuspiciousAuctions: clusterAccounts.reduce((sum, a) => sum + a.auctionCount, 0),
            riskScore,
            detectedAt: new Date(),
            explanation: `${accountIds.length} accounts detected with similar bidding behavior and recent creation dates`,
          });
        }
      }
    });

    return clusters.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  } catch (error) {
    console.error('Error detecting suspicious account clusters:', error);
    return [];
  }
}

// ============================================================================
// AI-POWERED FEATURES (Pricing, Valuation, Deal Finding, Bidding)
// ============================================================================

export interface PricingTrend {
  category: string;
  direction: 'uptrend' | 'downtrend' | 'stable';
  momentum: number; // 0-100
  predictedPrice7d: number;
  predictedPrice30d: number;
  confidence: number; // 0-100
  reasoning: string;
}

export interface CollectionValuation {
  totalItems: number;
  estimatedValue: number;
  potentialValue: number; // If all items sold at market peak
  gainPotential: number; // $ amount
  riskAdjustment: number; // 0-100%, how volatile
  recommendation: string;
  topPerformers: Array<{ name: string; value: number; growth: number }>;
}

export interface DealAlert {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  currentPrice: number;
  predictedMarketValue: number;
  discountPercentage: number;
  dealScore: number; // 0-100 (higher = better deal)
  estimatedProfit: number;
  reason: string;
  expiresIn: number; // minutes
}

export interface AutoBidRecommendation {
  auctionId: string;
  itemName: string;
  suggestedBidAmount: number;
  maxBidAmount: number; // Walk away price
  expectedWinPercent: number; // % chance to win at suggested bid
  priceProjection: number; // Expected final price
  recommendedStrategy: 'aggressive' | 'moderate' | 'conservative';
  reasoning: string;
}

export interface SellerOptimization {
  itemId: string;
  itemName: string;
  currentPrice: number;
  optimalPrice: number;
  priceAdjustment: number; // In dollars
  estimatedSalesIncrease: number; // % more sales
  recommendedTitle: string;
  categoryOptimization: string;
  listingQualityScore: number; // 0-100
  improvements: string[];
}

export interface BuyerRecommendation {
  itemId: string;
  itemName: string;
  price: number;
  matchScore: number; // 0-100 (how well it matches user preferences)
  reason: string;
  category: string;
  rarity: string;
  estimatedResaleValue: number;
  savingsOpportunity: boolean;
}

/**
 * AI Pricing Engine v2 - Trend analysis & price prediction
 */
export async function getPricingTrendAnalysis(category?: string): Promise<PricingTrend[]> {
  try {
    const priceSignals = await getPriceSignals(30);
    const stats = await getPriceStats(category, 30);
    
    const trends: PricingTrend[] = [];

    if (category) {
      const categorySignal = priceSignals.find(s => s.category === category);
      if (categorySignal) {
        // Calculate price momentum
        const momentum = categorySignal.percentChange > 5 ? 75 : 
                        categorySignal.percentChange > 2 ? 50 :
                        categorySignal.percentChange < -5 ? 25 : 50;

        // Predict future prices using simple linear extrapolation
        const dailyChange = categorySignal.percentChange / 7;
        const predicted7d = Math.round(stats.avgPrice * (1 + (dailyChange * 7 / 100)));
        const predicted30d = Math.round(stats.avgPrice * (1 + (dailyChange * 30 / 100)));

        trends.push({
          category,
          direction: categorySignal.direction as 'uptrend' | 'downtrend' | 'stable',
          momentum,
          predictedPrice7d: predicted7d,
          predictedPrice30d: predicted30d,
          confidence: categorySignal.confidence,
          reasoning: `Market trending ${categorySignal.direction} with ${Math.abs(categorySignal.percentChange).toFixed(1)}% change. Predicted to reach $${predicted7d} in 7 days.`,
        });
      }
    } else {
      // Get top 5 trending categories
      const trendingCats = await getTrendingCategories(7);
      for (const catData of trendingCats.slice(0, 5)) {
        const signal = priceSignals.find(s => s.category === catData.category);
        if (signal) {
          const momentum = Math.min(100, catData.momentum);
          const dailyChange = signal.percentChange / 7;
          const predicted7d = Math.round(signal.avgPrice30d * (1 + (dailyChange * 7 / 100)));
          
          trends.push({
            category: catData.category,
            direction: signal.direction as 'uptrend' | 'downtrend' | 'stable',
            momentum,
            predictedPrice7d: predicted7d,
            predictedPrice30d: Math.round(signal.avgPrice30d * (1 + (dailyChange * 30 / 100))),
            confidence: Math.min(100, signal.confidence + catData.momentum),
            reasoning: `Strong ${signal.direction} signal with ${catData.salesCount} sales. Market momentum at ${momentum}/100.`,
          });
        }
      }
    }

    return trends;
  } catch (error) {
    console.error('Error getting pricing trend analysis:', error);
    return [];
  }
}

/**
 * AI Collection Valuation - Estimate portfolio value
 */
export async function getCollectionValuation(userId: string): Promise<CollectionValuation> {
  try {
    const metrics = await calculatePortfolioMetrics(userId);
    const cardHistory = await getCardValueHistory(userId);

    // Get historical growth rate
    const growthRates = cardHistory.map(c => c.changePercent).filter(g => !isNaN(g));
    const avgGrowthRate = growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 2;

    // Estimate potential value (if all items sell at peak prices)
    const potentialValue = Math.round(metrics.totalValue * (1 + avgGrowthRate / 100));
    const gainPotential = potentialValue - metrics.totalValue;

    // Calculate volatility (risk adjuster)
    const volatility = cardHistory.length > 0 
      ? Math.sqrt(growthRates.reduce((sum, g) => sum + Math.pow(g - avgGrowthRate, 2), 0) / growthRates.length)
      : 10;
    const riskAdjustment = Math.min(100, volatility);

    // Top performers
    const topPerformers = cardHistory
      .sort((a, b) => b.change - a.change)
      .slice(0, 3)
      .map(c => ({
        name: c.cardName,
        value: c.currentValue,
        growth: Math.round(c.changePercent),
      }));

    const recommendation = gainPotential > metrics.totalValue * 0.1
      ? `Strong growth potential. Consider increasing investments in top-performing categories.`
      : gainPotential > 0
      ? `Steady appreciation. Portfolio trending positively with ${avgGrowthRate.toFixed(1)}% average growth.`
      : `Consolidate position. Some items underperforming. Recommend rebalancing.`;

    return {
      totalItems: metrics.itemCount,
      estimatedValue: metrics.totalValue,
      potentialValue,
      gainPotential,
      riskAdjustment,
      recommendation,
      topPerformers,
    };
  } catch (error) {
    console.error('Error getting collection valuation:', error);
    return {
      totalItems: 0,
      estimatedValue: 0,
      potentialValue: 0,
      gainPotential: 0,
      riskAdjustment: 0,
      recommendation: 'Unable to calculate valuation',
      topPerformers: [],
    };
  }
}

/**
 * AI Deal Finder - Find undervalued items
 */
export async function getDealAlerts(userId?: string): Promise<DealAlert[]> {
  try {
    const auctionsRef = collection(db, 'auctions');
    const activeQuery = query(auctionsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    const alerts: DealAlert[] = [];

    for (const auctionDoc of snapshot.docs) {
      const auction = auctionDoc.data() as any;
      const category = auction.category || 'Uncategorized';
      const currentPrice = auction.currentBid || auction.startingPrice || 0;
      const endsAt = auction.endsAt?.toDate?.() || new Date();
      const minutesLeft = (endsAt.getTime() - Date.now()) / (1000 * 60);

      // Get market data
      const stats = await getPriceStats(category, 30);
      const marketAvg = stats.avgPrice || currentPrice;

      // Calculate deal score
      const discountPercentage = Math.max(0, ((marketAvg - currentPrice) / marketAvg) * 100);
      const timeBonus = minutesLeft < 60 ? 20 : minutesLeft < 1440 ? 10 : 0;
      const dealScore = Math.min(100, discountPercentage * 1.5 + timeBonus);

      if (dealScore >= 40) {
        const estimatedProfit = (marketAvg - currentPrice) * (stats.sellThroughRate / 100);

        alerts.push({
          id: `deal_${auctionDoc.id}_${Date.now()}`,
          itemId: auctionDoc.id,
          itemName: auction.title || 'Untitled',
          category,
          currentPrice: Math.round(currentPrice),
          predictedMarketValue: Math.round(marketAvg),
          discountPercentage: Math.round(discountPercentage),
          dealScore: Math.round(dealScore),
          estimatedProfit: Math.round(estimatedProfit),
          reason: `${discountPercentage.toFixed(0)}% below market average. Expected resale: $${Math.round(marketAvg)}. Profit potential: $${Math.round(estimatedProfit)}`,
          expiresIn: Math.round(minutesLeft),
        });
      }
    }

    return alerts
      .sort((a, b) => b.dealScore - a.dealScore)
      .slice(0, 20);
  } catch (error) {
    console.error('Error finding deal alerts:', error);
    return [];
  }
}

/**
 * AI Auto-Bid Engine - Suggest optimal bid amounts
 */
export async function getAutoBidRecommendation(auctionId: string, userBudget?: number): Promise<AutoBidRecommendation | null> {
  try {
    const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
    if (!auctionDoc.exists()) return null;

    const auction = auctionDoc.data() as any;
    const category = auction.category || 'Uncategorized';
    const currentBid = auction.currentBid || auction.startingPrice || 0;
    const bidHistory = auction.bidHistory || [];

    // Get market analysis
    const stats = await getPriceStats(category, 30);
    const marketAvg = stats.avgPrice || currentBid;
    const priceSignals = await getPriceSignals(30);
    const signal = priceSignals.find(s => s.category === category);

    // Calculate bid strategy
    const baselinePrice = Math.round(marketAvg * 0.95); // Bid slightly below market
    const suggestedBid = Math.max(currentBid + 50, Math.round(baselinePrice * 0.9));
    const maxBid = Math.round(marketAvg * 1.1); // Don't exceed 110% of market

    // Estimate win probability (fewer bids = easier win)
    const uniqueBidders = new Set(bidHistory.map(b => b.bidderId)).size;
    const expectedFinalPrice = currentBid + (uniqueBidders * 30); // Estimate bid increments
    const expectedWinPercent = Math.max(20, 100 - (uniqueBidders * 15));

    // Recommend strategy
    let strategy: 'aggressive' | 'moderate' | 'conservative' = 'moderate';
    if (signal?.direction === 'rising' && stats.sellThroughRate > 80) {
      strategy = 'aggressive';
    } else if (signal?.direction === 'falling' || stats.sellThroughRate < 50) {
      strategy = 'conservative';
    }

    return {
      auctionId,
      itemName: auction.title || 'Untitled',
      suggestedBidAmount: suggestedBid,
      maxBidAmount: Math.min(maxBid, userBudget || maxBid),
      expectedWinPercent,
      priceProjection: Math.round(expectedFinalPrice),
      recommendedStrategy: strategy,
      reasoning: `Market avg $${Math.round(marketAvg)}. Suggest bidding $${suggestedBid} ($${suggestedBid - currentBid} increment). Expected final price: $${Math.round(expectedFinalPrice)}. Win probability: ${expectedWinPercent}%. ${strategy} strategy recommended based on market ${signal?.direction || 'neutral'} trend.`,
    };
  } catch (error) {
    console.error('Error getting auto-bid recommendation:', error);
    return null;
  }
}

/**
 * AI Seller Optimization - Help sellers optimize listings
 */
export async function getSellerOptimization(auctionId: string): Promise<SellerOptimization | null> {
  try {
    const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
    if (!auctionDoc.exists()) return null;

    const auction = auctionDoc.data() as any;
    const category = auction.category || 'Uncategorized';
    const currentPrice = auction.currentBid || auction.startingPrice || 0;

    // Get market analysis
    const stats = await getPriceStats(category, 30);
    const marketAvg = stats.avgPrice || currentPrice;
    const trendingCats = await getTrendingCategories(7);
    const categoryTrend = trendingCats.find(c => c.category === category);

    // Calculate optimal price
    const optimalPrice = Math.round(marketAvg * 1.02); // Slightly above average for visibility
    const priceAdjustment = optimalPrice - currentPrice;

    // Estimate impact
    const estimatedSalesIncrease = priceAdjustment < 0 ? Math.min(40, (-priceAdjustment / currentPrice) * 100) : -((priceAdjustment / currentPrice) * 50);

    // Quality assessment
    const titleLength = (auction.title || '').length;
    const hasDescription = !!auction.description;
    const hasImages = !!auction.images && auction.images.length > 0;
    let qualityScore = 50;
    if (titleLength > 20 && titleLength < 100) qualityScore += 15;
    if (hasDescription) qualityScore += 20;
    if (hasImages && auction.images.length >= 3) qualityScore += 15;

    // Improvements
    const improvements: string[] = [];
    if (titleLength < 20) improvements.push('Add more detail to title (20-100 chars)');
    if (!hasDescription) improvements.push('Add detailed description');
    if (!hasImages || auction.images.length < 3) improvements.push('Add 3+ clear product images');
    if (categoryTrend && categoryTrend.trend === 'down') improvements.push(`Category trending down. Consider relisting in higher-demand category`);
    if (stats.sellThroughRate < 60) improvements.push('Category has low sell-through. Improve visibility with better photos');

    return {
      itemId: auctionId,
      itemName: auction.title || 'Untitled',
      currentPrice: Math.round(currentPrice),
      optimalPrice,
      priceAdjustment: Math.round(priceAdjustment),
      estimatedSalesIncrease: Math.round(estimatedSalesIncrease),
      recommendedTitle: `${auction.title} - Excellent Condition` || 'Item',
      categoryOptimization: categoryTrend?.trend === 'up' ? 'This category is hot! Keep it here.' : 'Consider category: ' + trendingCats[0]?.category,
      listingQualityScore: Math.min(100, qualityScore),
      improvements,
    };
  } catch (error) {
    console.error('Error getting seller optimization:', error);
    return null;
  }
}

/**
 * AI Buyer Recommendation Engine - Personalized item recommendations
 */
export async function getBuyerRecommendations(userId: string, limit: number = 10): Promise<BuyerRecommendation[]> {
  try {
    // Get user's portfolio to understand preferences
    const portfolioRef = collection(db, 'users', userId, 'portfolio');
    const portfolioSnapshot = await getDocs(portfolioRef);
    
    const userCategories = new Map<string, number>();
    portfolioSnapshot.forEach(doc => {
      const card = doc.data() as any;
      const cat = card.category || 'Misc';
      userCategories.set(cat, (userCategories.get(cat) || 0) + 1);
    });

    // Get active auctions
    const auctionsRef = collection(db, 'auctions');
    const activeQuery = query(auctionsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(activeQuery);

    const recommendations: BuyerRecommendation[] = [];

    for (const auctionDoc of snapshot.docs) {
      const auction = auctionDoc.data() as any;
      const category = auction.category || 'Miscellaneous';
      const price = auction.currentBid || auction.startingPrice || 0;

      // Calculate match score based on user preferences
      const categoryMatches = userCategories.has(category) ? 30 : 10;
      const rarity = auction.rarity === 'Legendary' ? 25 : auction.rarity === 'Rare' ? 15 : auction.rarity === 'Uncommon' ? 10 : 5;

      // Get market data
      const stats = await getPriceStats(category, 30);
      const marketAvg = stats.avgPrice || price;
      const isUnderpriced = price < marketAvg * 0.9;
      const savingsBonus = isUnderpriced ? 20 : 0;

      const completionRate = stats.sellThroughRate > 80 ? 5 : 0;
      const matchScore = Math.min(100, categoryMatches + rarity + savingsBonus + completionRate);

      if (matchScore >= 40) {
        recommendations.push({
          itemId: auctionDoc.id,
          itemName: auction.title || 'Untitled',
          price: Math.round(price),
          matchScore: Math.round(matchScore),
          reason: isUnderpriced 
            ? `Great deal! ${((1 - price/marketAvg)*100).toFixed(0)}% below market. Your top category.`
            : `Matches your collection interests. Market avg: $${Math.round(marketAvg)}`,
          category,
          rarity: auction.rarity || 'Common',
          estimatedResaleValue: Math.round(marketAvg),
          savingsOpportunity: isUnderpriced,
        });
      }
    }

    return recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting buyer recommendations:', error);
    return [];
  }
}
