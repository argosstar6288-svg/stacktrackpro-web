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
    name: "Pro+",
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
    description: "Pay once, use forever",
    color: "gold",
    badge: "⭐",
    price: 299,
    period: "one-time",
    features: [
      { name: "Everything in Pro+", included: true },
      { name: "Unlimited collections", included: true },
      { name: "Unlimited scans forever", included: true },
      { name: "Priority support forever", included: true },
      { name: "All future features", included: true },
      { name: "Credit packs included", included: true },
      { name: "Bulk scanning forever", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Lifetime updates", included: true },
      { name: "One-time payment", included: true },
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
