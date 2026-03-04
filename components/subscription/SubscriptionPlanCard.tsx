"use client";

import { SubscriptionPlan } from "@/lib/subscriptionPlans";
import styles from "./SubscriptionPlans.module.css";

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  onAction?: (planId: string, action: string) => void;
}

export default function SubscriptionPlanCard({
  plan,
  onAction,
}: SubscriptionPlanCardProps) {
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
        className={`${styles.cta} ${styles[plan.ctaAction || "default"]}`}
        onClick={handleClick}
        disabled={plan.ctaAction === "current" || plan.ctaAction === "coming-soon"}
      >
        {plan.cta}
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
