/**
 * StackTrackPro Platform Fee Calculations (Hybrid Model)
 * 
 * Fee structure varies by subscription tier:
 * - Free users: 5% Final Value Fee
 * - Pro subscribers: 2% Final Value Fee
 * 
 * All fees documented in PLATFORM_FEES.md
 */

/**
 * Platform fees vary by subscription tier
 */
export const PLATFORM_FEES = {
  free: 0.05,      // 5% for free users
  starter: 0.03,   // 3% for starter tier (future)
  pro: 0.02,       // 2% for pro subscribers
};

/**
 * Stripe payment processing fee (Canada)
 * Applied per transaction
 */
export const STRIPE_PROCESSING_PERCENTAGE = 0.029; // 2.9%
export const STRIPE_PROCESSING_FIXED = 0.30; // $0.30 CAD

/**
 * Subscription tiers and their fee rates
 */
export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'lifetime';

export const SUBSCRIPTION_FEE_RATES: Record<SubscriptionTier, number> = {
  free: 0.05,      // 5%
  starter: 0.03,   // 3% (future tier)
  pro: 0.02,       // 2%
  lifetime: 0.02,  // 2% (pro equivalent)
};

/**
 * Payout release hold times (24-hour hold with Pro upgrade benefit)
 */
export const PAYOUT_HOLD_HOURS: Record<SubscriptionTier, number> = {
  free: 24,        // Standard 24-hour review window
  starter: 24,     // Standard 24-hour review window
  pro: 12,         // Pro sellers get 12-hour release
  lifetime: 12,    // Lifetime gets pro benefits
};

/**
 * Get the platform fee percentage for a subscription tier
 */
export function getFeePercentage(subscriptionTier: SubscriptionTier = 'free'): number {
  return SUBSCRIPTION_FEE_RATES[subscriptionTier] || SUBSCRIPTION_FEE_RATES['free'];
}

/**
 * Calculate payout release time based on subscription tier
 * Free/Starter: 24 hours
 * Pro/Lifetime: 12 hours
 */
export function calculatePayoutReleaseTime(
  shippedAt: Date,
  subscriptionTier: SubscriptionTier = 'free'
): Date {
  const holdHours = PAYOUT_HOLD_HOURS[subscriptionTier] || PAYOUT_HOLD_HOURS['free'];
  return new Date(shippedAt.getTime() + holdHours * 60 * 60 * 1000);
}

/**
 * Get the hold duration in hours for a subscription tier
 */
export function getPayoutHoldDuration(subscriptionTier: SubscriptionTier = 'free'): number {
  return PAYOUT_HOLD_HOURS[subscriptionTier] || PAYOUT_HOLD_HOURS['free'];
}

/**
 * Calculate platform fee based on subscription tier
 * 5% for free users, 2% for pro subscribers
 */
export function calculatePlatformFee(
  finalBidAmount: number,
  subscriptionTier: SubscriptionTier = 'free'
): number {
  const feePercentage = getFeePercentage(subscriptionTier);
  return Number((finalBidAmount * feePercentage).toFixed(2));
}

/**
 * Calculate Stripe payment processing fee (2.9% + $0.30 CAD)
 */
export function calculateProcessingFee(amount: number): number {
  return Number(((amount * STRIPE_PROCESSING_PERCENTAGE) + STRIPE_PROCESSING_FIXED).toFixed(2));
}

/**
 * Complete payout calculation for a seller
 * Returns breakdown of all fees and net amount
 */
export interface PayoutBreakdown {
  salePrice: number; // Final winning bid amount
  platformFeePercentage: number; // 5% or 2% depending on tier
  platformFee: number; // Currency amount of platform fee
  processingFee: number; // Stripe processing fee
  totalFees: number; // Sum of all fees
  sellerPayout: number; // Sale price - all fees
  subscriptionTier: SubscriptionTier;
}

export function calculatePayoutBreakdown(
  finalBidAmount: number,
  subscriptionTier: SubscriptionTier = 'free'
): PayoutBreakdown {
  const platformFee = calculatePlatformFee(finalBidAmount, subscriptionTier);
  const processingFee = calculateProcessingFee(finalBidAmount);
  const totalFees = platformFee + processingFee;
  const sellerPayout = Number((finalBidAmount - totalFees).toFixed(2));
  const feePercentage = getFeePercentage(subscriptionTier);

  return {
    salePrice: Number(finalBidAmount.toFixed(2)),
    platformFeePercentage: feePercentage * 100, // 5% or 2%
    platformFee,
    processingFee,
    totalFees: Number(totalFees.toFixed(2)),
    sellerPayout,
    subscriptionTier
  };
}

/**
 * Get a friendly description of the fee breakdown for display
 */
export function getPayoutSummary(breakdown: PayoutBreakdown): string {
  return `
Sale Price: $${breakdown.salePrice.toFixed(2)}
StackTrack Fee (${(breakdown.platformFeePercentage).toFixed(0)}%): -$${breakdown.platformFee.toFixed(2)}
Processing Fee: -$${breakdown.processingFee.toFixed(2)}
─────────────────────────────
Seller Receives: $${breakdown.sellerPayout.toFixed(2)}
  `.trim();
}

/**
 * Calculate estimated payout for display before sale
 * Used on auction creation form
 */
