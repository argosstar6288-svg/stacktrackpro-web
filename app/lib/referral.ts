/**
 * Referral System Module
 * Handles referral codes, bonuses, and tracking
 */

import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Configuration for referral system
 */
export const REFERRAL_CONFIG = {
  LIFETIME_TOTAL_CAP: 50, // Hard limit
  LIFETIME_SOFT_CAP: 25, // Show "limited slots" warning
  // NOTE: Per-referral bonus is now tiered based on referralStats.completedReferrals
  // Base bonus: $50, increases to $75, $100, $150 at tier milestones
};

/**
 * Generate a unique referral code (8 alphanumeric chars)
 * Format: ABC123XY
 */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get or create a user's referral code
 */
export async function getUserReferralCode(userId: string): Promise<string> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (userDoc.exists() && userDoc.data()?.referralCode) {
      return userDoc.data().referralCode;
    }

    // Generate new code
    const newCode = generateReferralCode();
    
    // Verify uniqueness (rare collision, but check)
    const existingCode = await checkReferralCodeExists(newCode);
    if (existingCode) {
      // Recursive call to generate again if collision
      return getUserReferralCode(userId);
    }

    // Save to user doc
    await updateDoc(doc(db, "users", userId), {
      referralCode: newCode,
      referralCodeCreatedAt: serverTimestamp(),
    });

    return newCode;
  } catch (error) {
    console.error("Error getting referral code:", error);
    throw error;
  }
}

/**
 * Check if a referral code already exists
 */
async function checkReferralCodeExists(code: string): Promise<boolean> {
  try {
    const q = query(collection(db, "users"), where("referralCode", "==", code));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking referral code:", error);
    return false;
  }
}

/**
 * Validate and get info about a referral code
 * Returns null if invalid or referrer is not a founder
 */
export async function validateReferralCode(code: string): Promise<{
  referrerId: string;
  referrerName: string;
  isValid: boolean;
} | null> {
  try {
    const q = query(
      collection(db, "users"),
      where("referralCode", "==", code.toUpperCase())
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null; // Code doesn't exist
    }

    const referrerDoc = snapshot.docs[0];
    const referrerData = referrerDoc.data();

    // Only founders can have valid referral codes
    if (referrerData.role !== "founder") {
      return null; // Referrer is not a founder
    }

    return {
      referrerId: referrerDoc.id,
      referrerName: referrerData.firstName || "Founder",
      isValid: true,
    };
  } catch (error) {
    console.error("Error validating referral code:", error);
    return null;
  }
}

/**
 * Track a referral usage when someone signs up with a code
 */
export async function recordReferralUsage(
  referrerId: string,
  newUserId: string,
  referralCode: string
): Promise<void> {
  try {
    // Add to referrals subcollection
    await addDoc(
      collection(db, "users", referrerId, "referrals"),
      {
        referredUserId: newUserId,
        referralCode: referralCode.toUpperCase(),
        status: "pending", // pending → completed when referred user becomes lifetime
        bonusAwarded: false,
        createdAt: serverTimestamp(),
        completedAt: null,
      }
    );

    // Increment referral count
    const userDoc = await getDoc(doc(db, "users", referrerId));
    const currentCount = userDoc.data()?.referralStats?.totalReferrals || 0;
    
    await updateDoc(doc(db, "users", referrerId), {
      "referralStats.totalReferrals": currentCount + 1,
      "referralStats.lastReferralAt": serverTimestamp(),
    });
  } catch (error) {
    console.error("Error recording referral usage:", error);
    throw error;
  }
}

/**
 * Award referral bonus when referee becomes founder
 * NOTE: This is now handled by Cloud Functions for tiered bonuses
 */
export async function awardReferralBonus(
  referrerId: string,
  referredUserId: string,
  referralCode: string
): Promise<void> {
  try {
    // NOTE: This function is deprecated - Cloud Functions now handles tiered bonuses
    // The bonus amount ($50-$150) is calculated in Cloud Functions based on tier
    console.log(
      "Note: Tiered referral bonuses are now handled by Cloud Functions"
    );
  } catch (error) {
    console.error("Error in awardReferralBonus (deprecated):", error);
  }
}

/**
 * Get referral stats for a founder
 */
export async function getReferralStats(userId: string): Promise<{
  totalReferrals: number;
  completedReferrals: number;
  totalBonusEarned: number;
  storeCredit: number;
  lastReferralAt: Date | null;
}> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    const userData = userDoc.data();

    return {
      totalReferrals: userData?.referralStats?.totalReferrals || 0,
      completedReferrals: userData?.referralStats?.completedReferrals || 0,
      totalBonusEarned: userData?.referralStats?.totalBonusEarned || 0,
      storeCredit: userData?.account?.storeCredit || 0,
      lastReferralAt: userData?.referralStats?.lastReferralAt?.toDate() || null,
    };
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return {
      totalReferrals: 0,
      completedReferrals: 0,
      totalBonusEarned: 0,
      storeCredit: 0,
      lastReferralAt: null,
    };
  }
}

/**
 * Get all referrals for a founder
 */
export async function getFounderReferrals(userId: string) {
  try {
    const q = query(collection(db, "users", userId, "referrals"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return [];
  }
}

/**
 * Format bonus amount for display
 */
export function formatBonusAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
