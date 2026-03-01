import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * Stripe Integration Module
 * Handles all checkout and billing operations
 */

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year" | "once";
  stripePrice: string;
  features: string[];
  popular?: boolean;
  lifetime?: boolean;
}

export const PRICING_TIERS: Record<string, PricingTier> = {
  LIFETIME: {
    id: "lifetime",
    name: "Founding Member",
    price: 29999,
    currency: "usd",
    interval: "once",
    stripePrice: "price_1QvF5wABC123456789AB", // Replace with actual Stripe one-time price
    lifetime: true,
    features: [
      "Unlimited cards forever",
      "Unlimited auctions forever",
      "Advanced analytics & export",
      "REST API access",
      "Bulk operations",
      "Lifetime priority support",
      "Ad-free experience",
      "Early access to new features",
      "Exclusive Founding Member badge",
    ],
    popular: true,
  },
  PRO_MONTHLY: {
    id: "pro_monthly",
    name: "Pro",
    price: 999,
    currency: "usd",
    interval: "month",
    stripePrice: "price_1Pu0a1ABC123456789AB", // Replace with actual Stripe price ID
    features: [
      "1,000 card portfolio",
      "Create unlimited auctions",
      "Advanced portfolio analytics",
      "Card categorization (folders)",
      "Ad-free experience",
      "Priority support",
    ],
  },
  PRO_YEARLY: {
    id: "pro_yearly",
    name: "Pro Yearly",
    price: 9999,
    currency: "usd",
    interval: "year",
    stripePrice: "price_1Pu0a2ABC123456789AB",
    features: [
      "Everything in Pro",
      "Save 17% with annual billing",
    ],
  },
  PREMIUM_MONTHLY: {
    id: "premium_monthly",
    name: "Premium",
    price: 2999,
    currency: "usd",
    interval: "month",
    stripePrice: "price_1Pu0a3ABC123456789AB",
    features: [
      "Unlimited cards",
      "Unlimited auctions",
      "Advanced analytics & export",
      "REST API access",
      "Bulk operations",
      "Priority support",
      "Ad-free experience",
    ],
    popular: false,
  },
  PREMIUM_YEARLY: {
    id: "premium_yearly",
    name: "Premium Yearly",
    price: 29999,
    currency: "usd",
    interval: "year",
    stripePrice: "price_1Pu0a4ABC123456789AB",
    features: [
      "Everything in Premium",
      "Save 17% with annual billing",
    ],
  },
};

/**
 * Create Stripe checkout session
 * Redirects user to Stripe checkout
 * Supports both subscription and one-time payment modes
 * Optionally includes referral code for lifetime purchases
 */
export async function createCheckoutSession(priceId: string, referralCode?: string): Promise<void> {
  try {
    // Check if this is a lifetime plan
    const isLifetime = priceId === PRICING_TIERS.LIFETIME.stripePrice;
    
    const createCheckout = httpsCallable(functions, "createCheckoutSession");
    const response = await createCheckout({ 
      priceId,
      mode: isLifetime ? "payment" : "subscription",
      referralCode: referralCode || null,
    });

    const { sessionUrl } = response.data as { sessionUrl: string; sessionId: string };

    if (sessionUrl) {
      // Redirect to Stripe checkout
      window.location.href = sessionUrl;
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw new Error("Failed to start checkout. Please try again.");
  }
}

/**
 * Cancel subscription
 * Subscription will end at period end (not immediately)
 */
export async function cancelSubscription(): Promise<{ message: string }> {
  try {
    const cancelSubscription = httpsCallable(functions, "cancelSubscription");
    const response = await cancelSubscription({});
    return response.data as { message: string };
  } catch (error) {
    console.error("Error canceling subscription:", error);
    throw new Error("Failed to cancel subscription. Please try again.");
  }
}

/**
 * Reactivate subscription
 * Reactivates a subscription that was scheduled for cancellation
 */
export async function reactivateSubscription(): Promise<{ success: boolean }> {
  try {
    const reactivate = httpsCallable(functions, "reactivateSubscription");
    const response = await reactivate({});
    return response.data as { success: boolean };
  } catch (error) {
    console.error("Error reactivating subscription:", error);
    throw new Error("Failed to reactivate subscription. Please try again.");
  }
}

/**
 * Get Stripe billing portal session
 * Allows user to manage subscription, payment methods, etc.
 */
export async function getPortalSession(): Promise<string> {
  try {
    const getPortal = httpsCallable(functions, "getPortalSession");
    const response = await getPortal({});
    return (response.data as { url: string }).url;
  } catch (error) {
    console.error("Error getting portal session:", error);
    throw new Error("Failed to open billing portal. Please try again.");
  }
}

/**
 * Format price for display
 */
export function formatPrice(priceInCents: number, currency: string = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(priceInCents / 100);
}

/**
 * Get annual savings for yearly tier
 */
export function getAnnualSavings(monthlyPrice: number, yearlyPrice: number): number {
  const annualMonthlyPrice = monthlyPrice * 12;
  return Math.round(((annualMonthlyPrice - yearlyPrice) / annualMonthlyPrice) * 100);
}
