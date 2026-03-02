/**
 * StackTrackPro Platform Fee Calculations
 * 
 * All fees are calculated and documented in PLATFORM_FEES.md
 */

/**
 * Platform success fee on completed auctions
 * Applied to the final winning bid amount
 */
export const SUCCESS_FEE_PERCENTAGE = 0.15; // 15%

/**
 * Stripe payment processing fee
 * Applied per transaction
 */
export const STRIPE_PROCESSING_PERCENTAGE = 0.029; // 2.9%
export const STRIPE_PROCESSING_FIXED = 0.30; // $0.30

/**
 * Listing fees
 * First 10 auctions per seller per month are free
 * Additional listings cost $1 each
 */
export const FREE_LISTINGS_PER_MONTH = 10;
export const ADDITIONAL_LISTING_FEE = 1.00;

/**
 * Featured listing optional fee
 * Increases visibility on platform
 */
export const FEATURED_LISTING_FEE = 5.00;

/**
 * Calculate 15% platform success fee on final bid amount
 */
export function calculateSuccessFee(finalBidAmount: number): number {
  return Number((finalBidAmount * SUCCESS_FEE_PERCENTAGE).toFixed(2));
}

/**
 * Calculate Stripe payment processing fee (2.9% + $0.30)
 */
export function calculateProcessingFee(amount: number): number {
  return Number(((amount * STRIPE_PROCESSING_PERCENTAGE) + STRIPE_PROCESSING_FIXED).toFixed(2));
}

/**
 * Calculate listing fee based on auction count for month
 * First 10 free, then $1 each
 */
export function calculateListingFee(auctionCountThisMonth: number): number {
  if (auctionCountThisMonth <= FREE_LISTINGS_PER_MONTH) {
    return 0;
  }
  return (auctionCountThisMonth - FREE_LISTINGS_PER_MONTH) * ADDITIONAL_LISTING_FEE;
}

/**
 * Calculate featured listing fee
 */
export function calculateFeaturedFee(isFeatured: boolean): number {
  return isFeatured ? FEATURED_LISTING_FEE : 0;
}

/**
 * Complete payout calculation for a seller
 * Returns breakdown of all fees and net amount
 */
export interface PayoutBreakdown {
  gross: number; // Final winning bid amount
  successFee: number; // 15% of gross
  processingFee: number; // 2.9% + $0.30
  listingFee: number; // $0-$1 based on count
  featuredFee: number; // $0 or $5
  totalFees: number; // Sum of all fees
  net: number; // Gross - all fees
  estimatedNet: number; // For display before fees calculated
}

export function calculatePayoutBreakdown(
  finalBidAmount: number,
  options: {
    isFeatured?: boolean;
    auctionCountThisMonth?: number;
  } = {}
): PayoutBreakdown {
  const {
    isFeatured = false,
    auctionCountThisMonth = 1
  } = options;

  const gross = finalBidAmount;
  const successFee = calculateSuccessFee(gross);
  const processingFee = calculateProcessingFee(gross);
  const listingFee = calculateListingFee(auctionCountThisMonth);
  const featuredFee = calculateFeaturedFee(isFeatured);
  
  const totalFees = successFee + processingFee + listingFee + featuredFee;
  const net = Number((gross - totalFees).toFixed(2));

  return {
    gross: Number(gross.toFixed(2)),
    successFee,
    processingFee,
    listingFee,
    featuredFee,
    totalFees: Number(totalFees.toFixed(2)),
    net,
    estimatedNet: net
  };
}

/**
 * Calculate estimated payout for display
 * Used on auction creation form
 */
