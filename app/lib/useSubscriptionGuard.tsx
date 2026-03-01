"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useCurrentUser } from "./useCurrentUser";

export type SubscriptionTier = "free" | "pro" | "premium";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "incomplete";

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  renewalDate: Date | null;
  cancellationDate?: Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export function useSubscriptionGuard(requiredTier: SubscriptionTier = "free") {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const tierHierarchy: Record<SubscriptionTier, number> = {
    free: 0,
    pro: 1,
    premium: 2,
  };

  useEffect(() => {
    if (!loading && user) {
      const fetchSubscription = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const subData = userDoc.data()?.subscription || {
              tier: "free",
              status: "active",
              renewalDate: null,
            };

            setSubscription(subData);

            // Check if subscription is active and meets tier requirement
            const isActive = subData.status === "active";
            const tierSufficient =
              tierHierarchy[subData.tier] >= tierHierarchy[requiredTier];

            setIsAuthorized(isActive && tierSufficient);
          }
        } catch (error) {
          console.error("Error fetching subscription:", error);
          setIsAuthorized(false);
        } finally {
          setSubLoading(false);
        }
      };

      fetchSubscription();
    } else if (!loading && !user) {
      setSubLoading(false);
      router.push("/login");
    }
  }, [user, loading, requiredTier, router]);

  return {
    subscription,
    isAuthorized,
    loading: loading || subLoading,
  };
}

// HOC for protecting features by subscription tier
export function withSubscriptionGuard(
  Component: React.ComponentType,
  requiredTier: SubscriptionTier = "free"
) {
  return function ProtectedComponent(props: any) {
    const { isAuthorized, loading, subscription } = useSubscriptionGuard(requiredTier);
    const router = useRouter();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!isAuthorized) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h2>Premium Feature</h2>
          <p>
            This feature requires a {requiredTier} subscription.
            Your current plan: <strong>{subscription?.tier}</strong>
          </p>
          <button
            onClick={() => router.push("/dashboard/settings")}
            style={{ marginRight: "10px", padding: "8px 16px", cursor: "pointer" }}
          >
            Upgrade Plan
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Go Back
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