export function calculateEstimatedPayout(
  estimatedBidAmount: number,
  subscriptionTier: SubscriptionTier = 'free'
): {
  estimate: number;
  message: string;
  breakdown: PayoutBreakdown;
} {
  const breakdown = calculatePayoutBreakdown(estimatedBidAmount, subscriptionTier);
  
  return {
    estimate: breakdown.sellerPayout,
    message: `If this item sells for $${estimatedBidAmount.toFixed(2)}, you'll receive approximately $${breakdown.sellerPayout.toFixed(2)} after fees.`,
    breakdown
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Get fee comparison between subscription tiers
 */
export function getFeeTierComparison(finalBidAmount: number): {
  tier: SubscriptionTier;
  feePercentage: number;
  platformFee: number;
  processingFee: number;
  sellerPayout: number;
}[] {
  return (Object.keys(SUBSCRIPTION_FEE_RATES) as SubscriptionTier[]).map(tier => {
    const breakdown = calculatePayoutBreakdown(finalBidAmount, tier);
    return {
      tier,
      feePercentage: breakdown.platformFeePercentage,
      platformFee: breakdown.platformFee,
      processingFee: breakdown.processingFee,
      sellerPayout: breakdown.sellerPayout
    };
  });
}

/**
 * Get fee summary text for seller communication
 */
export function getFeeSummaryText(): string {
  return `
StackTrack Hybrid Fee Model:

Free Users:
  • Platform Fee: 5% of final sale price
  • Best for: Casual sellers

Pro Subscribers:
  • Platform Fee: 2% of final sale price
  • Best for: Regular sellers
  • Additional benefits: Featured listings, priority support

All Users:
  • Processing Fee: ~2.9% + $0.30 CAD (Stripe)
  • Fees deducted automatically at payout
  • Funds held until seller confirms shipment
  
Pro subscribers save 3% per transaction!
If you sell regularly, upgrading pays for itself quickly.
  `.trim();
}

/**
 * Calculate monthly savings for upgrading to Pro
 */
export function calculateUpgradeSavings(
  monthlyRevenue: number,
  numberOfTransactions: number,
  proSubscriptionCost: number = 9.99 // Typical Pro plan cost
): {
  freeUserFees: number;
  proUserFees: number;
  proSubscriptionCost: number;
  netSavings: number;
  paybackPeriod: number;
} {
  const freeUserFees = calculatePlatformFee(monthlyRevenue, 'free');
  const proUserFees = calculatePlatformFee(monthlyRevenue, 'pro');
  const feeSavings = freeUserFees - proUserFees;
  const netSavings = feeSavings - proSubscriptionCost;
  const paybackPeriod = proSubscriptionCost / (feeSavings / numberOfTransactions);

  return {
    freeUserFees: Number(freeUserFees.toFixed(2)),
    proUserFees: Number(proUserFees.toFixed(2)),
    proSubscriptionCost,
    netSavings: Number(netSavings.toFixed(2)),
    paybackPeriod: Number(paybackPeriod.toFixed(0))
  };
}

/**
 * Calculate monthly fee statistics
 */
export interface MonthlyFeeStats {
  totalTransactions: number;
  totalRevenue: number;
  totalPlatformFees: number;
  totalProcessingFees: number;
  totalFeesPaid: number;
  totalSellerPayouts: number;
  averageTransactionSize: number;
  averageFeesPerTransaction: number;
}

export function calculateMonthlyFeeStats(
  auctions: Array<{
    finalBidAmount?: number;
    status: string;
    subscriptionTier: SubscriptionTier;
  }>
): MonthlyFeeStats {
  const successfulAuctions = auctions.filter(a => a.status === 'sold' && a.finalBidAmount);
  
  let totalRevenue = 0;
  let totalPlatformFees = 0;
  let totalProcessingFees = 0;

  successfulAuctions.forEach((auction) => {
    if (auction.finalBidAmount) {
      totalRevenue += auction.finalBidAmount;
      totalPlatformFees += calculatePlatformFee(auction.finalBidAmount, auction.subscriptionTier);
      totalProcessingFees += calculateProcessingFee(auction.finalBidAmount);
    }
  });

  const totalFeesPaid = totalPlatformFees + totalProcessingFees;
  const totalSellerPayouts = totalRevenue - totalFeesPaid;
  const averageTransactionSize = successfulAuctions.length > 0 
    ? totalRevenue / successfulAuctions.length 
    : 0;
  const averageFeesPerTransaction = successfulAuctions.length > 0
    ? totalFeesPaid / successfulAuctions.length
    : 0;

  return {
    totalTransactions: successfulAuctions.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalPlatformFees: Number(totalPlatformFees.toFixed(2)),
    totalProcessingFees: Number(totalProcessingFees.toFixed(2)),
    totalFeesPaid: Number(totalFeesPaid.toFixed(2)),
    totalSellerPayouts: Number(totalSellerPayouts.toFixed(2)),
    averageTransactionSize: Number(averageTransactionSize.toFixed(2)),
    averageFeesPerTransaction: Number(averageFeesPerTransaction.toFixed(2))
  };
}

export default {
  PLATFORM_FEES,
  STRIPE_PROCESSING_PERCENTAGE,
  STRIPE_PROCESSING_FIXED,
  SUBSCRIPTION_FEE_RATES,
  getFeePercentage,
  calculatePlatformFee,
  calculateProcessingFee,
  calculatePayoutBreakdown,
  getPayoutSummary,
  calculateEstimatedPayout,
  formatCurrency,
  getFeeTierComparison,
  getFeeSummaryText,
  calculateUpgradeSavings,
  calculateMonthlyFeeStats
};

