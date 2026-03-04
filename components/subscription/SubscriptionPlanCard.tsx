"use client";

import { useState, useEffect } from "react";
import { SubscriptionPlan } from "@/lib/subscriptionPlans";
import styles from "./SubscriptionPlans.module.css";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  onAction?: (planId: string, action: string) => void;
}

export default function SubscriptionPlanCard({
  plan,
  onAction,
}: SubscriptionPlanCardProps) {
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null);
  const [isSoldOut, setIsSoldOut] = useState(false);

  // Check lifetime plan purchases if this is a limited plan
  useEffect(() => {
    const checkSpots = async () => {
      if (!plan.isLimited || !plan.maxSpots) return;

      try {
        // Query subscriptions collection for lifetime plan purchases
        const q = query(
          collection(db, "subscriptions"),
          where("planId", "==", "lifetime")
        );
        const querySnapshot = await getDocs(q);
        const purchaseCount = querySnapshot.size;
        const remaining = plan.maxSpots - purchaseCount;

        setSpotsRemaining(Math.max(0, remaining));
        setIsSoldOut(remaining <= 0);
      } catch (error) {
        console.error("Error checking lifetime plan spots:", error);
        // If we can't check, assume spots are available
        setSpotsRemaining(plan.maxSpots);
      }
    };

    checkSpots();
  }, [plan.isLimited, plan.maxSpots]);
  const handleClick = () => {
    if (onAction && plan.ctaAction) {
      onAction(plan.id, plan.ctaAction);
    }
  };

  return (
    <div
      className={`${styles.card} ${plan.isPopular ? styles.popular : ""} ${
        plan.id === "lifetime" ? styles.lifetime : ""
      }`}
      style={{
        borderColor: 
          plan.id === "lifetime" 
            ? "#FFD700" 
            : plan.isPopular 
            ? "#10b3f0" 
            : "#2a2a2a",
      }}
    >
      {plan.isPopular && <div className={styles.popularBadge}>POPULAR</div>}

      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.badge}>{plan.badge}</span>
          <h3 className={styles.title}>{plan.name}</h3>
        </div>
        {plan.description && (
          <p className={styles.description}>{plan.description}</p>
        )}
        {plan.isLimited && spotsRemaining !== null && (
          <p className={`${styles.limitedInfo} ${isSoldOut ? styles.soldOut : ""}`}>
            {isSoldOut 
              ? "⚠️ Sold Out - All 50 spots claimed!" 
              : `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} left`}
          </p>
        )}
      </div>

      <div className={styles.pricing}>
        {plan.price === 0 ? (
          <div className={styles.price}>Free</div>
        ) : (
          <>
            <span className={styles.currency}>$</span>
            <span className={styles.amount}>{plan.price.toFixed(2)}</span>
            <span className={styles.period}>
              {plan.period === "one-time" ? " one-time" : "/month"}
            </span>
          </>
        )}
      </div>

      <button
        className={`${styles.cta} ${styles[plan.ctaAction || "default"]} ${isSoldOut ? styles.soldOut : ""}`}
        onClick={handleClick}
        disabled={plan.ctaAction === "current" || plan.ctaAction === "coming-soon" || isSoldOut}
      >
        {isSoldOut ? "Sold Out" : plan.cta}
      </button>

      <div className={styles.features}>
        {plan.features.map((feature) => (
          <div
            key={feature.name}
            className={`${styles.feature} ${
              feature.included ? styles.included : styles.excluded
            }`}
          >
            <span className={styles.featureIcon}>
              {feature.included ? "✓" : "✕"}
            </span>
            <span className={styles.featureName}>{feature.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
