/**
 * Stripe Configuration Module
 * Centralized Stripe API keys and price IDs
 */

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  priceIds: {
    proMonthly: string;
    proYearly: string;
    premiumMonthly: string;
    premiumYearly: string;
    lifetime: string;
  };
}

export const stripeConfig: StripeConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  priceIds: {
    proMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '',
    proYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || '',
    premiumMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY || '',
    premiumYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY || '',
    lifetime: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME || '',
  },
};

/**
 * Validate that all required Stripe configuration is present
 */
export function validateStripeConfig(): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!stripeConfig.publishableKey) {
    missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  }

  if (!stripeConfig.secretKey) {
    missing.push('STRIPE_SECRET_KEY');
  }

  if (!stripeConfig.priceIds.proMonthly) {
    missing.push('NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY');
  }

  if (!stripeConfig.priceIds.proYearly) {
    missing.push('NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY');
  }

  if (!stripeConfig.priceIds.premiumMonthly) {
    missing.push('NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY');
  }

  if (!stripeConfig.priceIds.premiumYearly) {
    missing.push('NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY');
  }

  if (!stripeConfig.priceIds.lifetime) {
    missing.push('NEXT_PUBLIC_STRIPE_PRICE_LIFETIME');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get price ID for a specific tier and billing period
 */
export function getPriceId(
  tier: 'pro' | 'premium' | 'lifetime',
  billingPeriod: 'monthly' | 'yearly' | 'once'
): string {
  if (tier === 'pro') {
    return billingPeriod === 'monthly'
      ? stripeConfig.priceIds.proMonthly
      : stripeConfig.priceIds.proYearly;
  }

  if (tier === 'premium') {
    return billingPeriod === 'monthly'
      ? stripeConfig.priceIds.premiumMonthly
      : stripeConfig.priceIds.premiumYearly;
  }

  if (tier === 'lifetime') {
    return stripeConfig.priceIds.lifetime;
  }

  return '';
}


