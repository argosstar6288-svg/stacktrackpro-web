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
│    Status: awaiting_shipment                                │
│    Seller enters:                                           │
│      • Carrier (Canada Post, UPS, FedEx, etc.)             │
│      • Tracking number                                      │
│      • Optional shipping note                               │
│    StackTrack: Validates shipment info                      │
│    Buyer notified: "Item shipped - Track here"              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. FUNDS RELEASED                                           │
│    Status: shipped                                          │
│    StackTrack triggers Stripe transfer to seller            │
│    Seller receives: Sale Price - Platform Fee - Processing │
│    Timeline: Immediate to 1-2 business days                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BUYER RECEIVES ITEM                                      │
│    Status: delivered                                        │
│    Buyer can leave feedback                                 │
│    Dispute window opens (if needed)                         │
└─────────────────────────────────────────────────────────────┘
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
  status: 'active' | 'sold' | 'awaiting_shipment' | 'shipped' | 'delivered' | 'cancelled';
  shippingInfo?: {
    carrier: 'canada_post' | 'ups' | 'fedex' | 'dhl' | 'other';
    trackingNumber: string;
    shippedAt: Timestamp;
    estimatedDelivery?: string;     // e.g., "Dec 20 - Jan 5"
    sellerNote?: string;
  };
  
  // Payout release
  payoutInfo?: {
    released: boolean;
    releasedAt?: Timestamp;
    stripeTransferId?: string;      // Reference to Stripe transfer
    amount: number;                  // Amount transferred
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

### Seller Marks Item as Shipped

```typescript
// In seller dashboard, when they submit shipping form:

const shipAuction = async (
  auctionId: string,
  carrier: string,
  trackingNumber: string,
  note: string
) => {
  try {
    const auctionRef = doc(db, 'auctions', auctionId);
    
    // 1. Update auction with shipping info
    await updateDoc(auctionRef, {
      status: 'shipped',
      shippingInfo: {
        carrier,
        trackingNumber,
        sellerNote: note,
        shippedAt: serverTimestamp()
      }
    });
    
    // 2. Trigger Stripe transfer to seller's account
    // (This would be done server-side via Cloud Function)
    const response = await fetch('/api/auctions/release-payout', {
      method: 'POST',
      body: JSON.stringify({
        auctionId,
        sellerId: currentUser.uid,
        amount: auctionData.sellerPayoutAmount
      })
    });
    
    // 3. Update auction with payout release info
    const { stripeTransferId } = await response.json();
    
    await updateDoc(auctionRef, {
      payoutInfo: {
        released: true,
        releasedAt: serverTimestamp(),
        stripeTransferId,
        amount: auctionData.sellerPayoutAmount
      }
    });
    
    // 4. Send notifications
    await notifyBuyer(auctionId, trackingNumber, carrier);
    
  } catch (error) {
    console.error('Error shipping auction:', error);
    throw error;
  }
};
```

### Cloud Function: Release Payout

```typescript
// functions/src/index.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const db = admin.firestore();

export const releasePayoutOnShipment = functions.firestore
  .document('auctions/{auctionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if status changed to 'shipped'
    if (before.status !== 'shipped' && after.status === 'shipped') {
      const { auctionId } = context.params;
      const {
        sellerId,
        sellerPayoutAmount,
        stripeChargeId
      } = after;
      
      try {
        // Get seller's Stripe Connect account
        const sellerDoc = await db.collection('users').doc(sellerId).get();
        const sellerStripeId = sellerDoc.data()?.stripeConnectId;
        
        if (!sellerStripeId) {
          console.error('Seller has no Stripe Connect account');
          return;
        }
        
        // Create transfer from your account to seller's Stripe account
        const transfer = await stripe.transfers.create({
          amount: Math.round(sellerPayoutAmount * 100), // Convert to cents
          currency: 'cad',
          destination: sellerStripeId,
          metadata: {
            auctionId,
            sellerId,
            originalChargeId: stripeChargeId
          },
          description: `Payout for auction ${auctionId}`
        });
        
        // Update auction with transfer info
        await db.collection('auctions').doc(auctionId).update({
          'payoutInfo.stripeTransferId': transfer.id,
          'payoutInfo.released': true,
          'payoutInfo.releasedAt': admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Payout released: ${transfer.id}`);
        
      } catch (error) {
        console.error('Error releasing payout:', error);
        
        // Send alert to admin
        await db.collection('alerts').add({
          type: 'payout_failed',
          auctionId,
          error: error.toString(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  });
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

