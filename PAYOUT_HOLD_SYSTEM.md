# StackTrackPro Payout Hold & Shipping Release System

## Overview

StackTrackPro holds seller funds after buyer payment and releases them only when the seller confirms shipment. This protects both buyers and the platform while maintaining seller trust.

## Complete Payout Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AUCTION ENDS                                             │
│    Status: awaiting_payment                                 │
│    Funds: None collected yet                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BUYER PAYS                                               │
│    Status: payment_received                                 │
│    Funds: Stripe collects payment                           │
│    StackTrack fees deducted automatically                   │
│    Remaining balance: HELD in StackTrack account            │
│    Seller sees: "Awaiting shipment confirmation"            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SELLER MARKS AS SHIPPED (3 business days to do this)    │
│    Status: awaiting_shipment → shipped_pending_release      │
│    Seller enters:                                           │
│      • Carrier (Canada Post, UPS, FedEx, etc.)             │
│      • Tracking number                                      │
│      • Optional shipping note                               │
│    StackTrack: Validates shipment info                      │
│    Buyer notified: "Item shipped - Track here"              │
│    StackTrack sets: releaseAt = shippedAt + 24 hours       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 24-HOUR REVIEW WINDOW (Most Important!)                 │
│    Status: shipped_pending_release                          │
│    During this time:                                        │
│      ✔ Buyer can open dispute                              │
│      ✔ StackTrack can manually review                      │
│      ✔ Seller CANNOT access funds yet                      │
│    If dispute opened:                                       │
│      → disputeOpened = true                                │
│      → Payout blocked (manual review)                      │
│    If no dispute after 24 hours:                           │
│      → Auto-trigger: Stripe transfer                       │
│      → payoutReleased = true                               │
│      → Status: completed                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. FUNDS RELEASED (After 24 Hours or Delay if Dispute)     │
│    Status: completed (or disputed)                          │
│    StackTrack triggers Stripe transfer to seller            │
│    Seller receives: Sale Price - Platform Fee - Processing │
│    Timeline: Immediate to 1-2 business days                 │
│    Seller notified: "Your payout has been released"        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. BUYER RECEIVES ITEM                                      │
│    Status: delivered                                        │
│    Buyer can leave feedback                                 │
│    Dispute window closes (30 days from shipped)            │
└─────────────────────────────────────────────────────────────┘
```

## Timeline Summary

```
T+0 sec:   Buyer pays → Payment captured, fees deducted
T+0 min:   Seller sees "Mark as Shipped" button
T+0-3d:    Seller marks shipped, enters tracking
T+0:       Tracking confirmed → 24-hour hold begins
T+24h:     Buyer did NOT open dispute? → FUNDS AUTO-RELEASED ✓
T+24h:     Buyer DID open dispute? → Manual review, payout delayed
T+30d:     Dispute window closes
```

## Database Schema

### Auction Document Structure

```typescript
interface Auction {
  // Basic info
  id: string;
  title: string;
  sellerId: string;
  buyerId: string;
  
  // Sale price
  finalBidAmount: number;
  
  // Fee breakdown
  fees: {
    platformFeeAmount: number;      // 5% or 2% depending on tier
    platformFeePercentage: number;  // 5 or 2
    processingFeeAmount: number;    // ~2.9% + $0.30
    totalFeeAmount: number;         // Sum of all fees
  };
  
  // Payout info
  sellerPayoutAmount: number;       // Final amount to seller
  
  // Payment status
  paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded';
  stripeChargeId?: string;          // Reference to Stripe charge
  paidAt?: Timestamp;
  
  // Shipping & release status
  status: 'active' | 'sold' | 'awaiting_shipment' | 'shipped_pending_release' | 'shipped' | 'delivered' | 'cancelled' | 'disputed';
  shippingInfo?: {
    carrier: 'canada_post' | 'ups' | 'fedex' | 'dhl' | 'other';
    trackingNumber: string;
    shippedAt: Timestamp;
    estimatedDelivery?: string;     // e.g., "Dec 20 - Jan 5"
    sellerNote?: string;
  };
  
