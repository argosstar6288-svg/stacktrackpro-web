# Stripe Account Configuration for StackTrackPro Platform Fees

## Overview

This guide documents how to configure your Stripe Connect account to properly handle StackTrackPro's platform fees and seller payouts.

## Fee Configuration in Stripe

### 1. Application Fees Setup

Stripe Connect allows you to automatically collect application fees from each transaction.

#### Configure in Stripe Dashboard:

1. **Login to Stripe Dashboard** → https://dashboard.stripe.com
2. Go to **Settings** → **Account settings**
3. Navigate to **Connect settings** → **Application fees**
4. Enable **Application fees**

#### Application Fee Calculation:

```
Success Fee (15% of transaction):
- This is configured PER CHARGE made via Stripe API
- Applied at time of charge creation
- Automatically deducted from seller's available balance

Processing Fee (2.9% + $0.30):
- Passed through from Stripe's normal fees
- Already deducted by Stripe automatically
- Shown separately in transaction breakdown

Featured Listing / Listing Fees ($5 or $1):
- Charged directly to seller account
- NOT tied to transaction (charged separately)
```

### 2. Create a Charge with Application Fee

**When a buyer wins an auction and pays:**

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createAuctionPayment(
  auctionId: string,
  bidderId: string,
  sellerId: string,
  finalBidAmount: number,
  sellerStripeAccountId: string, // Stripe Connect ID
  isFeatured: boolean = false
) {
  try {
    // Calculate fees
    const successFee = Math.round(finalBidAmount * 0.15 * 100); // Convert to cents
    const processingFee = Math.round((finalBidAmount * 0.029 + 0.30) * 100);
    const featuredFee = isFeatured ? 500 : 0; // $5 in cents
    
    // Create charge with application fee
    const charge = await stripe.charges.create({
      amount: Math.round(finalBidAmount * 100), // Amount in cents
      currency: 'usd',
      source: 'tok_visa', // Or actual payment token from buyer
      
      // Application fee (your 15% success fee)
      application_fee_amount: successFee,
      
      // Send payment to seller's Stripe account
      stripe_account: sellerStripeAccountId,
      
      // Metadata for tracking
      metadata: {
        auctionId,
        bidderId,
        sellerId,
        isFeatured: isFeatured.toString(),
        successFeeAmount: (finalBidAmount * 0.15).toFixed(2),
        processingFeeAmount: (finalBidAmount * 0.029 + 0.30).toFixed(2),
      },
      
      description: `Auction: ${auctionId} - Final Bid: $${finalBidAmount}`
    });
    
    // If featured, charge separately to seller account
    if (isFeatured) {
      await stripe.charges.create({
        amount: 500, // $5 in cents
        currency: 'usd',
        source: 'tok_visa',
        stripe_account: sellerStripeAccountId,
        metadata: {
          type: 'featured_listing_fee',
          auctionId
        },
        description: `Featured listing fee for auction ${auctionId}`
      });
    }
    
    return charge;
    
  } catch (error) {
    console.error('Payment error:', error);
    throw error;
  }
}
```

### 3. Seller Payout Flow

**Money flow for a $100 auction sale:**

```
Buyer pays:                           $100.00
                                         ↓
Stripe charges buyer:                 $100.00
Stripe takes processing fee:          -$2.90
StackTrackPro takes success fee:      -$15.00
                                         ↓
Available to seller:                  $82.10
                                         ↓
Seller withdraws via:
  a) Auto payouts: Sent daily/weekly to bank
  b) Manual request: Seller requests payout
  c) Stripe balance: Available in Stripe account
```

### 4. Automatic Payouts to Sellers

Configure automatic payouts in Stripe:

1. **Settings** → **Connect** → **Payout settings**
2. Set **Automatic payouts**: 
   - **Daily**: Best for high-volume sellers
   - **Weekly**: Standard option
   - **Manual**: Seller must request payout
3. Set **Payout schedule**: Immediate, 1-day, or 2-day delay

### 5. Manage Payouts in Database

Track payouts in Firestore:

```typescript
interface SellerPayout {
  id: string;
  sellerId: string;
  stripeConnectId: string;
  
  // Amount details
  grossAmount: number; // Total sales
  successFees: number; // 15% deducted
  processingFees: number; // 2.9% + $0.30
  listingFees: number; // Additional $1 per listing
  featuredFees: number; // $5 per featured
  totalFees: number;
  netAmount: number; // Seller receives
  
  // Payout tracking
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePayoutId?: string;
  
  // Timestamps
  createdAt: Timestamp;
  processedAt?: Timestamp;
  dueDate?: Timestamp;
  
  // Related data
  auctionIds: string[];
  chargeIds: string[];
  
  // Notes
  notes?: string;
}

