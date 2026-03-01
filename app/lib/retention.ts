/**
 * Buyer Retention & Engagement Module
 * Handles: Notifications, Watchlists, Seller Boosts, & DAU Tracking
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
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';

/**
 * NOTIFICATION SYSTEM
 * Drives: Daily Active Users, Engagement, Retention
 */

export interface Notification {
  id: string;
  userId: string;
  type: 'deal_alert' | 'recommendation' | 'auction_ending' | 'price_drop' | 'outbid' | 'watchlist_activity';
  title: string;
  message: string;
  relatedAuctionId?: string;
  relatedItemId?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface NotificationPreferences {
  userId: string;
  dealAlerts: boolean;
  recommendations: boolean;
  auctionEnding: boolean;
  priceDrops: boolean;
  outbidNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  dailyDigest: boolean;
  digestTime: string; // HH:MM format
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  relatedAuctionId?: string,
  actionUrl?: string
): Promise<string> {
  try {
    const notifRef = doc(collection(db, 'users', userId, 'notifications'));
    const notification: Omit<Notification, 'id'> = {
      userId,
      type,
      title,
      message,
      relatedAuctionId,
      relatedItemId: relatedAuctionId,
      actionUrl,
      read: false,
      createdAt: serverTimestamp() as Timestamp,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) as any, // 30 days
    };

    await setDoc(notifRef, notification);
    return notifRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get unread notifications for user (for bell icon badge)
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  try {
    const notifsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notifsRef, where('read', '==', false), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt as Timestamp,
    } as Notification));
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
      read: true,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

/**
 * Get notification preferences for user
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'notifications');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as NotificationPreferences;
    }

    // Return defaults
    return {
      userId,
      dealAlerts: true,
      recommendations: true,
      auctionEnding: true,
      priceDrops: true,
      outbidNotifications: true,
      emailNotifications: false,
      pushNotifications: true,
      dailyDigest: true,
      digestTime: '09:00',
    };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return {
      userId,
      dealAlerts: true,
      recommendations: true,
      auctionEnding: true,
      priceDrops: true,
      outbidNotifications: true,
      emailNotifications: false,
      pushNotifications: true,
      dailyDigest: true,
      digestTime: '09:00',
    };
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'notifications');
    await updateDoc(docRef, { ...preferences, userId });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
  }
}

/**
 * WATCHLIST SYSTEM
 * Drives: Habit Formation, Repeat Visits, Higher GMV
 */

export interface WatchlistItem {
  id: string;
  userId: string;
  auctionId: string;
  auctionTitle: string;
  category: string;
  currentPrice: number;
  watchPrice?: number; // Alert when drops below this
  addedAt: Timestamp;
  lastNotifiedAt?: Timestamp;
  deleted?: boolean;
  deletedAt?: Timestamp;
}

export interface WatchlistStats {
  totalWatched: number;
  categoryBreakdown: Record<string, number>;
  avgWatchedPrice: number;
  priceDropsNotified: number;
}

/**
 * Add item to user's watchlist
 */
export async function addToWatchlist(
  userId: string,
  auctionId: string,
  auctionTitle: string,
  category: string,
  currentPrice: number,
  watchPrice?: number
): Promise<string> {
  try {
    const watchRef = doc(collection(db, 'users', userId, 'watchlist'));
    const item: Omit<WatchlistItem, 'id'> = {
      userId,
      auctionId,
      auctionTitle,
      category,
      currentPrice,
      watchPrice,
      addedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(watchRef, item);
    return watchRef.id;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
}

/**
 * Remove item from watchlist
 */
export async function removeFromWatchlist(userId: string, watchlistId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId, 'watchlist', watchlistId), {
      deleted: true,
      deletedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
  }
}

/**
 * Get user's watchlist
 */
export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  try {
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const q = query(watchlistRef, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        addedAt: doc.data().addedAt as Timestamp,
      } as WatchlistItem))
      .filter(item => !item.deleted);
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return [];
  }
}

/**
 * Get watchlist statistics
 */
export async function getWatchlistStats(userId: string): Promise<WatchlistStats> {
  try {
    const watchlist = await getWatchlist(userId);

    const categoryBreakdown: Record<string, number> = {};
    let totalPrice = 0;

    watchlist.forEach(item => {
      categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
      totalPrice += item.currentPrice;
    });

    return {
      totalWatched: watchlist.length,
      categoryBreakdown,
      avgWatchedPrice: watchlist.length > 0 ? Math.round(totalPrice / watchlist.length) : 0,
      priceDropsNotified: 0, // Would be calculated from notification logs
    };
  } catch (error) {
    console.error('Error getting watchlist stats:', error);
    return {
      totalWatched: 0,
      categoryBreakdown: {},
      avgWatchedPrice: 0,
      priceDropsNotified: 0,
    };
  }
}

/**
 * SELLER BOOST SYSTEM
 * Drives: GMV, More Bids, More Sales
 */

export interface SellerBoost {
  id: string;
  sellerId: string;
  auctionId: string;
  boostType: 'featured' | 'highlighted' | 'promoted';
  bidAmount: number; // Cost to boost
  startedAt: Timestamp;
  endsAt: Timestamp;
  impressions: number;
  clicks: number;
  bidsGenerated: number;
  status: 'active' | 'expired' | 'paused';
  roi: number; // (bids * avgIncrementSize) / bidAmount
}

