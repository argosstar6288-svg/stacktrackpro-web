export interface SubscriptionFeature {
  name: string;
  included: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  color: string;
  badge: string;
  price: number;
  period?: string;
  isPopular?: boolean;
  isLimited?: boolean;
  maxSpots?: number;
  features: SubscriptionFeature[];
  cta: string;
  ctaAction?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    color: "green",
    badge: "🟢",
    price: 0,
    features: [
      { name: "Collection tracking", included: true },
      { name: "5 scans/day", included: true },
      { name: "Access to auctions", included: true },
      { name: "Unlimited collections", included: false },
      { name: "Priority support", included: false },
      { name: "Credit packs", included: false },
      { name: "Bulk scanning", included: false },
    ],
    cta: "Current Plan",
    ctaAction: "current",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Best for active buyers and sellers",
    color: "blue",
    badge: "🔵",
    price: 9.99,
    isPopular: true,
    features: [
      { name: "Collection tracking", included: true },
      { name: "Unlimited collections", included: true },
      { name: "50 scans/day", included: true },
      { name: "Priority support", included: true },
      { name: "Future premium features", included: true },
      { name: "Credit packs", included: false },
      { name: "Bulk scanning", included: false },
    ],
    cta: "Upgrade to Pro",
    ctaAction: "upgrade",
  },
  {
    id: "pro-plus",
    name: "Premium",
    description: "Everything in Pro, plus advanced tools",
    color: "purple",
    badge: "💜",
    price: 19.99,
    features: [
      { name: "Unlimited collections", included: true },
      { name: "Unlimited scans/day", included: true },
      { name: "Priority support", included: true },
      { name: "Future premium features", included: true },
      { name: "Credit packs", included: true },
      { name: "Bulk scanning add-on", included: true },
      { name: "Advanced analytics", included: true },
    ],
    cta: "Coming Soon",
    ctaAction: "coming-soon",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    description: "Limited & invitation-based founding status",
    color: "gold",
    badge: "⭐",
    price: 299,
    period: "one-time",
    isLimited: true,
    maxSpots: 50,
    features: [
      { name: "Permanent 'Founding Collector' badge", included: true },
      { name: "Reduced marketplace fees", included: true },
      { name: "Early access to new features & beta tools", included: true },
      { name: "Access to private feedback channels", included: true },
      { name: "StackTrack Pro community recognition", included: true },
      { name: "Free boosted listing", included: true },
      { name: "Featured seller spotlight", included: true },
      { name: "Early auction slots", included: true },
      { name: "Unlimited collections & scans forever", included: true },
      { name: "Earn $50 per referral", included: true },
      { name: "Featured on Founding Wall", included: true },
    ],
    cta: "Get Lifetime Access",
    ctaAction: "upgrade",
  },
];

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}

export function getPopularPlan(): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.isPopular);
}
