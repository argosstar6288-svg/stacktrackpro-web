"use client";

import { useEffect } from "react";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { useRouter } from "next/navigation";
import SubscriptionPlanGrid from "@/components/subscription/SubscriptionPlanGrid";
import styles from "./pricing.module.css";

export default function PricingPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handlePlanAction = (planId: string, action: string) => {
    if (action === "upgrade") {
      // TODO: Integrate with payment processing (Stripe)
      console.log(`Upgrading to plan: ${planId}`);
      router.push(`/dashboard/billing?plan=${planId}`);
    } else if (action === "coming-soon") {
      // Show notification
      alert("Pro+ plan coming soon!");
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Simple, Transparent Pricing</h1>
        <p className={styles.subtitle}>
          Choose the plan that fits your card trading needs
        </p>
      </div>

      <div className={styles.disclosure}>
        <p className={styles.disclosureText}>
          ⭐ <strong>Limited Time Offer:</strong> The Lifetime plan is available to only the first 50 customers. 
          Lock in permanent access at <strong>$299 one-time</strong> before spots run out.
        </p>
      </div>

      <div className={styles.container}>
        <SubscriptionPlanGrid onPlanAction={handlePlanAction} layout="grid" />
      </div>

      <div className={styles.footer}>
        <p>
          All plans include access to our community and marketplace. 
          Want to learn more?{" "}
          <a href="/dashboard/help">Check our FAQ</a>
        </p>
      </div>
    </div>
  );
}
