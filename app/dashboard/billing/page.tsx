"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { cancelSubscription, reactivateSubscription, getPortalSession, formatPrice } from "../../lib/stripe";
import { useRouter } from "next/navigation";

interface UserSubscription {
  tier: string;
  status: string;
  renewalDate?: Date;
  trialEndDate?: any; // Firestore Timestamp
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancellationDate?: Date;
}

export default function BillingPage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    // Check for checkout success/cancellation from URL
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const success = searchParams.get("success");
      const canceled = searchParams.get("canceled");
      
      if (success) {
        setMessage("✓ Payment successful! Your subscription has been updated. It may take a few moments to process.");
        setMessageType("success");
        // Clean up URL
        window.history.replaceState({}, '', '/dashboard/billing');
      } else if (canceled) {
        setMessage("Payment was canceled. Please try again or contact support if you need help.");
        setMessageType("error");
        // Clean up URL
        window.history.replaceState({}, '', '/dashboard/billing');
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      loadSubscription();
    } else if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const loadSubscription = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      if (userDoc.exists()) {
        const sub = userDoc.data()?.subscription || {};
        setSubscription(sub);
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
      setMessage("Failed to load subscription info");
      setMessageType("error");
    } finally {
      setSubLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure? You'll lose access to paid features at the end of this billing period.")) {
      return;
    }

    try {
      setCancelLoading(true);
      const result = await cancelSubscription();
      setMessage(result.message);
      setMessageType("success");
      await loadSubscription();
    } catch (error: any) {
      setMessage(error.message || "Failed to cancel subscription");
      setMessageType("error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setCancelLoading(true);
      await reactivateSubscription();
      setMessage("Subscription reactivated!");
      setMessageType("success");
      await loadSubscription();
    } catch (error: any) {
      setMessage(error.message || "Failed to reactivate subscription");
      setMessageType("error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const url = await getPortalSession();
      window.location.href = url;
    } catch (error: any) {
      setMessage(error.message || "Failed to open billing portal");
      setMessageType("error");
    }
  };

  if (loading || subLoading) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  const getTierName = (tier: string) => {
    if (tier === "free") return "Free";
    if (tier === "pro") return "Pro";
    if (tier === "premium") return "Premium";
    return tier;
  };

  const statusBadgeColor = {
    active: "#4caf50",
    trialing: "#10b3f0",
    canceled: "#ff9800",
    past_due: "#f44336",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ marginBottom: "2rem" }}>Billing & Subscription</h1>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            backgroundColor: messageType === "success" ? "#d4edda" : "#f8d7da",
            border: `1px solid ${messageType === "success" ? "#c3e6cb" : "#f5c6cb"}`,
            borderRadius: "4px",
            color: messageType === "success" ? "#155724" : "#721c24",
          }}
        >
          {message}
        </div>
      )}

      {/* Current Plan */}
      {subscription && (
        <div
          style={{
            backgroundColor: "#f9f9f9",
            border: "1px solid #eee",
            borderRadius: "8px",
            padding: "2rem",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ marginBottom: "1rem" }}>Current Plan</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <label style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>
                Plan
              </label>
              <p style={{ fontSize: "18px", fontWeight: "bold", margin: "0.5rem 0 0 0" }}>
                {getTierName(subscription.tier)}
              </p>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>
                Status
              </label>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  backgroundColor: statusBadgeColor[subscription.status as keyof typeof statusBadgeColor] || "#999",
                  color: "white",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  marginTop: "0.5rem",
                }}
              >
                {subscription.status}
              </div>
            </div>

            {subscription.renewalDate && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>
                  Renewal Date
                </label>
                <p style={{ fontSize: "16px", fontWeight: "bold", margin: "0.5rem 0 0 0" }}>
                  {new Date(subscription.renewalDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {subscription.status === "trialing" && subscription.trialEndDate && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>
                  Trial Ends
                </label>
                <p style={{ fontSize: "16px", fontWeight: "bold", margin: "0.5rem 0 0 0", color: "#10b3f0" }}>
                  {subscription.trialEndDate?.toDate ? 
                    new Date(subscription.trialEndDate.toDate()).toLocaleDateString() : 
                    new Date(subscription.trialEndDate).toLocaleDateString()}
                </p>
                <p style={{ fontSize: "12px", color: "#666", marginTop: "0.25rem" }}>
                  {(() => {
                    const endDate = subscription.trialEndDate?.toDate 
                      ? new Date(subscription.trialEndDate.toDate()) 
                      : new Date(subscription.trialEndDate);
                    const today = new Date();
                    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return `${daysLeft} days remaining`;
                  })()}
                </p>
              </div>
            )}

            {subscription.cancellationDate && (
              <div>
                <label style={{ fontSize: "12px", color: "#666", textTransform: "uppercase" }}>
                  Cancels On
                </label>
                <p style={{ fontSize: "16px", fontWeight: "bold", margin: "0.5rem 0 0 0", color: "#f44336" }}>
                  {new Date(subscription.cancellationDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {subscription.tier !== "free" && subscription.status === "active" && (
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#ff6b6b",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: cancelLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  opacity: cancelLoading ? 0.6 : 1,
                }}
              >
                {cancelLoading ? "Processing..." : "Cancel Subscription"}
              </button>
            )}

            {subscription.status === "canceled" && (
              <button
                onClick={handleReactivate}
                disabled={cancelLoading}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: cancelLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Reactivate Subscription
              </button>
            )}

            {subscription.tier !== "free" && (
              <button
                onClick={handleOpenPortal}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#10b3f0",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                Manage Payment Methods
              </button>
            )}

            <button
              onClick={() => router.push("/dashboard/pricing")}
              style={{
                padding: "10px 20px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              View All Plans
            </button>
          </div>
        </div>
      )}

      {/* Trial Banner */}
      {subscription && subscription.status === "trialing" && subscription.trialEndDate && (
        <div
          style={{
            backgroundColor: "#e3f2fd",
            border: "2px solid #10b3f0",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "32px" }}>🎉</span>
            <h3 style={{ margin: 0, color: "#10b3f0" }}>You're on a 30-Day Free Trial!</h3>
          </div>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            Enjoying Pro features? Upgrade before your trial ends to keep access to unlimited cards, auctions, and premium features.
          </p>
          <button
            onClick={() => router.push("/dashboard/pricing")}
            style={{
              padding: "10px 24px",
              backgroundColor: "#10b3f0",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Plan Comparison */}
      {subscription && subscription.tier === "free" && (
        <div
          style={{
            backgroundColor: "#f0f9ff",
            border: "2px solid #10b3f0",
            borderRadius: "8px",
            padding: "2rem",
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Ready to upgrade?</h3>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Unlock advanced features with Pro or Premium
          </p>
          <button
            onClick={() => router.push("/dashboard/pricing")}
            style={{
              padding: "12px 32px",
              backgroundColor: "#10b3f0",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            View Plans
          </button>
        </div>
      )}

      {/* Feature Limits */}
      {subscription && (
        <div
          style={{
            backgroundColor: "#fafafa",
            border: "1px solid #eee",
            borderRadius: "8px",
            padding: "2rem",
          }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Your Features</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "4px" }}>
              <label style={{ fontSize: "12px", color: "#666" }}>Card Limit</label>
              <p style={{ fontSize: "18px", fontWeight: "bold", margin: "0.5rem 0" }}>
                {subscription.tier === "free"
                  ? "100"
                  : subscription.tier === "pro"
                  ? "1,000"
                  : "Unlimited"}
              </p>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "4px" }}>
              <label style={{ fontSize: "12px", color: "#666" }}>Auctions</label>
              <p style={{ fontSize: "18px", fontWeight: "bold", margin: "0.5rem 0" }}>
                {subscription.tier === "free" ? "None" : "Unlimited"}
              </p>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "4px" }}>
              <label style={{ fontSize: "12px", color: "#666" }}>Analytics</label>
              <p style={{ fontSize: "18px", fontWeight: "bold", margin: "0.5rem 0" }}>
                {subscription.tier === "free" ? "✗" : "✓"}
              </p>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "4px" }}>
              <label style={{ fontSize: "12px", color: "#666" }}>API Access</label>
              <p style={{ fontSize: "18px", fontWeight: "bold", margin: "0.5rem 0" }}>
                {subscription.tier === "premium" ? "✓" : "✗"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
