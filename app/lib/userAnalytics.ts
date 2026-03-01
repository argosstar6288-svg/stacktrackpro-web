/**
 * User Analytics & Preference Profiling Module
 * Tracks user interactions and builds preference profiles
 */

import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  increment,
  updateDoc,
} from 'firebase/firestore';

/**
 * INTERACTION TRACKING
 */

export interface UserInteraction {
  id: string;
  userId: string;
  type: 'bid' | 'purchase' | 'view' | 'favorite';
  auctionId: string;
  itemName: string;
  category: string;
  price: number;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

export interface BidInteraction extends UserInteraction {
  type: 'bid';
  bidAmount: number;
  won?: boolean;
}

export interface PurchaseInteraction extends UserInteraction {
  type: 'purchase';
  finalPrice: number;
  sellerRating?: number;
}

export interface ViewInteraction extends UserInteraction {
  type: 'view';
  timeSpentSeconds?: number;
}

export interface FavoriteInteraction extends UserInteraction {
  type: 'favorite';
  favorited: boolean;
}

/**
 * Record a bid interaction
 */
export async function recordBid(
  userId: string,
  auctionId: string,
  itemName: string,
  category: string,
  bidAmount: number,
  currentPrice: number,
  metadata?: Record<string, any>
): Promise<string> {
  try {
    const interactionRef = doc(collection(db, 'users', userId, 'interactions'));
    const interaction: Omit<BidInteraction, 'id'> = {
      userId,
      type: 'bid',
      auctionId,
      itemName,
      category,
      price: currentPrice,
      bidAmount,
      timestamp: serverTimestamp() as Timestamp,
      metadata,
    };

    await setDoc(interactionRef, interaction);

    // Update user stats
    await updateDoc(doc(db, 'users', userId), {
      totalBids: increment(1),
      lastBidAt: serverTimestamp(),
    });

    return interactionRef.id;
  } catch (error) {
    console.error('Error recording bid:', error);
    throw error;
  }
}

/**
 * Record a purchase interaction
 */
export async function recordPurchase(
  userId: string,
  auctionId: string,
  itemName: string,
  category: string,
  finalPrice: number,
  sellerRating?: number
): Promise<string> {
  try {
    const interactionRef = doc(collection(db, 'users', userId, 'interactions'));
    const interaction: Omit<PurchaseInteraction, 'id'> = {
      userId,
      type: 'purchase',
      auctionId,
      itemName,
      category,
      price: finalPrice,
      finalPrice,
      sellerRating,
      timestamp: serverTimestamp() as Timestamp,
    };

    await setDoc(interactionRef, interaction);

    // Update user stats
    await updateDoc(doc(db, 'users', userId), {
      totalPurchases: increment(1),
      totalSpent: increment(finalPrice),
      lastPurchaseAt: serverTimestamp(),
    });

    return interactionRef.id;
  } catch (error) {
    console.error('Error recording purchase:', error);
    throw error;
  }
}

/**
 * Record a view interaction
 */
export async function recordView(
  userId: string,
  auctionId: string,
  itemName: string,
  category: string,
  price: number,
  timeSpentSeconds: number = 0
): Promise<string> {
  try {
    const interactionRef = doc(collection(db, 'users', userId, 'interactions'));
    const interaction: Omit<ViewInteraction, 'id'> = {
      userId,
      type: 'view',
      auctionId,
      itemName,
      category,
      price,
      timeSpentSeconds,
      timestamp: serverTimestamp() as Timestamp,
    };

    await setDoc(interactionRef, interaction);

    // Update user stats
    await updateDoc(doc(db, 'users', userId), {
      totalViews: increment(1),
    });

    return interactionRef.id;
  } catch (error) {
    console.error('Error recording view:', error);
    throw error;
  }
}

/**
 * Record a favorite interaction
 */
export async function recordFavorite(
  userId: string,
  auctionId: string,
  itemName: string,
  category: string,
  price: number,
  favorited: boolean = true
): Promise<string> {
  try {
    const interactionRef = doc(collection(db, 'users', userId, 'interactions'));
    const interaction: Omit<FavoriteInteraction, 'id'> = {
      userId,
      type: 'favorite',
      auctionId,
      itemName,
      category,
      price,
      favorited,
      timestamp: serverTimestamp() as Timestamp,
    };

    await setDoc(interactionRef, interaction);

    // Update user stats
    if (favorited) {
      await updateDoc(doc(db, 'users', userId), {
        totalFavorites: increment(1),
      });
    }

    return interactionRef.id;
  } catch (error) {
    console.error('Error recording favorite:', error);
    throw error;
  }
}

/**
 * USER PREFERENCE PROFILE
 */

export interface UserPreferenceProfile {
  userId: string;
  totalInteractions: number;
  totalBids: number;
  totalPurchases: number;
  totalViews: number;
  totalFavorites: number;
  totalSpent: number;
  
