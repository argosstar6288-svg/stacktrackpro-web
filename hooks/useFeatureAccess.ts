"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCurrentUser } from "../lib/useCurrentUser";

interface FeatureLimits {
  scansPerMonth: number;
  scansUsed: number;
  scansRemaining: number;
  unlimited: boolean;
  subscriptionPlan: string;
}

export function useFeatureAccess() {
  const { user } = useCurrentUser();
  const [limits, setLimits] = useState<FeatureLimits>({
    scansPerMonth: 5,
    scansUsed: 0,
    scansRemaining: 5,
    unlimited: false,
    subscriptionPlan: "free",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLimits({
        scansPerMonth: 0,
        scansUsed: 0,
        scansRemaining: 0,
        unlimited: false,
        subscriptionPlan: "none",
      });
      setLoading(false);
      return;
    }

    loadFeatureLimits();
  }, [user]);

  const loadFeatureLimits = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user subscription data
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      const subscriptionPlan =
        userData?.subscription?.plan || "free";
      const isLifetime = userData?.subscription?.isLifetime || false;

      // Define limits based on plan
      let scansPerMonth = 5; // Free tier
      let unlimited = false;

      if (isLifetime || subscriptionPlan === "lifetime") {
        unlimited = true;
        scansPerMonth = 999999;
      } else if (subscriptionPlan === "pro") {
        scansPerMonth = 100;
      } else if (subscriptionPlan === "starter") {
        scansPerMonth = 25;
      }

      // Get usage data for current month
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      
      const usageRef = doc(db, "users", user.uid, "usage", monthKey);
      const usageDoc = await getDoc(usageRef);
      const usageData = usageDoc.data();

      const scansUsed = usageData?.scansUsed || 0;
      const scansRemaining = Math.max(0, scansPerMonth - scansUsed);

      setLimits({
        scansPerMonth,
        scansUsed,
        scansRemaining,
        unlimited,
        subscriptionPlan,
      });
    } catch (error) {
      console.error("Error loading feature limits:", error);
    } finally {
      setLoading(false);
    }
  };

  const incrementScanCount = async () => {
    if (!user) return false;

    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      
      const usageRef = doc(db, "users", user.uid, "usage", monthKey);
      const usageDoc = await getDoc(usageRef);

      const currentScans = usageDoc.data()?.scansUsed || 0;

      await setDoc(
        usageRef,
        {
          scansUsed: currentScans + 1,
          lastScanAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update local state
      setLimits((prev) => ({
        ...prev,
        scansUsed: currentScans + 1,
        scansRemaining: Math.max(0, prev.scansPerMonth - (currentScans + 1)),
      }));

      return true;
    } catch (error) {
      console.error("Error incrementing scan count:", error);
      return false;
    }
  };

  const refreshLimits = async () => {
    await loadFeatureLimits();
  };

  return {
    ...limits,
    loading,
    incrementScanCount,
    refreshLimits,
    canScan: limits.unlimited || limits.scansRemaining > 0,
  };
}
