"use client";

import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import SubscriptionPlanCard from "./SubscriptionPlanCard";
import styles from "./SubscriptionPlans.module.css";

interface SubscriptionPlanGridProps {
  onPlanAction?: (planId: string, action: string) => void;
  layout?: "grid" | "horizontal";
}

export default function SubscriptionPlanGrid({
  onPlanAction,
  layout = "grid",
}: SubscriptionPlanGridProps) {
  return (
    <div className={`${styles.grid} ${styles[layout]}`}>
      {SUBSCRIPTION_PLANS.map((plan) => (
        <SubscriptionPlanCard
          key={plan.id}
          plan={plan}
          onAction={onPlanAction}
        />
      ))}
    </div>
  );
}
