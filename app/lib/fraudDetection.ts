/**
 * Fraud Detection Layer
 * Comprehensive fraud prevention system for marketplace
 *
 * Features:
 * - User risk scoring
 * - Transaction pattern analysis
 * - Account verification
 * - Suspicious activity detection
 * - Automated response actions
 */

import { db } from "./firebase";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp, addDoc } from "firebase/firestore";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum FraudIndicator {
  VELOCITY_ABUSE = "velocity_abuse", // Too many transactions in short time
  UNUSUAL_AMOUNT = "unusual_amount", // Abnormal bid/purchase amounts
  CHARGEBACK_HISTORY = "chargeback_history", // Previous chargebacks
  NEW_ACCOUNT = "new_account", // Fresh accounts are riskier
  LOCATION_MISMATCH = "location_mismatch", // Shipping address differs from IP
  EMAIL_MISMATCH = "email_mismatch", // Multiple accounts same email domain
  PAYMENT_MISMATCH = "payment_mismatch", // Multiple payment methods unusual patterns
  SELLER_COLLUSION = "seller_collusion", // Bidding on own items
  SHILL_BIDDING = "shill_bidding", // Coordinated bidding patterns
  ACCOUNT_TAKEOVER = "account_takeover", // Unusual login patterns
  BID_MANIPULATION = "bid_manipulation", // Suspicious bid increments/amounts
  REFUND_ABUSE = "refund_abuse", // Excessive refund requests
}

export interface FraudRiskProfile {
  userId: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  indicators: FraudIndicator[];
  lastUpdated: Date;
  accountAge: number; // days
  totalTransactions: number;
  totalSpent: number;
  chargebackCount: number;
  refundCount: number;
  suspiciousActivityCount: number;
  isVerified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  ipAddresses: string[];
  paymentMethods: string[];
  shippingAddresses: string[];
  lastActivity: Date | null;
  accountStatus: "active" | "suspended" | "blocked";
  notes: string[];
}

export interface TransactionAnalysis {
  transactionId: string;
  userId: string;
  analysis: {
    riskScore: number;
    isDuspicious: boolean;
    indicators: FraudIndicator[];
    metadata: Record<string, unknown>;
  };
  timestamp: Date;
}

export interface UserBehaviorPattern {
  userId: string;
  avgBidAmount: number;
  bidFrequency: number; // bids per day
  avgResponseTime: number; // ms to place bid after auction starts
  favoriteCategories: string[];
  repeatSellers: string[];
  bidWinRate: number; // percentage
  successfulPurchases: number;
  failedTransactions: number;
}

// ============================================================================
// 1. USER RISK SCORING
// ============================================================================

/**
 * Calculate comprehensive risk score for user
 * Returns score 0-100 with risk level assessment
 */
