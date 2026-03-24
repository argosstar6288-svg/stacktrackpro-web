type FirestoreLikeDate =
  | Date
  | string
  | number
  | { toDate?: () => Date }
  | null
  | undefined;

interface SubscriptionRecord {
  plan?: string;
  tier?: string;
  status?: string;
  isLifetime?: boolean;
  trialEndDate?: FirestoreLikeDate;
}

interface UserLike {
  subscription?: SubscriptionRecord;
  subscriptionTier?: string;
}

export interface EffectiveSubscription {
  plan: "free" | "starter" | "pro" | "premium" | "lifetime";
  status: string;
  isLifetime: boolean;
  isTrialActive: boolean;
  shouldPersistExpiry: boolean;
}

function toDate(value: FirestoreLikeDate): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function normalizePlan(raw: unknown): EffectiveSubscription["plan"] {
  const value = String(raw || "free").toLowerCase();
  if (value === "lifetime") return "lifetime";
  if (value === "premium" || value === "pro+" || value === "pro-plus") return "premium";
  if (value === "pro") return "pro";
  if (value === "starter") return "starter";
  return "free";
}

export function getEffectiveSubscription(userData: UserLike | undefined, now = new Date()): EffectiveSubscription {
  const subscription = userData?.subscription || {};
  const rawPlan = subscription.plan || subscription.tier || userData?.subscriptionTier || "free";
  const normalizedPlan = normalizePlan(rawPlan);
  const status = String(subscription.status || "inactive").toLowerCase();
  const isLifetime = subscription.isLifetime === true || normalizedPlan === "lifetime";

  if (isLifetime) {
    return {
      plan: "lifetime",
      status: status || "active",
      isLifetime: true,
      isTrialActive: false,
      shouldPersistExpiry: false,
    };
  }

  const trialEndDate = toDate(subscription.trialEndDate);
  const isTrialing = status === "trialing";
  const isTrialActive = Boolean(isTrialing && trialEndDate && trialEndDate.getTime() > now.getTime());

  if (isTrialActive) {
    return {
      plan: "premium",
      status: "trialing",
      isLifetime: false,
      isTrialActive: true,
      shouldPersistExpiry: false,
    };
  }

  const shouldPersistExpiry = Boolean(isTrialing && trialEndDate && trialEndDate.getTime() <= now.getTime());

  return {
    plan: shouldPersistExpiry ? "free" : normalizedPlan,
    status: shouldPersistExpiry ? "expired" : status,
    isLifetime: false,
    isTrialActive: false,
    shouldPersistExpiry,
  };
}
