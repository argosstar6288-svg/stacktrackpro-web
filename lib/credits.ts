/**
 * Credit System Core Logic
 * 
 * Handles credit purchases, transactions, and audit trails
 */

import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Credit Pack Options
 * Price and credits offered
 */
export const CREDIT_PACKS = [
  { id: 'pack_10', credits: 10, price: 5.0, name: '10 Credits' },
  { id: 'pack_50', credits: 50, price: 20.0, name: '50 Credits' },
  { id: 'pack_200', credits: 200, price: 60.0, name: '200 Credits' },
] as const;

/**
 * Credit Costs for Features
 */
export const CREDIT_COSTS = {
  PREMIUM_SCAN: 1,
  MARKET_ANALYSIS: 2, // Future
  GRADING_PREDICTION: 3, // Future
} as const;

/**
 * Subscription Credit Allowances (monthly)
 */
export const SUBSCRIPTION_CREDITS = {
  free: 0,
  starter: 0,
  collector: 5,
  pro: 15,
  lifetime: 15,
} as const;

/**
 * Deduct credits for a feature use
 * Always deducts BEFORE running feature to prevent abuse
 * 
 * @param userId - User's UID
 * @param creditCost - Number of credits to deduct
 * @param action - What feature is using credits (e.g., 'premium_scan')
 * @param metadata - Additional data to log (cardId, etc.)
 * @returns { success: boolean; error?: string; remainingCredits?: number }
 */
export async function deductCredits(
  userId: string,
  creditCost: number,
  action: string,
  metadata: Record<string, any> = {}
): Promise<{
  success: boolean;
  error?: string;
  remainingCredits?: number;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, error: 'User not found' };
    }

    const userData = userSnap.data();
    const currentCredits = userData.credits || 0;
    const subscriptionTier = userData.subscriptionTier || 'free';

    // Check if user can use credits (not free tier)
    if (subscriptionTier === 'free') {
      return { success: false, error: 'Upgrade to Collector or Pro to use credits' };
    }

    // Check if user has enough credits
    if (currentCredits < creditCost) {
      return {
        success: false,
        error: `Insufficient credits. You have ${currentCredits}, but need ${creditCost}`,
        remainingCredits: currentCredits,
      };
    }

    // Deduct credits
    const newCredits = currentCredits - creditCost;
    await updateDoc(userRef, { credits: newCredits });

    // Log transaction
    await addDoc(collection(db, 'creditTransactions'), {
      userId,
      action,
      creditsUsed: creditCost,
      creditsBefore: currentCredits,
      creditsAfter: newCredits,
      metadata,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
      remainingCredits: newCredits,
    };
  } catch (error) {
    console.error('Error deducting credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deduct credits',
    };
  }
}

/**
 * Add credits to user account (purchase)
 * 
 * @param userId - User's UID
 * @param creditCount - Number of credits to add
 * @param source - Where credits came from (stripe_purchase, subscription_monthly, etc.)
 * @param metadata - Additional data (packId, stripePaymentId, etc.)
 * @returns { success: boolean; error?: string; newBalance?: number }
 */
export async function addCredits(
  userId: string,
  creditCount: number,
  source: string,
  metadata: Record<string, any> = {}
): Promise<{
  success: boolean;
  error?: string;
  newBalance?: number;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, error: 'User not found' };
    }

    const userData = userSnap.data();
    const currentCredits = userData.credits || 0;
    const newBalance = currentCredits + creditCount;

    // Update user credits
    await updateDoc(userRef, { credits: newBalance });

    // Log transaction
    await addDoc(collection(db, 'creditTransactions'), {
      userId,
      action: 'credit_purchase',
      creditsAdded: creditCount,
      creditsBefore: currentCredits,
      creditsAfter: newBalance,
      source,
      metadata,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
      newBalance,
    };
  } catch (error) {
    console.error('Error adding credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add credits',
    };
  }
}

/**
 * Get user's current credit balance
 * 
 * @param userId - User's UID
 * @returns { credits: number; error?: string }
 */
export async function getUserCredits(userId: string): Promise<{
  credits: number;
  error?: string;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { credits: 0, error: 'User not found' };
    }

    return {
      credits: userSnap.data().credits || 0,
    };
  } catch (error) {
    console.error('Error getting credits:', error);
    return {
      credits: 0,
      error: error instanceof Error ? error.message : 'Failed to get credits',
    };
  }
}

/**
 * Get user's credit transaction history
 * 
 * @param userId - User's UID
 * @param limit - Number of transactions to fetch
 * @returns Array of credit transactions
 */
export async function getCreditTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'creditTransactions'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const transactions: any[] = [];

    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Sort by date descending
    return transactions
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching credit history:', error);
    return [];
  }
}

/**
 * Award monthly credits based on subscription
 * Call this monthly for active users
 * 
 * @param userId - User's UID
 * @param subscriptionTier - User's subscription tier
 * @returns { success: boolean; creditsAwarded: number; error?: string }
 */
export async function awardMonthlyCredits(
  userId: string,
  subscriptionTier: string
): Promise<{
  success: boolean;
  creditsAwarded: number;
  error?: string;
}> {
  try {
    const creditsToAward =
      SUBSCRIPTION_CREDITS[subscriptionTier as keyof typeof SUBSCRIPTION_CREDITS] || 0;

    if (creditsToAward === 0) {
      return {
        success: true,
        creditsAwarded: 0,
      };
    }

    const result = await addCredits(userId, creditsToAward, 'subscription_monthly', {
      tier: subscriptionTier,
      awardedAt: new Date().toISOString(),
    });

    if (!result.success) {
      return {
        success: false,
        creditsAwarded: 0,
        error: result.error,
      };
    }

    return {
      success: true,
      creditsAwarded: creditsToAward,
    };
  } catch (error) {
    console.error('Error awarding monthly credits:', error);
    return {
      success: false,
      creditsAwarded: 0,
      error: error instanceof Error ? error.message : 'Failed to award credits',
    };
  }
}

/**
 * Check if user can afford a feature
 * 
 * @param userId - User's UID
 * @param creditCost - Cost of the feature
 * @returns { canAfford: boolean; currentCredits: number; error?: string }
 */
export async function canAffordFeature(
  userId: string,
  creditCost: number
): Promise<{
  canAfford: boolean;
  currentCredits: number;
  error?: string;
}> {
  try {
    const result = await getUserCredits(userId);

    if (result.error) {
      return {
        canAfford: false,
        currentCredits: 0,
        error: result.error,
      };
    }

    return {
      canAfford: result.credits >= creditCost,
      currentCredits: result.credits,
    };
  } catch (error) {
    console.error('Error checking affordability:', error);
    return {
      canAfford: false,
      currentCredits: 0,
      error: error instanceof Error ? error.message : 'Failed to check credits',
    };
  }
}