  // Category preferences (ranked by frequency)
  topCategories: Array<{
    category: string;
    interactions: number;
    purchases: number;
    avgPrice: number;
    affinity: number; // 0-100 score
  }>;
  
  // Price preferences
  preferredPriceRange: {
    min: number;
    max: number;
    avg: number;
  };
  
  // Bidding behavior
  bidFrequency: number; // bids per 30 days
  winRate: number; // % of bids won
  bidPattern: 'aggressive' | 'moderate' | 'conservative';
  
  // Engagement metrics
  engagementScore: number; // 0-100
  engagementLevel: 'high' | 'medium' | 'low';
  lastActiveAt?: Timestamp;
  
  // Buyer profile
  buyerSegment: 'whale' | 'regular' | 'casual' | 'new';
}

/**
 * Get user's preference profile (aggregate of all interactions)
 */
export async function getUserPreferenceProfile(userId: string): Promise<UserPreferenceProfile> {
  try {
    // Get all interactions
    const interactionsRef = collection(db, 'users', userId, 'interactions');
    const q = query(interactionsRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);

    const interactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp as Timestamp,
    } as UserInteraction));

    // Get user stats
    const userDoc = await getDocs(
      query(collection(db, 'users'), where('uid', '==', userId))
    );
    const userStats = userDoc.docs[0]?.data() || {};

    // Analyze categories
    const categoryStats = new Map<string, { count: number; purchases: number; prices: number[] }>();
    const prices: number[] = [];

    interactions.forEach(interaction => {
      if (!categoryStats.has(interaction.category)) {
        categoryStats.set(interaction.category, { count: 0, purchases: 0, prices: [] });
      }

      const stats = categoryStats.get(interaction.category)!;
      stats.count++;
      if (interaction.type === 'purchase') stats.purchases++;
      stats.prices.push(interaction.price);
      prices.push(interaction.price);
    });

    // Convert to array and sort by frequency
    const topCategories = Array.from(categoryStats.entries())
      .map(([category, stats]) => ({
        category,
        interactions: stats.count,
        purchases: stats.purchases,
        avgPrice: Math.round(stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length),
        affinity: Math.min(100, (stats.count / interactions.length) * 100),
      }))
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 10);

    // Calculate price preferences
    const preferredPriceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      avg: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    };

    // Bidding patterns
    const bidInteractions = interactions.filter(i => i.type === 'bid');
    const purchaseInteractions = interactions.filter(i => i.type === 'purchase');
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bidsLast30 = bidInteractions.filter(
      b => b.timestamp?.toDate?.() > last30Days
    ).length;

    const bidFrequency = bidsLast30;
    const winRate = bidInteractions.length > 0
      ? Math.round((purchaseInteractions.length / bidInteractions.length) * 100)
      : 0;

    // Bid pattern classification
    let bidPattern: 'aggressive' | 'moderate' | 'conservative' = 'moderate';
    if (winRate > 40) bidPattern = 'aggressive';
    else if (winRate < 20) bidPattern = 'conservative';

    // Engagement score
    const totalInteractions = interactions.length;
    const recentActivity = interactions.filter(
      i => i.timestamp?.toDate?.() > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const engagementScore = Math.min(
      100,
      Math.round(
        (recentActivity * 10) + // Recent activity bonus
        (purchaseInteractions.length * 5) + // Purchase bonus
        (bidInteractions.length * 2) // Bid count
      )
    );

    const engagementLevel = engagementScore > 70 ? 'high' : engagementScore > 40 ? 'medium' : 'low';

    // Buyer segment
    let buyerSegment: 'whale' | 'regular' | 'casual' | 'new' = 'new';
    const totalSpent = userStats.totalSpent || 0;
    if (totalSpent > 5000) buyerSegment = 'whale';
    else if (totalSpent > 1000) buyerSegment = 'regular';
    else if (totalSpent > 100) buyerSegment = 'casual';

    const profile: UserPreferenceProfile = {
      userId,
      totalInteractions,
      totalBids: bidInteractions.length,
      totalPurchases: purchaseInteractions.length,
      totalViews: interactions.filter(i => i.type === 'view').length,
      totalFavorites: interactions.filter(i => i.type === 'favorite').length,
      totalSpent,
      topCategories,
      preferredPriceRange,
      bidFrequency,
      winRate,
      bidPattern,
      engagementScore,
      engagementLevel,
      lastActiveAt: interactions[0]?.timestamp,
      buyerSegment,
    };

    return profile;
  } catch (error) {
    console.error('Error getting preference profile:', error);
    return {
      userId,
      totalInteractions: 0,
      totalBids: 0,
      totalPurchases: 0,
      totalViews: 0,
      totalFavorites: 0,
      totalSpent: 0,
      topCategories: [],
      preferredPriceRange: { min: 0, max: 0, avg: 0 },
      bidFrequency: 0,
      winRate: 0,
      bidPattern: 'moderate',
      engagementScore: 0,
      engagementLevel: 'low',
      buyerSegment: 'new',
    };
  }
}