export interface BoostRecommendation {
  auctionId: string;
  itemName: string;
  currentBids: number;
  estimatedBidsWithBoost: number;
  boostCost: number;
  estimatedROI: number;
  reason: string;
}

/**
 * Get boost recommendations for seller
 */
export async function getBoostRecommendations(sellerId: string): Promise<BoostRecommendation[]> {
  try {
    // Get seller's active auctions with low bid counts
    const auctionsRef = collection(db, 'auctions');
    const q = query(
      auctionsRef,
      where('sellerId', '==', sellerId),
      where('status', '==', 'active'),
      orderBy('bidHistory.length', 'asc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    const recommendations: BoostRecommendation[] = [];

    for (const auctionDoc of snapshot.docs) {
      const auction = auctionDoc.data() as any;
      const bidCount = auction.bidHistory?.length || 0;

      // Recommend boost if bid count is low
      if (bidCount < 3) {
        const estimatedIncrease = Math.ceil(bidCount * 0.5) + 2; // Expect +50% more bids
        const boostCost = 500; // $5 per boost
        const estimatedExtraRevenue = estimatedIncrease * 25; // Assume $25 avg bid increment

        recommendations.push({
          auctionId: auctionDoc.id,
          itemName: auction.title || 'Untitled',
          currentBids: bidCount,
          estimatedBidsWithBoost: bidCount + estimatedIncrease,
          boostCost,
          estimatedROI: Math.round((estimatedExtraRevenue / boostCost) * 100),
          reason:
            bidCount === 0
              ? 'No bids yet - boost to attract buyers'
              : bidCount < 2
              ? 'Low engagement - boost visibility'
              : 'Moderate engagement - boost for final push',
        });
      }
    }

    return recommendations.sort((a, b) => b.estimatedROI - a.estimatedROI);
  } catch (error) {
    console.error('Error getting boost recommendations:', error);
    return [];
  }
}

/**
 * Create a boost for an auction
 */
export async function createSellerBoost(
  sellerId: string,
  auctionId: string,
  boostType: 'featured' | 'highlighted' | 'promoted',
  durationDays: number = 3
): Promise<string> {
  try {
    const boostRef = doc(collection(db, 'auctions', auctionId, 'boosts'));
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const bidAmount = boostType === 'featured' ? 1500 : boostType === 'highlighted' ? 1000 : 500;

    const boost: Omit<SellerBoost, 'id'> = {
      sellerId,
      auctionId,
      boostType,
      bidAmount,
      startedAt: serverTimestamp() as Timestamp,
      endsAt: endDate as any,
      impressions: 0,
      clicks: 0,
      bidsGenerated: 0,
      status: 'active',
      roi: 0,
    };

    await setDoc(boostRef, boost);
    return boostRef.id;
  } catch (error) {
    console.error('Error creating seller boost:', error);
    throw error;
  }
}

/**
 * Get active boosts for auction
 */
export async function getActiveBoosts(auctionId: string): Promise<SellerBoost[]> {
  try {
    const boostsRef = collection(db, 'auctions', auctionId, 'boosts');
    const q = query(boostsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startedAt: doc.data().startedAt as Timestamp,
      endsAt: doc.data().endsAt as Timestamp,
    } as SellerBoost));
  } catch (error) {
    console.error('Error getting active boosts:', error);
    return [];
  }
}

/**
 * DAU TRACKING & ANALYTICS
 * Drives: Understanding User Engagement
 */

export interface DAUEvent {
  userId: string;
  timestamp: Timestamp;
  action: string;
  category: string;
  metadata?: Record<string, any>;
}

/**
 * Record user activity (called on any page load or interaction)
 */
export async function recordUserActivity(
  userId: string,
  action: string,
  category: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const logsRef = collection(db, 'users', userId, 'activityLogs');
    await setDoc(doc(logsRef), {
      timestamp: serverTimestamp(),
      action,
      category,
      metadata,
    });

    // Update user's lastActiveAt
    await updateDoc(doc(db, 'users', userId), {
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error recording user activity:', error);
  }
}

/**
 * Calculate Daily Active Users (for admin dashboard)
 */
export async function calculateDAU(daysBack: number = 1): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('lastActiveAt', '>=', cutoffDate));
    const snapshot = await getDocs(q);

    return snapshot.size;
  } catch (error) {
    console.error('Error calculating DAU:', error);
    return 0;
  }
}

/**
 * Get user engagement metrics
 */
export async function getUserEngagementMetrics(userId: string): Promise<{
  visitCount: number;
  lastVisit: Date | null;
  averageSessionDuration: number;
  engagementScore: number; // 0-100
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const lastActiveAt = userDoc.data()?.lastActiveAt?.toDate?.() || null;

    const logsRef = collection(db, 'users', userId, 'activityLogs');
    const logs = await getDocs(logsRef);

    const visitCount = logs.size;
    const engagementScore = Math.min(100, visitCount * 10); // 10 points per visit

    return {
      visitCount,
      lastVisit: lastActiveAt,
      averageSessionDuration: 300, // Placeholder: 5 minutes
      engagementScore,
    };
  } catch (error) {
    console.error('Error getting engagement metrics:', error);
    return {
      visitCount: 0,
      lastVisit: null,
      averageSessionDuration: 0,
      engagementScore: 0,
    };
  }
}
