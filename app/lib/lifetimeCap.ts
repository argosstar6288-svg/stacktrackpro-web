/**
 * Lifetime Cap Management Module
 * Handles checking and tracking lifetime membership slots
 */

import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { REFERRAL_CONFIG } from "./referral";

/**
 * Interface for lifetime stats
 */
export interface LifetimeStats {
  totalPurchased: number;
  totalCap: number;
  softCap: number;
  slotsAvailable: number;
  isCapped: boolean;
  isNearCap: boolean;
  percentageFilled: number;
}

/**
 * Get current lifetime membership stats
 */
export async function getLifetimeStats(): Promise<LifetimeStats> {
  try {
    const systemDoc = await getDoc(doc(db, "admin", "system"));
    const systemData = systemDoc.data() || {};

    const totalPurchased = systemData.lifetimePurchaseCount || 0;
    const totalCap = REFERRAL_CONFIG.LIFETIME_TOTAL_CAP;
    const softCap = REFERRAL_CONFIG.LIFETIME_SOFT_CAP;
    const slotsAvailable = Math.max(0, totalCap - totalPurchased);
    const isCapped = totalPurchased >= totalCap;
    const isNearCap = totalPurchased >= softCap && totalPurchased < totalCap;
    const percentageFilled = Math.round((totalPurchased / totalCap) * 100);

    return {
      totalPurchased,
      totalCap,
      softCap,
      slotsAvailable,
      isCapped,
      isNearCap,
      percentageFilled,
    };
  } catch (error) {
    console.error("Error fetching lifetime stats:", error);
    // Default safe response
    return {
      totalPurchased: 0,
      totalCap: REFERRAL_CONFIG.LIFETIME_TOTAL_CAP,
      softCap: REFERRAL_CONFIG.LIFETIME_SOFT_CAP,
      slotsAvailable: REFERRAL_CONFIG.LIFETIME_TOTAL_CAP,
      isCapped: false,
      isNearCap: false,
      percentageFilled: 0,
    };
  }
}

/**
 * Check if lifetime slots are available
 * Returns true if NOT capped, false if capped
 */
export async function canPurchaseLifetime(): Promise<boolean> {
  const stats = await getLifetimeStats();
  return !stats.isCapped;
}

/**
 * Increment lifetime purchase count
 * Called by Cloud Function after successful payment
 * Should be atomic/transactional in production
 */
export async function incrementLifetimePurchaseCount(): Promise<void> {
  try {
    const systemDoc = await getDoc(doc(db, "admin", "system"));
    const currentCount = systemDoc.data()?.lifetimePurchaseCount || 0;

    if (currentCount >= REFERRAL_CONFIG.LIFETIME_TOTAL_CAP) {
      throw new Error("Lifetime membership cap reached");
    }

    await updateDoc(doc(db, "admin", "system"), {
      lifetimePurchaseCount: currentCount + 1,
      lastLifetimePurchaseAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error incrementing lifetime count:", error);
    throw error;
  }
}

/**
 * Get percentage of slots filled
 */
export async function getCapPercentage(): Promise<number> {
  const stats = await getLifetimeStats();
  return stats.percentageFilled;
}

/**
 * Format stats for display
 */
export function formatStats(stats: LifetimeStats): string {
  return `${stats.totalPurchased} / ${stats.totalCap} Founding Members`;
}

/**
 * Get status message for display
 */
export async function getStatusMessage(): Promise<string> {
  const stats = await getLifetimeStats();

  if (stats.isCapped) {
    return "❌ Founding Member slots are FULL (50/50)";
  }

  if (stats.isNearCap) {
    const remaining = stats.slotsAvailable;
    return `⚠️ ${remaining} slot${remaining === 1 ? "" : "s"} remaining - ${remaining === 1 ? "Last chance!" : "Limited availability!"}`;
  }

  return `✓ ${stats.slotsAvailable} slots available (${stats.totalPurchased}/${stats.totalCap})`;
}