export function calculateEstimatedPayout(
  estimatedBidAmount: number,
  isFeatured: boolean = false
): {
  estimate: number;
  message: string;
} {
  // Conservative estimate assuming success fee + processing fee
  // Use average processing fee for estimation
  const successFee = estimatedBidAmount * SUCCESS_FEE_PERCENTAGE;
  const processingFee = (estimatedBidAmount * STRIPE_PROCESSING_PERCENTAGE) + STRIPE_PROCESSING_FIXED;
  const featuredFee = isFeatured ? FEATURED_LISTING_FEE : 0;
  
  const estimate = Number((estimatedBidAmount - successFee - processingFee - featuredFee).toFixed(2));
  
  return {
    estimate,
    message: `If this item sells for $${estimatedBidAmount.toFixed(2)}, you'll receive approximately ${formatCurrency(estimate)} after fees.`
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Get fee summary text for seller communication
 */
export function getFeeSummaryText(): string {
  return `
Platform Fees:
• Success Fee: ${(SUCCESS_FEE_PERCENTAGE * 100).toFixed(0)}% of final sale price
• Payment Processing: ${(STRIPE_PROCESSING_PERCENTAGE * 100).toFixed(1)}% + $${STRIPE_PROCESSING_FIXED.toFixed(2)} per transaction
• Listing Fee: Free for first ${FREE_LISTINGS_PER_MONTH} auctions/month, then $${ADDITIONAL_LISTING_FEE.toFixed(2)} each
• Featured Listing: $${FEATURED_LISTING_FEE.toFixed(2)} (optional)

All fees are deducted from your payout automatically.
  `.trim();
}

/**
 * Calculate monthly fee statistics
 */
export interface MonthlyFeeStats {
  totalAuctions: number;
  successfulAuctions: number;
  totalRevenue: number;
  totalSuccessFees: number;
  totalProcessingFees: number;
  totalListingFees: number;
  totalFeaturedFees: number;
  totalFeesPaid: number;
  totalPayouts: number;
}

export function calculateMonthlyFeeStats(
  auctions: Array<{
    finalBidAmount?: number;
    status: string;
    isFeatured: boolean;
  }>
): MonthlyFeeStats {
  const successfulAuctions = auctions.filter(a => a.status === 'sold' && a.finalBidAmount);
  
  let totalRevenue = 0;
  let totalSuccessFees = 0;
  let totalProcessingFees = 0;
  let totalFeaturedFees = 0;

  successfulAuctions.forEach((auction, index) => {
    if (auction.finalBidAmount) {
      totalRevenue += auction.finalBidAmount;
      totalSuccessFees += calculateSuccessFee(auction.finalBidAmount);
      totalProcessingFees += calculateProcessingFee(auction.finalBidAmount);
    }
    totalFeaturedFees += auction.isFeatured ? FEATURED_LISTING_FEE : 0;
  });

  const totalListingFees = calculateListingFee(auctions.length);
  const totalFeesPaid = totalSuccessFees + totalProcessingFees + totalListingFees + totalFeaturedFees;
  const totalPayouts = totalRevenue - totalFeesPaid;

  return {
    totalAuctions: auctions.length,
    successfulAuctions: successfulAuctions.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalSuccessFees: Number(totalSuccessFees.toFixed(2)),
    totalProcessingFees: Number(totalProcessingFees.toFixed(2)),
    totalListingFees: Number(totalListingFees.toFixed(2)),
    totalFeaturedFees: Number(totalFeaturedFees.toFixed(2)),
    totalFeesPaid: Number(totalFeesPaid.toFixed(2)),
    totalPayouts: Number(totalPayouts.toFixed(2))
  };
}

export default {
  SUCCESS_FEE_PERCENTAGE,
  STRIPE_PROCESSING_PERCENTAGE,
  STRIPE_PROCESSING_FIXED,
  FREE_LISTINGS_PER_MONTH,
  ADDITIONAL_LISTING_FEE,
  FEATURED_LISTING_FEE,
  calculateSuccessFee,
  calculateProcessingFee,
  calculateListingFee,
  calculateFeaturedFee,
  calculatePayoutBreakdown,
  calculateEstimatedPayout,
  formatCurrency,
  getFeeSummaryText,
  calculateMonthlyFeeStats
};