export async function calculateUserRiskScore(userId: string): Promise<FraudRiskProfile> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    const indicators: FraudIndicator[] = [];
    let riskScore = 20; // Base score

    // 1. Account Age (newer = riskier)
    const accountCreatedAt = userData.createdAt?.toDate?.() || new Date();
    const accountAgeInDays = Math.floor(
      (new Date().getTime() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (accountAgeInDays < 7) {
      riskScore += 20;
      indicators.push(FraudIndicator.NEW_ACCOUNT);
    } else if (accountAgeInDays < 30) {
      riskScore += 10;
    }

    // 2. Verification Status
    if (!userData.emailVerified) {
      riskScore += 15;
      indicators.push(FraudIndicator.EMAIL_MISMATCH);
    }
    if (!userData.phoneVerified) {
      riskScore += 10;
    }

    // 3. Transaction History
    const riskFromTransactions = await analyzeTransactionHistory(userId);
    riskScore += riskFromTransactions.score;
    indicators.push(...riskFromTransactions.indicators);

    // 4. Behavioral Analysis
    const behavioralRisk = await analyzeBehaviorPatterns(userId);
    riskScore += behavioralRisk.score;
    indicators.push(...behavioralRisk.indicators);

    // 5. Payment Methods Consistency
    const paymentMethodsRef = collection(db, `users/${userId}/paymentMethods`);
    const paymentMethodsSnap = await getDocs(paymentMethodsRef);

    if (paymentMethodsSnap.size > 5) {
      riskScore += 10;
      indicators.push(FraudIndicator.PAYMENT_MISMATCH);
    }

    // 6. Shipping Address Consistency
    const shippingCheck = await checkShippingAddressConsistency(userId);
    riskScore += shippingCheck.score;
    if (shippingCheck.hasMismatch) {
      indicators.push(FraudIndicator.LOCATION_MISMATCH);
    }

    // 7. Chargeback History
    const chargebacks = userData.chargebackCount || 0;
    if (chargebacks > 0) {
      riskScore += Math.min(25, chargebacks * 10);
      indicators.push(FraudIndicator.CHARGEBACK_HISTORY);
    }

    // 8. Refund Abuse Pattern
    const refunds = userData.refundCount || 0;
    if (refunds > 5) {
      riskScore += Math.min(20, refunds * 3);
      indicators.push(FraudIndicator.REFUND_ABUSE);
    }

    // Cap score at 100
    riskScore = Math.min(100, riskScore);

    // Determine risk level
    const riskLevel =
      riskScore >= 80
        ? RiskLevel.CRITICAL
        : riskScore >= 60
        ? RiskLevel.HIGH
        : riskScore >= 40
        ? RiskLevel.MEDIUM
        : RiskLevel.LOW;

    // Deduplicate indicators
    const uniqueIndicators = Array.from(new Set(indicators));

    const profile: FraudRiskProfile = {
      userId,
      riskLevel,
      riskScore: Math.round(riskScore),
      indicators: uniqueIndicators,
      lastUpdated: new Date(),
      accountAge: accountAgeInDays,
      totalTransactions: userData.totalTransactions || 0,
      totalSpent: userData.totalSpent || 0,
      chargebackCount: chargebacks,
      refundCount: refunds,
      suspiciousActivityCount: userData.suspiciousActivityCount || 0,
      isVerified: userData.isVerified || false,
      emailVerified: userData.emailVerified || false,
      phoneVerified: userData.phoneVerified || false,
      ipAddresses: userData.ipAddresses || [],
      paymentMethods: paymentMethodsSnap.docs.map((d) => d.id),
      shippingAddresses: userData.shippingAddresses || [],
      lastActivity: userData.lastLogin?.toDate?.() || null,
      accountStatus: userData.accountStatus || "active",
      notes: userData.fraudNotes || [],
    };

    // Save profile for future reference
    const profileRef = doc(db, `users/${userId}/fraudProfile`, "current");
    await setDoc(profileRef, {
      ...profile,
      lastUpdated: serverTimestamp(),
    });

    return profile;
  } catch (error) {
    console.error("Error calculating user risk score:", error);
    throw error;
  }
}

// ============================================================================
// 2. TRANSACTION PATTERN ANALYSIS
// ============================================================================

/**
 * Analyze historical transactions for suspicious patterns
 */
async function analyzeTransactionHistory(
  userId: string
): Promise<{ score: number; indicators: FraudIndicator[] }> {
  let score = 0;
  const indicators: FraudIndicator[] = [];

  try {
    // Get recent transactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const interactionsRef = collection(db, `users/${userId}/interactions`);
    const recentQuery = query(
      interactionsRef,
      where("timestamp", ">=", thirtyDaysAgo)
    );
    const recentSnap = await getDocs(recentQuery);

    const transactions = recentSnap.docs.map((d) => d.data());

    // Velocity check: more than 20 transactions in 24 hours
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    const last24hCount = transactions.filter(
      (t) => t.timestamp?.toDate?.() > last24h
    ).length;

    if (last24hCount > 20) {
      score += 20;
      indicators.push(FraudIndicator.VELOCITY_ABUSE);
    } else if (last24hCount > 10) {
      score += 10;
    }

    // Amount anomaly check
    if (transactions.length > 0) {
      const amounts = transactions
        .filter((t) => t.amount)
        .map((t) => t.amount);

      if (amounts.length > 0) {
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(
          amounts.reduce((sum, x) => sum + Math.pow(x - avgAmount, 2), 0) /
          amounts.length
        );

        // Check for outliers (>3 std devs)
        const outliers = amounts.filter(
          (a) => Math.abs(a - avgAmount) > 3 * stdDev
        );
        if (outliers.length > 0) {
          score += 15;
          indicators.push(FraudIndicator.UNUSUAL_AMOUNT);
        }
      }
    }

    return { score, indicators };
  } catch (error) {
    console.error("Error analyzing transaction history:", error);
    return { score: 0, indicators: [] };
  }
}