/**
 * Get user's interaction history
 */
export async function getInteractionHistory(
  userId: string,
  interactionType?: 'bid' | 'purchase' | 'view' | 'favorite',
  limitCount: number = 50
): Promise<UserInteraction[]> {
  try {
    const interactionsRef = collection(db, 'users', userId, 'interactions');

    let q = query(
      interactionsRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (interactionType) {
      q = query(
        interactionsRef,
        where('type', '==', interactionType),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp as Timestamp,
    } as UserInteraction));
  } catch (error) {
    console.error('Error getting interaction history:', error);
    return [];
  }
}

/**
 * Get similar users (for collaborative filtering)
 */
export async function findSimilarUsers(userId: string, limit: number = 10): Promise<Array<{
  userId: string;
  similarity: number;
  commonCategories: string[];
}>> {
  try {
    const userProfile = await getUserPreferenceProfile(userId);
    const userTopCategories = userProfile.topCategories.slice(0, 5).map(c => c.category);

    // This is a simplified version - would need more sophisticated matching
    // For production, consider using vector embeddings or a dedicated recommendation service

    return [];
  } catch (error) {
    console.error('Error finding similar users:', error);
    return [];
  }
}

/**
 * ANALYTICS & INSIGHTS
 */

export interface UserAnalyticsInsight {
  userId: string;
  insight: string;
  actionable: boolean;
  recommendedAction?: string;
}

/**
 * Get actionable insights from user behavior
 */
export async function getUserAnalyticsInsights(userId: string): Promise<UserAnalyticsInsight[]> {
  try {
    const profile = await getUserPreferenceProfile(userId);
    const insights: UserAnalyticsInsight[] = [];

    // Insight 1: High engagement users
    if (profile.engagementScore > 70) {
      insights.push({
        userId,
        insight: `Highly engaged user! ${profile.totalBids} bids, ${profile.totalPurchases} purchases.`,
        actionable: true,
        recommendedAction: 'Offer VIP status, early access to featured items',
      });
    }

    // Insight 2: Spending pattern
    if (profile.totalSpent > 5000) {
      insights.push({
        userId,
        insight: 'Whale buyer with $' + profile.totalSpent + ' total spending',
        actionable: true,
        recommendedAction: 'Personalized concierge service, premium recommendations',
      });
    }

    // Insight 3: Win rate
    if (profile.winRate < 20) {
      insights.push({
        userId,
        insight: 'Low win rate (' + profile.winRate + '%). User is outbid frequently.',
        actionable: true,
        recommendedAction: 'Suggest auto-bid feature, alert on price drops',
      });
    }

    // Insight 4: Category expertise
    if (profile.topCategories.length > 0 && profile.topCategories[0].interactions > 10) {
      insights.push({
        userId,
        insight: `Expert in ${profile.topCategories[0].category} category (${profile.topCategories[0].interactions} interactions)`,
        actionable: true,
        recommendedAction: 'Feature rare items from this category, invite to seller partnerships',
      });
    }

    // Insight 5: Price sensitivity
    if (profile.preferredPriceRange.avg < 50) {
      insights.push({
        userId,
        insight: 'Price-conscious buyer (avg $' + profile.preferredPriceRange.avg + ' per item)',
        actionable: true,
        recommendedAction: 'Promote budget items, bundle deals, loyalty discounts',
      });
    }

    return insights;
  } catch (error) {
    console.error('Error getting analytics insights:', error);
    return [];
  }
}