  // 24-Hour Release Hold (NEW)
  releaseHold: {
    releaseAt: Timestamp;           // shippedAt + 24 hours (or 12 for Pro)
    disputeOpened: boolean;         // Set to true if buyer opens dispute
    disputeOpenedAt?: Timestamp;
    releasedEarlyManually?: boolean; // For admin override
  };
  
  // Payout release
  payoutInfo?: {
    payoutReleased: boolean;        // Released after 24-hour window
    releasedAt?: Timestamp;
    stripeTransferId?: string;      // Reference to Stripe transfer
    amount: number;                  // Amount transferred
    failureReason?: string;
  };
  
  // Protection
  protectionRules: {
    shippingDeadline: Timestamp;    // 3 business days from sale
    disputeWindow: Timestamp;        // e.g., 30 days from shipped
    refundEligible: boolean;
  };
  
  // Timestamps
  createdAt: Timestamp;
  endedAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Fee Breakdown Example

**Sale: $400 CAD**

### Free Seller
```
Sale Price:              $400.00
Platform Fee (5%):       -$20.00
Processing Fee (~3%):    -$12.30
─────────────────────────────
Seller Receives:         $367.70
```

### Pro Seller (Subscribed)
```
Sale Price:              $400.00
Platform Fee (2%):       -$8.00
Processing Fee (~3%):    -$12.30
─────────────────────────────
Seller Receives:         $379.70

Savings vs Free:         +$12.00 per transaction
Pro Subscription Cost:   ~$9.99/month
Breakeven:               Sales per month > $833
```

## Seller Dashboard UI

### When Awaiting Shipment (Status: awaiting_shipment)

```
┌─────────────────────────────────────────────┐
│ AUCTION SOLD - PAYMENT RECEIVED              │
├─────────────────────────────────────────────┤
│ 🏃 ACTION REQUIRED                          │
│ You must mark this item as shipped within 3 │
│ business days to release your payout.       │
├─────────────────────────────────────────────┤
│ Sale Price:           $400.00               │
│ Platform Fee (5%):    -$20.00               │
│ Processing Fee:       -$12.30               │
│ You Will Receive:     $367.70               │
│ (Released upon shipment)                    │
├─────────────────────────────────────────────┤
│ [MARK AS SHIPPED →]                         │
│ Days remaining: 2 / 3                       │
└─────────────────────────────────────────────┘
```

### Shipping Modal Form

```
MARK ITEM AS SHIPPED

Carrier: [Dropdown ▼]
  └ Canada Post
  └ UPS
  └ FedEx
  └ DHL
  └ Other

Tracking Number: [________________]
(Required)

Estimated Delivery: Tue, Dec 20 - Tue, Jan 5
(Auto-filled based on carrier)

Shipping Note (optional):
[________________________________]

Cancel               [✓ CONFIRM SHIPMENT]
```

### After Shipment Confirmed

```
┌─────────────────────────────────────────────┐
│ ✓ ITEM SHIPPED - PAYOUT RELEASED            │
├─────────────────────────────────────────────┤
│ Carrier: Canada Post                        │
│ Tracking: 1234567890                        │
│ Shipped: Dec 15, 2024                       │
│                                              │
│ Payout Released: $367.70                    │
│ To Bank Account: ••••••2458                 │
│ Timeline: 1-2 business days                 │
├─────────────────────────────────────────────┤
│ [view tracking]  [Print label]              │
└─────────────────────────────────────────────┘
```

### After "Mark as Shipped" - 24-Hour Review Window

```
┌─────────────────────────────────────────────┐
│ ✓ TRACKING RECEIVED - PAYOUT PENDING        │
├─────────────────────────────────────────────┤
│ Your item has been recorded as shipped.     │
│                                              │
│ ⏳ PAYOUT RELEASE IN PROGRESS               │
│ Your payment will be released automatically │
│ in 24 hours (unless a dispute is opened).   │
│                                              │
│ Carrier: Canada Post                        │
│ Tracking: 1234567890                        │
│ Shipped: Dec 15, 2024                       │
│ Expected release: Dec 16, 2024 @ 2:30 PM  │
│                                              │
│ Payout Amount: $367.70                      │
│ To: Bank Account ••••••2458                 │
├─────────────────────────────────────────────┤
│ ℹ During this 24-hour window:               │
│ • Buyer can dispute the transaction        │
│ • StackTrack reviews for fraud              │
│ • Your funds remain securely held           │
│ • After 24h: Auto-released (no dispute)     │
│                                              │
│ [view tracking]  [Support]                  │
└─────────────────────────────────────────────┘
```

### Pro Seller Badge (12-Hour Release)

```
┌─────────────────────────────────────────────┐
│ ✓ TRACKING RECEIVED - PAYOUT PENDING        │
│ 👑 PRO SELLER - 12-HOUR RELEASE             │
├─────────────────────────────────────────────┤
│ Your Pro subscription gets faster payouts!  │
│                                              │
│ Carrier: Canada Post                        │
│ Tracking: 1234567890                        │
│ Shipped: Dec 15, 2024                       │
│ Expected release: Dec 15, 2024 @ 2:30 PM   │
│ (12 hours instead of 24)                    │
│                                              │
│ Payout Amount: $367.70 (2% platform fee)    │
│ To: Bank Account ••••••2458                 │
├─────────────────────────────────────────────┤
│ [Upgrade for faster releases]  [Support]    │
└─────────────────────────────────────────────┘
```

## 24-Hour Auto-Release Mechanism

### Overview

The 24-hour hold is StackTrack's fraud protection window. Here's how it works:

```
1. Seller marks item as shipped
   ↓
2. TrackingStatus set to "shipped_pending_release"
   ↓
3. releaseAt = shippedAt + 24 hours (or 12 for Pro)
   ↓
4. WINDOW: Buyer can open dispute, you review
   ↓
5. IF no dispute AND releaseAt time has passed:
   → Automatic Stripe transfer triggers
   → Status → "completed"
   ↓
6. IF buyer opens dispute:
   → disputeOpened = true
   → Payout paused (manual review)
   → You handle it in Admin Dashboard
```

### Option A: Firebase Scheduled Function (RECOMMENDED)

```typescript
// functions/services/payoutRelease.ts
import * as functions from 'firebase-functions';
import { db } from '../config/firebaseAdmin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Run every hour to check for eligible payouts
export const autoReleasePayouts = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('Starting payout release check...');

    try {
      // Find all auctions ready for release
      const query = db.collection('auctions')
        .where('status', '==', 'shipped_pending_release')
        .where('releaseHold.disputeOpened', '==', false);

      const snapshot = await query.get();
      const now = new Date();
      const toRelease = [];

      snapshot.forEach((doc) => {
        const auction = doc.data();
        const releaseAt = auction.releaseHold?.releaseAt?.toDate();

        // Check if 24-hour window has passed
        if (releaseAt && now >= releaseAt) {
          toRelease.push({
            id: doc.id,
            ...auction,
          });
        }
      });

      console.log(`Found ${toRelease.length} auctions ready to release`);

      // Process each release
      for (const auction of toRelease) {
        try {
          // 1. Create Stripe transfer to seller
          const transfer = await stripe.transfers.create({
            amount: Math.round(auction.sellerPayoutAmount * 100), // cents
            currency: 'cad',
            destination: auction.sellerStripeAccountId,
            description: `Payout for auction "${auction.title}" (${auction.id})`,
            metadata: {
              auctionId: auction.id,
              sellerId: auction.sellerId,
            },
          });

          // 2. Update Firestore with release info
          await db.collection('auctions').doc(auction.id).update({
            status: 'completed',
            'payoutInfo.payoutReleased': true,
            'payoutInfo.releasedAt': new Date(),
            'payoutInfo.stripeTransferId': transfer.id,
            'payoutInfo.amount': auction.sellerPayoutAmount,
          });

          // 3. Send confirmation email to seller
          await sendPayoutConfirmationEmail(auction);

          console.log(`✓ Released payout for auction ${auction.id}`);
        } catch (error) {
          console.error(`✗ Failed to release payout for ${auction.id}:`, error);

          // Update with failure reason
          await db.collection('auctions').doc(auction.id).update({
            'payoutInfo.failureReason': error.message,
          });

          // Alert admin
          await sendAdminAlert({
            type: 'PAYOUT_FAILURE',
            auctionId: auction.id,
            reason: error.message,
          });
        }
      }
    } catch (error) {
      console.error('Error in autoReleasePayouts:', error);
    }
  });
```

### Option B: Vercel Cron Job (Alternative)

```typescript
// app/api/cron/release-payouts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let releasedCount = 0;

  try {
    // Same logic as Firebase function above
    const query = db.collection('auctions')
      .where('status', '==', 'shipped_pending_release')
      .where('releaseHold.disputeOpened', '==', false);

    const snapshot = await query.get();
    const now = new Date();

    for (const doc of snapshot.docs) {
      const auction = doc.data();
      const releaseAt = auction.releaseHold?.releaseAt?.toDate?.();

      if (releaseAt && now >= releaseAt) {
        try {
          const transfer = await stripe.transfers.create({
            amount: Math.round(auction.sellerPayoutAmount * 100),
            currency: 'cad',
            destination: auction.sellerStripeAccountId,
          });

          await db.collection('auctions').doc(doc.id).update({
            status: 'completed',
            'payoutInfo.payoutReleased': true,
            'payoutInfo.releasedAt': new Date(),
            'payoutInfo.stripeTransferId': transfer.id,
          });

          releasedCount++;
        } catch (error) {
          console.error(`Payout failed for ${doc.id}:`, error);
        }
      }
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      released: releasedCount,
      durationMs: duration,
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}
```

Configure in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/release-payouts",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Option C: Dashboard Trigger (MVP Approach)

```typescript
// app/dashboard/seller/page.tsx
// Check for eligible payouts every time seller loads dashboard

useEffect(() => {
  const checkAndReleasePayout = async () => {
    const auctions = await db.collection('auctions')
      .where('sellerId', '==', userId)
      .where('status', '==', 'shipped_pending_release')
      .where('releaseHold.disputeOpened', '==', false)
      .get();

    const now = new Date();

    for (const doc of auctions.docs) {
      const auction = doc.data();
      const releaseAt = auction.releaseHold?.releaseAt?.toDate?.();

      if (releaseAt && now >= releaseAt) {
        // Trigger release
        await releasePayout(doc.id);
      }
    }
  };

  checkAndReleasePayout();
}, [userId]);
```

## Implementation Code Examples

### Firestore Auction Schema Update

```typescript
// Document path: /auctions/{auctionId}

const auctionRef = doc(db, 'auctions', auctionId);

// When auction ends and payment received:
await updateDoc(auctionRef, {
  paymentStatus: 'paid',
  status: 'awaiting_shipment',
  paidAt: serverTimestamp(),
  stripeChargeId: charge.id,
  fees: {
    platformFeeAmount: 20.00,        // 5% of $400
    platformFeePercentage: 5,
    processingFeeAmount: 12.30,
    totalFeeAmount: 32.30
  },
  sellerPayoutAmount: 367.70,
  protectionRules: {
    shippingDeadline: Timestamp.fromDate(
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    ),
    disputeWindow: Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    ),
    refundEligible: true
  }
});
```

### Seller Marks Item as Shipped (With 24-Hour Hold)

```typescript
// In seller dashboard, when they submit shipping form:

const shipAuction = async (
  auctionId: string,
  carrier: string,
  trackingNumber: string,
  note: string,
  subscriptionTier: 'free' | 'starter' | 'pro' | 'lifetime' = 'free'
) => {
  try {
    const auctionRef = doc(db, 'auctions', auctionId);
    
    // Calculate release time based on subscription tier
    const now = new Date();
    const holdHours = (subscriptionTier === 'pro' || subscriptionTier === 'lifetime') ? 12 : 24;
    const releaseAt = new Date(now.getTime() + holdHours * 60 * 60 * 1000);
    
    // 1. Update auction with shipping info + 24-hour hold
    await updateDoc(auctionRef, {
      status: 'shipped_pending_release',  // ← NEW: Intermediate status
      shippingInfo: {
        carrier,
        trackingNumber,
        sellerNote: note,
        shippedAt: serverTimestamp(),
        estimatedDelivery: calculateEstimatedDelivery(carrier) // e.g., "Dec 22"
      },
      releaseHold: {
        releaseAt: Timestamp.fromDate(releaseAt),
        disputeOpened: false
      },
      // DO NOT RELEASE PAYOUT YET - Funds remain held
      payoutInfo: {
        payoutReleased: false,  // ← Still false
        amount: auctionData.sellerPayoutAmount
      }
    });
    
    // 2. Notify buyer - Item shipped with tracking
    await sendBuyerNotification({
      auctionId,
      buyerId: auctionData.buyerId,
      type: 'ITEM_SHIPPED',
      trackingNumber,
      carrier,
      estimatedDelivery: releaseAt
    });
    
    // 3. Notify seller - Payout pending 24-hour review
    await sendSellerNotification({
      auctionId,
      sellerId: currentUser.uid,
      type: 'PAYOUT_PENDING_RELEASE',
      releaseTime: releaseAt,
      holdDuration: holdHours
    });
    
    console.log(`✓ Auction ${auctionId} marked as shipped`);
    console.log(`✓ Payout will auto-release in ${holdHours} hours`);
    console.log(`✓ Release scheduled for: ${releaseAt.toISOString()}`);
    
  } catch (error) {
    console.error('Error marking auction as shipped:', error);
    throw error;
  }
};

// Helper: Calculate estimated delivery based on carrier
function calculateEstimatedDelivery(carrier: string): string {
  const today = new Date();
  const daysToAdd = {
    'canada_post': 5,
    'ups': 3,
    'fedex': 3,
    'dhl': 4,
    'other': 7
  };
  
  const days = daysToAdd[carrier] || 7;
  const deliveryDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  
  return deliveryDate.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric'
  });
}
```

### Buyer Opens Dispute Within 24 Hours

```typescript
// In buyer dashboard, disputes section:

const openDispute = async (auctionId: string, reason: string) => {
  try {
    const auctionRef = doc(db, 'auctions', auctionId);
    
    // 1. Flag the dispute on the auction
    await updateDoc(auctionRef, {
      'releaseHold.disputeOpened': true,
      'releaseHold.disputeOpenedAt': serverTimestamp(),
      disputeReason: reason
    });
    
    // 2. Keep status as 'shipped_pending_release' (but now disputed)
    // Payout will NOT auto-release even after 24 hours
    
    // 3. Alert admin about dispute
    await sendAdminAlert({
      type: 'DISPUTE_OPENED',
      auctionId,
      buyerId: auctionData.buyerId,
      reason,
      trackingNumber: auctionData.shippingInfo.trackingNumber
    });
    
    // 4. Notify seller dispute was opened
    await sendSellerNotification({
      auctionId,
      type: 'DISPUTE_OPENED',
      message: 'Buyer has opened a dispute. Status: Under review.'
    });
    
    console.log(`✓ Dispute opened for auction ${auctionId}`);
    console.log(`✓ Payout release paused - manual review required`);
    
  } catch (error) {
    console.error('Error opening dispute:', error);
    throw error;
  }
};
```

### Auto-Release After 24 Hours (Scheduled Function)

This is handled by the scheduled functions above. The key logic:

```typescript
// Pseudo-code for clarity

if (auction.status === 'shipped_pending_release'
    && auction.releaseHold.disputeOpened === false
    && now >= auction.releaseHold.releaseAt) {
  
  // AUTO-TRIGGER PAYOUT TRANSFER
  await stripe.transfers.create({
    amount: auction.sellerPayoutAmount,
    currency: 'cad',
    destination: auction.sellerStripeAccountId
  });
  
  // Mark as released
  auction.status = 'completed';
  auction.payoutInfo.payoutReleased = true;
  auction.payoutInfo.releasedAt = now;
}
```

### If Dispute is Resolved Manually

```typescript
// In admin dashboard, disputes section:

const resolveDispute = async (
  auctionId: string,
  resolution: 'RELEASE_PAYOUT' | 'FULL_REFUND' | 'CANCEL'
) => {
  const auctionRef = doc(db, 'auctions', auctionId);
  
  if (resolution === 'RELEASE_PAYOUT') {
    // 1. Release payout to seller
    await stripe.transfers.create({
      amount: auction.sellerPayoutAmount,
      currency: 'cad',
      destination: auction.sellerStripeAccountId
    });
    
    // 2. Update auction
    await updateDoc(auctionRef, {
      status: 'completed',
      'payoutInfo.payoutReleased': true,
      'payoutInfo.releasedAt': serverTimestamp(),
      'releaseHold.releasedEarlyManually': true,
      disputeResolution: 'PAYOUT_RELEASED'
    });
    
    // 3. Notify both parties
    await sendSellerNotification({ auctionId, type: 'DISPUTE_RESOLVED_PAYOUT' });
    await sendBuyerNotification({ auctionId, type: 'DISPUTE_RESOLVED' });
  
  } else if (resolution === 'FULL_REFUND') {
    // 1. Refund buyer via Stripe
    await stripe.refunds.create({
      charge: auction.stripeChargeId,
      amount: auction.salePrice * 100
    });
    
    // 2. Update auction
    await updateDoc(auctionRef, {
      status: 'disputed',
      paymentStatus: 'refunded',
      disputeResolution: 'FULL_REFUND'
    });
    
    // 3. Notify seller - no payout
    await sendSellerNotification({ 
      auctionId, 
      type: 'DISPUTE_RESOLVED_REFUND',
      message: 'Dispute resolved. Full refund issued to buyer.'
    });
  
  } else if (resolution === 'CANCEL') {
    // Similar to FULL_REFUND but more detailed
  }
};
```

## Protection Rules


### Shipping Deadline

**Rule**: Seller must mark item as shipped within **3 business days** of payment.

**Enforcement**:
- Automatic reminder at day 2
- Final warning at day 2.5
- Ability to auto-cancel at day 3 (seller appeal process)
- Buyer can manually cancel anytime

**Consequence**: 
- Unpaid payout returned to buyer
- Seller account flagged as slow shipper
- Repeated violations: Account suspension

### Dispute Window

**Rule**: Buyer can open dispute for **30 days** after shipment marked confirmed.

**Valid dispute reasons**:
- Item not as described
- Item damaged in shipping
- Item never received
- Item significantly different from photos

**Process**:
1. Buyer opens dispute
2. StackTrack holds funds (if not yet transferred)
3. Buyer can provide proof (photos, carrier info)
4. Seller given chance to respond
5. StackTrack mediates or refunds

### False Shipment Protection

**Rule**: Seller must provide valid tracking number.

**Validation**:
- Tracking number format checked
- Can be auto-validated with carrier API (future)
- Manual verification if questionable
- Buyer can report "tracking not updating"

**Consequence of False Shipment**:
- Account suspended immediately
- Funds returned to buyer
- Reported to payment processors
- Potential legal action

## Seller Communication

### When Payment Received (Immediate)

```
Subject: Payment Received - Please Ship Item

Hi [Seller Name],

Congratulations! Your item sold for $400.00

Your payout amount: $367.70
(After platform and processing fees)

👉 NEXT STEP: Mark item as shipped within 3 business days

Your payout will be released to your bank account immediately 
after you confirm shipment.

Timeline:
• Day 1-3: Mark as shipped
• Upon shipment: Funds released (1-2 bus. days to bank)

Log in to StackTrackPro to complete shipping:
[Dashboard Link]

Questions? Contact: support@stacktrackpro.com
```

### Reminder (Day 2)

```
Subject: ⏰ Reminder: Ship Your Item (1 day remaining)

Hi [Seller Name],

Your payout of $367.70 is waiting - just mark it as shipped!

Remaining time: 1 business day
Shipping deadline: Tomorrow at 11:59 PM

[MARK AS SHIPPED NOW]

After you confirm shipment, your payout will be released 
immediately to your Stripe account.
```

### Final Warning (Day 2.5)

```
Subject: ⚠️ URGENT: Your Payout Will Be Reversed

Hi [Seller Name],

You have until tomorrow (11:59 PM) to confirm shipment.

If not shipped by deadline:
• Buyer can request cancellation
• Your $367.70 payout will be reversed
• Item may be listed as "seller non-responsive"

[MARK AS SHIPPED NOW]

Act now to avoid this.
```

### Shipment Confirmed

```
Subject: ✓ Shipment Confirmed - Payout Released!

Hi [Seller Name],

Great! We've confirmed your shipment.

Tracking: 1234567890 (Canada Post)
Payout Released: $367.70

Your funds will arrive in your bank account within 1-2 
business days.

Buyer has been notified and will be looking for their item.

Thanks for selling on StackTrackPro!

[View More Sales]
```

## Buyer Communication

### Payment Processed

```
Subject: ✓ Congratulations! You Won the Auction

Hi [Buyer Name],

You're the highest bidder! Item: Graded Pokemon Card

Final Price: $400.00
Seller: [Seller Name]

Your payment has been received. Next:
• Seller has 3 business days to ship
• We'll notify you when item ships
• You'll receive a tracking number

Question? Contact: support@stacktrackpro.com
```

### Item Shipped

```
Subject: 📦 Your Item Has Shipped!

Hi [Buyer Name],

Great news! Your item is on the way.

Carrier: Canada Post
Tracking: 1234567890
Est. Delivery: Dec 20 - Jan 5

[TRACK YOUR PACKAGE]

Seller Note: "Shipped with insurance. Handle with care!"

Questions? Contact: support@stacktrackpro.com
```

## Admin Dashboard Monitoring

### Alerts to Monitor

```
Critical Alerts:

1. Shipping Deadline Approaching
   └ Auctions not marked shipped in 2 days
   
2. Failed Transfers
   └ Stripe transfer failed - needs manual review
   
3. Disputed Shipments
   └ Buyer reported tracking not updating
   
4. Fraud Attempts
   └ Fake tracking numbers detected
   
5. Payment Processing Errors
   └ Stripe errors during charge

```

### Stats to Track

```
Daily Metrics:

• Auctions Sold: 45
• Total Sales: $18,450
• Platform Fees Collected: $922
• Average Ship Time: 1.2 days
• Non-shipped After 3 Days: 2 (4%)
• Dispute Rate: 0.5%
• Refund Rate: 1.2%

```

## Future Enhancements

1. **Carrier API Integration**: Auto-verify tracking numbers
2. **Auto-detect Delivery**: Release additional funds on delivery
3. **Insurance Option**: Seller can add shipping insurance ($2-5)
4. **Printer Integration**: Print labels directly from StackTrackPro
5. **Multi-carrier Selection**: Show lowest rates for carrier choice
6. **Scheduled Payouts**: Batch weekly or monthly payouts
7. **Payout Methods**: Bank transfer, Stripe balance, e-wallet