/**
 * Analyze user behavior patterns for anomalies
 */
async function analyzeBehaviorPatterns(
  userId: string
): Promise<{ score: number; indicators: FraudIndicator[] }> {
  let score = 0;
  const indicators: FraudIndicator[] = [];

  try {
    const pattern = await getUserBehaviorPattern(userId);

    // Check for unusual response time (instant bids on auctions)
    if (pattern.avgResponseTime < 500) {
      // Less than 500ms
      score += 15;
      indicators.push(FraudIndicator.BID_MANIPULATION);
    }

    // Check for shill bidding patterns (bidding without winning, high frequency)
    if (pattern.bidWinRate < 5 && pattern.bidFrequency > 5) {
      score += 20;
      indicators.push(FraudIndicator.SHILL_BIDDING);
    }

    // Excessive failed transactions
    if (pattern.failedTransactions > 3) {
      score += 10;
      indicators.push(FraudIndicator.ACCOUNT_TAKEOVER);
    }

    return { score, indicators };
  } catch (error) {
    console.error("Error analyzing behavior patterns:", error);
    return { score: 0, indicators: [] };
  }
}

/**
 * Get user's historical behavior pattern
 */
async function getUserBehaviorPattern(
  userId: string
): Promise<UserBehaviorPattern> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const interactionsRef = collection(db, `users/${userId}/interactions`);
  const queryRef = query(
    interactionsRef,
    where("timestamp", ">=", thirtyDaysAgo)
  );
  const snapshot = await getDocs(queryRef);

  const interactions = snapshot.docs.map((d) => d.data());
  const bids = interactions.filter((i) => i.type === "bid");
  const purchases = interactions.filter((i) => i.type === "purchase");

  const bidAmounts = bids.map((b) => b.amount || 0);
  const avgBidAmount =
    bidAmounts.length > 0
      ? bidAmounts.reduce((a, b) => a + b, 0) / bidAmounts.length
      : 0;

  const daysActive = 30;
  const bidFrequency = bids.length / daysActive;

  return {
    userId,
    avgBidAmount: Math.round(avgBidAmount),
    bidFrequency: Number(bidFrequency.toFixed(2)),
    avgResponseTime: calculateAvgResponseTime(bids),
    favoriteCategories: extractTopCategories(bids),
    repeatSellers: extractRepeatSellers(purchases),
    bidWinRate: calculateWinRate(bids),
    successfulPurchases: purchases.length,
    failedTransactions: interactions.filter((i) => i.failed).length,
  };
}

function calculateAvgResponseTime(bids: any[]): number {
  if (bids.length === 0) return 0;
  const responseTimes = bids
    .filter((b) => b.responseTimeMs)
    .map((b) => b.responseTimeMs);
  return responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;
}

function extractTopCategories(bids: any[]): string[] {
  const categories = new Map<string, number>();
  bids.forEach((b) => {
    const cat = b.category;
    if (cat) {
      categories.set(cat, (categories.get(cat) || 0) + 1);
    }
  });
  return Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);
}

function extractRepeatSellers(purchases: any[]): string[] {
  const sellers = new Map<string, number>();
  purchases.forEach((p) => {
    const seller = p.seller;
    if (seller) {
      sellers.set(seller, (sellers.get(seller) || 0) + 1);
    }
  });
  return Array.from(sellers.entries())
    .filter((e) => e[1] > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);
}

function calculateWinRate(bids: any[]): number {
  if (bids.length === 0) return 0;
  const wins = bids.filter((b) => b.won).length;
  return Number(((wins / bids.length) * 100).toFixed(2));
}

// ============================================================================
// 3. SUSPICIOUS ACTIVITY DETECTION
// ============================================================================

/**
 * Real-time transaction fraud check
 */
