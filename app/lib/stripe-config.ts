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
    credits10: string;
    credits50: string;
    credits200: string;
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
    credits10: process.env.STRIPE_PRICE_10_CREDITS || '',
    credits50: process.env.STRIPE_PRICE_50_CREDITS || '',
    credits200: process.env.STRIPE_PRICE_200_CREDITS || '',
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

  if (!stripeConfig.priceIds.credits10) {
    missing.push('STRIPE_PRICE_10_CREDITS');
  }

  if (!stripeConfig.priceIds.credits50) {
    missing.push('STRIPE_PRICE_50_CREDITS');
  }

  if (!stripeConfig.priceIds.credits200) {
    missing.push('STRIPE_PRICE_200_CREDITS');
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

/**
 * Get price ID for credit packs
 */
export function getCreditPriceId(credits: 10 | 50 | 200): string {
  switch (credits) {
    case 10:
      return stripeConfig.priceIds.credits10;
    case 50:
      return stripeConfig.priceIds.credits50;
    case 200:
      return stripeConfig.priceIds.credits200;
    default:
      return '';
  }
}
