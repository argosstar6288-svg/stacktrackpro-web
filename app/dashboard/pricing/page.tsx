"use client";

import SubscriptionPlanGrid from "@/app/components/subscription/SubscriptionPlanGrid";
import styles from "./pricing.module.css";

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Choose Your StackTrack Plan</h1>
        <p className={styles.subtitle}>
          Start free and scale up with Pro or Pro+/Premium as your collection grows.
        </p>
      </div>

      <div className={styles.disclosure}>
        <p className={styles.disclosureText}>
          Why keep paying every month for something you can own forever?{' '}
          <strong>Lifetime Subscription is $299.99 one-time.</strong>
        </p>
        <p className={styles.disclosureText}>
          ⭐ <strong>Signup Bonus:</strong> Your first 30 days from signup include Premium features.
        </p>
      </div>

      <div className={styles.container}>
        <SubscriptionPlanGrid layout="grid" />
      </div>

      <div className={styles.footer}>
        <p>
          All plans include access to our community and marketplace.
          Want to learn more?{" "}
          <a href="/dashboard/help">Check our FAQ</a>
          {" "}or{" "}
          <a href="/dashboard/help/how-values-work">see how StackTrack values cards</a>
        </p>
      </div>
    </div>
  );
}