export async function checkTransactionForFraud(
  userId: string,
  transactionData: {
    amount: number;
    sellerId?: string;
    auctionId: string;
    ipAddress?: string;
    deviceId?: string;
  }
): Promise<TransactionAnalysis> {
  const userRiskProfile = await calculateUserRiskScore(userId);
  let fraudScore = userRiskProfile.riskScore * 0.3; // Base on user risk
  const indicators: FraudIndicator[] = [];

  // Check amount against user history
  const pattern = await getUserBehaviorPattern(userId);
  const amountDeviation = Math.abs(
    transactionData.amount - pattern.avgBidAmount
  );
  const maxDeviation = pattern.avgBidAmount * 2;

  if (amountDeviation > maxDeviation && pattern.avgBidAmount > 0) {
    fraudScore += 15;
    indicators.push(FraudIndicator.UNUSUAL_AMOUNT);
  }

  // Check for seller collusion (user bidding on own items is caught in transaction)
  if (transactionData.sellerId === userId) {
    fraudScore += 40;
    indicators.push(FraudIndicator.SELLER_COLLUSION);
  }

  // Check IP/device consistency
  const ipCheck = await checkIPConsistency(userId, transactionData.ipAddress);
  if (!ipCheck.isConsistent) {
    fraudScore += 10;
    indicators.push(FraudIndicator.LOCATION_MISMATCH);
  }

  fraudScore = Math.min(100, fraudScore);

  const analysis: TransactionAnalysis = {
    transactionId: `${userId}-${transactionData.auctionId}-${Date.now()}`,
    userId,
    analysis: {
      riskScore: Math.round(fraudScore),
      isDuspicious: fraudScore > 50,
      indicators: Array.from(new Set(indicators)),
      metadata: {
        userBaseRisk: userRiskProfile.riskScore,
        amountDeviation: Number(amountDeviation.toFixed(2)),
        ipConsistent: ipCheck.isConsistent,
      },
    },
    timestamp: new Date(),
  };

  // Log suspicious transactions
  if (analysis.analysis.isDuspicious) {
    const auditRef = collection(db, "fraudAudit");
    await addDoc(auditRef, {
      ...analysis,
      timestamp: serverTimestamp(),
      status: "pending",
    });
  }

  return analysis;
}

/**
 * Check if IP address is consistent with user history
 */
async function checkIPConsistency(
  userId: string,
  ipAddress?: string
): Promise<{ isConsistent: boolean; previousIPs: string[] }> {
  if (!ipAddress) return { isConsistent: true, previousIPs: [] };

  try {
    const profileRef = doc(db, `users/${userId}/fraudProfile`, "current");
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      return { isConsistent: true, previousIPs: [] };
    }

    const profile = profileSnap.data() as FraudRiskProfile;
    const previousIPs = profile.ipAddresses || [];

    const isConsistent = previousIPs.includes(ipAddress) || previousIPs.length === 0;

    return { isConsistent, previousIPs };
  } catch (error) {
    console.error("Error checking IP consistency:", error);
    return { isConsistent: true, previousIPs: [] };
  }
}

/**
 * Check for shipping address mismatches
 */
async function checkShippingAddressConsistency(
  userId: string
): Promise<{ score: number; hasMismatch: boolean }> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return { score: 0, hasMismatch: false };

    const userData = userDoc.data();
    const addresses = userData.shippingAddresses || [];

    if (addresses.length > 3) {
      return { score: 10, hasMismatch: true };
    }

    return { score: 0, hasMismatch: false };
  } catch (error) {
    console.error("Error checking address consistency:", error);
    return { score: 0, hasMismatch: false };
  }
}

// ============================================================================
// 4. AUTOMATED RESPONSE ACTIONS
// ============================================================================

export enum FraudAction {
  NONE = "none",
  WARNING = "warning",
  REVIEW = "review",
  HOLD = "hold",
  BLOCK = "block",
}

/**
 * Get recommended action based on risk profile
 */