// Store in Firestore
db.collection('sellers').doc(sellerId).collection('payouts').add({
  sellerId,
  stripeConnectId,
  grossAmount: finalBidAmount,
  successFees: calculateSuccessFee(finalBidAmount),
  processingFees: calculateProcessingFee(finalBidAmount),
  listingFees,
  featuredFees,
  totalFees: successFees + processingFees + listingFees + featuredFees,
  netAmount: finalBidAmount - totalFees,
  status: 'completed',
  stripePayoutId: charge.id,
  createdAt: new Date(),
  processedAt: new Date(),
  auctionIds: [auctionId],
  chargeIds: [charge.id]
});
```

## Webhook Integration

### Handle Charge Succeeded

```typescript
// In your Stripe webhook handler
if (event.type === 'charge.succeeded') {
  const charge = event.data.object;
  const { auctionId, bidderId, sellerId } = charge.metadata;
  
  // Update auction as paid
  await db.collection('auctions').doc(auctionId).update({
    status: 'sold',
    paid: true,
    paidAt: new Date(),
    stripChargeId: charge.id,
  });
  
  // Create seller payout record
  const payout = {
    sellerId,
    auctionId,
    grossAmount: charge.amount / 100,
    fees: charge.application_fee_amount / 100,
    netAmount: (charge.amount - charge.application_fee_amount) / 100,
    status: 'completed',
    stripeChargeId: charge.id,
    createdAt: new Date()
  };
  
  await db.collection('payouts').add(payout);
}
```

## Testing Payments in Stripe

### Test Cards for Stripe

```
Success:
4242 4242 4242 4242

Require authentication:
4000 0025 0000 3155

Insufficient funds:
4000 0000 0000 9995

Expired card:
4000 0000 0000 0002

For testing application fees, use above cards with:
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits
```

### Test Application Fee

```bash
# Create a test charge with application fee
curl https://api.stripe.com/v1/charges \
  -u sk_test_YOUR_KEY: \
  -d "amount=10000" \
  -d "currency=usd" \
  -d "source=tok_visa" \
  -d "stripe_account=acct_seller_account" \
  -d "application_fee_amount=1500" \
  -d "description=Test+with+application+fee"
```

## Important Notes

### Do NOT Use Transfer API

❌ **DO NOT use Stripe Transfers** for marketplace fees. Use **Application Fees** instead.

Why:
- Transfers are for moving money between accounts
- Application Fees are designed for platform fees
- Application Fees automatically handle fee breakdown
- Transfers require manual math for fee deduction

### When to Use Each:

| Method | Use Case |
|--------|----------|
| **Application Fees** | Platform collects fees from transactions |
| **Transfers** | Manual payouts between accounts |
| **Payouts** | Seller withdraws to bank account |

### Fee Tracking Best Practices

1. **Store in Firestore**
   - Keep detailed fee breakdown per transaction
   - Match Stripe data for reconciliation
   - Easy reporting and analytics

2. **Use Metadata**
   - Add all relevant info to Stripe charge metadata
   - Makes tracking and debugging easier
   - Useful for customer support

3. **Reconcile Weekly**
   - Compare Firestore payouts to Stripe activity
   - Check for discrepancies
   - Report on fee totals

## Fee Reporting

### Monthly Report for Platform

```typescript
async function generateMonthlyFeeReport(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const payouts = await db.collection('payouts')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get();
  
  let totalGross = 0;
  let totalSuccessFees = 0;
  let totalProcessingFees = 0;
  let totalListingFees = 0;
  let totalFeaturedFees = 0;
  
  payouts.forEach(doc => {
    const payout = doc.data();
    totalGross += payout.grossAmount;
    totalSuccessFees += payout.successFees;
    totalProcessingFees += payout.processingFees;
    totalListingFees += payout.listingFees;
    totalFeaturedFees += payout.featuredFees;
  });
  
  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    totalTransactions: payouts.size,
    totalGross,
    totalSuccessFees,
    totalProcessingFees,
    totalListingFees,
    totalFeaturedFees,
    totalFees: totalSuccessFees + totalProcessingFees + totalListingFees + totalFeaturedFees,
    totalSellerPayouts: totalGross - (totalSuccessFees + totalProcessingFees + totalListingFees + totalFeaturedFees)
  };
}
```

## Security Considerations

### PCI Compliance
- Never handle raw card data
- Always use Stripe's hosted elements
- Store only Stripe token IDs in your database
- Log sensitive payment info (store receipts safely)

### Webhook Security
- Verify webhook signatures
- Use webhook secret from Stripe
- Never trust unsigned webhooks
- Implement idempotency for retries

```typescript
// Verify webhook signature
import crypto from 'crypto';

function verifyStripeWebhook(req: any) {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, secret);
    return event;
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error}`);
  }
}
```

## Summary of Channel to Configure

**Primary Focus**: Stripe Connect → Application Fees on Charges

This setup enables:
✅ Automatic fee collection (15%)
✅ Direct seller payouts
✅ Transparent fee breakdown
✅ Compliant marketplace model
✅ Easy seller onboarding

