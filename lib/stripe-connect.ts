/**
 * Stripe Connect utilities for seller onboarding
 * Handles Express account creation and payout management
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

/**
 * Create a new Stripe Express Connected Account for a seller
 */
export async function createSellerConnectedAccount(
  email: string,
  countryCode: string = 'CA'
): Promise<string> {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: countryCode,
      email: email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });

    return account.id;
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    throw error;
  }
}

/**
 * Generate onboarding link for seller to complete identity verification
 * and bank account linking
 */
export async function generateOnboardingLink(
  stripeAccountId: string,
  refreshUrl: string = 'https://stacktrackpro.com/dashboard/stripe-reauth',
  returnUrl: string = 'https://stacktrackpro.com/dashboard/seller-tools'
): Promise<string> {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
    });

    return accountLink.url;
  } catch (error) {
    console.error('Error generating onboarding link:', error);
    throw error;
  }
}

/**
 * Get account status to verify completion of onboarding
 */
export async function getAccountStatus(stripeAccountId: string) {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return {
      id: account.id,
      isVerified: account.charges_enabled && account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      tokensCreated: account.created,
      requirements: account.requirements?.currently_due || [],
    };
  } catch (error) {
    console.error('Error retrieving account status:', error);
    throw error;
  }
}

/**
 * Create payout transfer from platform to seller's connected account
 */
export async function releasePayoutToSeller(
  destinationAccountId: string,
  amountInCents: number,
  auctionId: string
): Promise<{ transferId: string; amountInCents: number }> {
  try {
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'cad',
      destination: destinationAccountId,
      description: `Payout for auction ${auctionId}`,
      metadata: {
        auctionId,
        platform: 'stacktrackpro',
      },
    });

    return {
      transferId: transfer.id,
      amountInCents: transfer.amount,
    };
  } catch (error) {
    console.error('Error creating transfer:', error);
    throw error;
  }
}

/**
 * Get account balance information
 */
export async function getAccountBalances(stripeAccountId: string) {
  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId }
    );

    return {
      available: balance.available || [],
      pending: balance.pending || [],
    };
  } catch (error) {
    console.error('Error retrieving balance:', error);
    throw error;
  }
}

/**
 * Process a refund for disputed auction
 */
export async function refundAuctionPayment(
  paymentIntentId: string,
  amountInCents?: number
) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInCents,
    });

    return {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
    };
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Cancel a payout for a seller
 * (Used when dispute is filed or account is flagged)
 */
export async function cancelPayout(transferId: string) {
  try {
    // Note: Stripe doesn't allow canceling transfers directly
    // Instead, we need to refund the original charge
    // This should be called with payment_intent_id instead
    console.warn(
      'Transfer cancellation: Use refundAuctionPayment with payment_intent_id'
    );
    return null;
  } catch (error) {
    console.error('Error canceling transfer:', error);
    throw error;
  }
}

/**
 * Type definitions for seller payout info
 */
export interface SellerPayoutInfo {
  stripeAccountId: string;
  accountStatus: 'onboarding' | 'pending_verification' | 'verified' | 'restricted';
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  lastPayout?: {
    transferId: string;
    amount: number;
    releasedAt: Date;
  };
}

/**
 * Type definitions for dispute info
 */
export interface DisputeInfo {
  disputeId: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  openedAt: Date;
  reason: string;
  trackingNumber?: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  resolution?: 'seller_approved' | 'buyer_approved' | 'split' | 'cancelled';
  resolvedAt?: Date;
  notes?: string;
}