export function getRecommendedAction(profile: FraudRiskProfile): FraudAction {
  switch (profile.riskLevel) {
    case RiskLevel.CRITICAL:
      return FraudAction.BLOCK;
    case RiskLevel.HIGH:
      return FraudAction.HOLD;
    case RiskLevel.MEDIUM:
      return FraudAction.REVIEW;
    case RiskLevel.LOW:
    default:
      return profile.indicators.length > 2 ? FraudAction.WARNING : FraudAction.NONE;
  }
}

/**
 * Execute fraud response action
 */
export async function executeFraudAction(
  userId: string,
  action: FraudAction,
  reason: string
): Promise<boolean> {
  try {
    const userRef = doc(db, "users", userId);

    switch (action) {
      case FraudAction.WARNING:
        // Send warning notification
        await addDoc(collection(db, "notifications"), {
          userId,
          type: "fraud_warning",
          title: "Account Security Alert",
          message: `We detected unusual activity on your account. ${reason}`,
          severity: "medium",
          timestamp: serverTimestamp(),
          read: false,
        });
        break;

      case FraudAction.REVIEW:
        // Flag for manual review
        await updateDoc(userRef, {
          accountStatus: "under_review",
          fraudNotes: [...(await getDoc(userRef)).data()?.fraudNotes || [], reason],
          reviewedAt: serverTimestamp(),
        });
        break;

      case FraudAction.HOLD:
        // Hold account pending verification
        await updateDoc(userRef, {
          accountStatus: "suspended",
          suspensionReason: reason,
          suspendedAt: serverTimestamp(),
        });

        // Require re-verification
        await addDoc(collection(db, "verificationRequests"), {
          userId,
          type: "account_security",
          reason,
          createdAt: serverTimestamp(),
          status: "pending",
        });
        break;

      case FraudAction.BLOCK:
        // Block account
        await updateDoc(userRef, {
          accountStatus: "blocked",
          blockReason: reason,
          blockedAt: serverTimestamp(),
        });

        // Notify abuse team
        await addDoc(collection(db, "abuseReports"), {
          userId,
          type: "fraud_block",
          reason,
          severity: "critical",
          timestamp: serverTimestamp(),
          status: "pending_review",
        });
        break;

      case FraudAction.NONE:
      default:
        break;
    }

    return true;
  } catch (error) {
    console.error("Error executing fraud action:", error);
    return false;
  }
}

// ============================================================================
// 5. MONITORING & ANALYTICS
// ============================================================================

/**
 * Get fraud detection metrics
 */
export async function getFraudMetrics(): Promise<{
  totalUsers: number;
  riskDistribution: Record<RiskLevel, number>;
  topIndicators: Array<{ indicator: FraudIndicator; count: number }>;
  blockedAccounts: number;
  suspendedAccounts: number;
  flaggedTransactions: number;
}> {
  try {
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);

    const riskDistribution: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const indicatorCount = new Map<FraudIndicator, number>();
    let blockedCount = 0;
    let suspendedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();

      if (userData.accountStatus === "blocked") {
        blockedCount++;
      } else if (userData.accountStatus === "suspended") {
        suspendedCount++;
      }

      try {
        const profileRef = doc(db, `users/${userDoc.id}/fraudProfile`, "current");
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const profile = profileSnap.data() as FraudRiskProfile;
          riskDistribution[profile.riskLevel]++;

          profile.indicators.forEach((ind) => {
            indicatorCount.set(ind, (indicatorCount.get(ind) || 0) + 1);
          });
        }
      } catch {
        // Skip if profile doesn't exist
      }
    }

    const topIndicators = Array.from(indicatorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([indicator, count]) => ({ indicator, count }));

    // Get flagged transactions from audit
    const auditRef = collection(db, "fraudAudit");
    const auditSnap = await getDocs(query(auditRef, where("status", "==", "pending")));

    return {
      totalUsers: usersSnap.size,
      riskDistribution,
      topIndicators,
      blockedAccounts: blockedCount,
      suspendedAccounts: suspendedCount,
      flaggedTransactions: auditSnap.size,
    };
  } catch (error) {
    console.error("Error getting fraud metrics:", error);
    return {
      totalUsers: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      topIndicators: [],
      blockedAccounts: 0,
      suspendedAccounts: 0,
      flaggedTransactions: 0,
    };
  }
}
