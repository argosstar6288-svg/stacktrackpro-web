"use client";

import { useState, useEffect } from "react";
import { SUBSCRIPTION_PLANS, getPlanById } from "@/lib/subscriptionPlans";
import SubscriptionPlanGrid from "@/components/subscription/SubscriptionPlanGrid";
import styles from "./subscriptions.module.css";

/**
 * Example: Subscription comparison and management page
 * 
 * This shows how to:
 * - Display pricing grid
 * - Handle plan upgrades
 * - Show current plan
 * - Manage subscriptions
 */

export default function SubscriptionsPage() {
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Load user's current plan from API
    // const response = await fetch("/api/user/subscription");
    // const data = await response.json();
    // setCurrentPlan(data.planId);
  }, []);

  const handlePlanAction = async (planId: string, action: string) => {
    if (action === "upgrade") {
      setIsProcessing(true);
      try {
        // Call your payment API
        // const response = await fetch("/api/checkout", {
        //   method: "POST",
        //   body: JSON.stringify({ planId, currentPlan })
        // });
        // const data = await response.json();
        // redirect to checkout or stripe
        console.log(`Upgrading from ${currentPlan} to ${planId}`);
      } catch (error) {
        console.error("Error upgrading plan:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const plan = getPlanById(currentPlan);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Billing</p>
          <h1 className={styles.title}>Subscription Plans</h1>
        </div>
      </div>

      {currentPlan !== "free" && (
        <div className={styles.currentPlanBanner}>
          <div>
            <h3>Current Plan</h3>
            <p>You are on the <strong>{plan?.name}</strong> plan</p>
          </div>
          <div className={styles.planBadge}>
            {plan?.badge} {plan?.name}
          </div>
        </div>
      )}

      <div className={styles.plansContainer}>
        <SubscriptionPlanGrid 
          onPlanAction={handlePlanAction}
          layout="grid"
        />
      </div>

      <div className={styles.faq}>
        <h2>Frequently Asked Questions</h2>
        
        <div className={styles.faqItem}>
          <h4>Can I change plans anytime?</h4>
          <p>Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately for upgrades.</p>
        </div>

        <div className={styles.faqItem}>
          <h4>Do you offer refunds?</h4>
          <p>We offer a 14-day money-back guarantee on annual plans and prorated refunds on monthly cancellations within 30 days.</p>
        </div>

        <div className={styles.faqItem}>
          <h4>What's included in each plan?</h4>
          <p>See the feature comparison above. Each plan includes everything listed, plus all features from lower plans.</p>
        </div>
      </div>
    </div>
  );
}
