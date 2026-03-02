# StackTrackPro Platform Fees

## 5.1 Fee Structure

### Listing Fees
- **Free for first 10 auctions/month** per seller
- Additional listings beyond 10: $1.00 per auction (optional)

### Success Fee
- **15% of final sale price** on completed auctions
- Applied only when auction successfully sells
- Calculated on hammer price (winning bid amount)

### Payment Processing Fee
- **2.9% + $0.30** per transaction
- Charged by Stripe for payment processing
- Applied to each successful transaction

### Featured Listings (Optional)
- **$5.00 per auction** to feature in "Featured" section
- Optional premium feature
- Increases listing visibility
- Can be applied at auction creation or edit

---

## 5.2 Fee Collection

### Seller Payout Calculation

**Example Transaction:**
```
Winning Bid Amount:          $100.00
Platform Success Fee (15%):  -$15.00
Stripe Processing (2.9%+$0.30): -$3.20
Featured Listing (optional): -$5.00 (if selected)
─────────────────────────────────
Seller Receives:             $76.80
```

### Fee Deduction Process

1. **All fees deducted automatically** from seller payout
   - Never charged to seller separately
   - Deducted at time of payout request
   - Transparent on payout summary

2. **Buyers pay no additional fees**
   - Winning bid = Final price
   - No buyer premium or platform fee for buyers
   - Payment processing fee absorbed by platform initially

3. **Refund Policy**
   - If auction is refunded, proportional fees refunded
   - Success fee: Fully refunded if sale reversed
   - Processing fee: 2.9% + $0.30 refunded if payment reversed
   - Featured fee: Refunded if listing featured less than 24 hours

---

## 5.3 Implementation Details

### Fee Calculation Functions

```typescript
// Calculate success fee
function calculateSuccessFee(finalBidAmount: number): number {
  return finalBidAmount * 0.15; // 15% of final sale
}

// Calculate Stripe processing fee
function calculateProcessingFee(amount: number): number {
  return (amount * 0.029) + 0.30; // 2.9% + $0.30
}

// Calculate listing fee (if applicable)
function calculateListingFee(auctionCount: number): number {
  // First 10 per month: Free
  if (auctionCount <= 10) return 0;
  // Additional: $1.00 each
  return (auctionCount - 10) * 1.00;
}

// Calculate featured listing fee (optional)
function calculateFeaturedFee(isFeatured: boolean): number {
  return isFeatured ? 5.00 : 0;
}

// Calculate total seller payout
function calculateSellerPayout(
  finalBidAmount: number,
  isFeatured: boolean = false,
  auctionCount: number = 1
): {
  gross: number;
  successFee: number;
  processingFee: number;
  listingFee: number;
  featuredFee: number;
  net: number;
} {
  const gross = finalBidAmount;
  const successFee = calculateSuccessFee(gross);
  const processingFee = calculateProcessingFee(gross);
  const listingFee = calculateListingFee(auctionCount);
  const featuredFee = calculateFeaturedFee(isFeatured);
  
  const net = gross - successFee - processingFee - listingFee - featuredFee;
  
  return {
    gross,
    successFee,
    processingFee,
    listingFee,
    featuredFee,
    net
  };
}
```

### Payout Request Model

```typescript
interface PayoutRequest {
  id: string;
  userId: string;
  amount: number; // Net amount after all fees
  
  // Fee breakdown
  grossAmount: number;
  successFees: number;
  processingFees: number;
  listingFees: number;
  featuredFees: number;
  
  // Stripe details
  stripeConnectId: string;
  payoutMethodId?: string;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  
  // Included auctions
  auctionIds: string[];
  
  // Notes
  notes?: string;
}
```

### Firestore Collections

```
/users/{userId}/payouts/{payoutId}
├── amount: number (net payout)
├── grossAmount: number
├── successFees: number
├── processingFees: number
├── listingFees: number
├── featuredFees: number
├── status: string
├── createdAt: Timestamp
└── ...

/sellers/{userId}/earnings
├── totalEarnings: number (lifetime)
├── pendingBalance: number (unreleased)
├── processedPayouts: number (total paid out)
├── monthlyAuctionCount: number
├── stripeConnectId: string
└── ...

/auctions/{auctionId}
├── ...
├── finalBidAmount: number
├── isFeatured: boolean
├── fees: {
│   success: number
│   processing: number
│   listed: number
│   featured: number
│   total: number
│ }
└── ...
```

---

## 5.4 Display to Users

### On Auction Creation
```
Featured Listing:           ○ No  ● Yes (+$5.00)
Listing Fee:                Free (1st-10th this month)
─────────────────────────────────────────────
If you sell for:           $100.00
You'll receive (est.):      ~$81.80
(After 15% platform fee + 2.9% processing + featured)
```

### On Payout Page
```
Pending Balance:            $1,234.56

Breakdown of Earnings:
├─ Total Sales:            $2,500.00
├─ Platform Fees (15%):    -$375.00
├─ Processing Fees:        -$72.50
├─ Featured Listings:      -$10.00
├─ Listing Fees:           $0.00 (within free tier)
└─ Your Balance:           $1,042.50
```

### On Payout Request
```
Requesting Payout of:       $500.00
From auctions:              3 auctions
Fee breakdown visible:      
├─ Success Fee (15%):       -$92.40
├─ Processing (2.9%):       -$15.70
└─ Net to you:              $391.90
```

---

## 5.5 Admin Features

### Fee Management
- View all fees collected this month/year
- Track total platform revenue from fees
- Monitor fee distribution:
  - % from success fees
  - % from processing fees
  - % from featured listings
  - % from listings

### Fee Analytics
```
Platform Revenue (Last 30 Days):
├─ Success Fees:           $12,400 (68%)
├─ Processing Fees:        $4,200 (23%)
├─ Featured Listings:      $950 (5%)
├─ Listing Fees:           $450 (4%)
└─ Total Revenue:          $18,000

Seller Payouts:            $68,200
Platform Earnings:         $18,000
Overall GMV:               $86,200
```

### Fee Adjustments
- Discount success fee for high-volume sellers (per policy)
- Waive listing fees for premium members
- Promotional featured listing period
- Refund disputes on fees if applicable

---

## 5.6 Stripe Connect Integration

Stripe Connect enables:
- Direct payouts to seller bank accounts
- Payment processing fee passed through
- Automatic fee calculations
- Webhook-based payout tracking
- 1099-K reporting at $20k+ yearly

### Seller Stripe onboarding:
1. User clicks "Connect Stripe" in settings
2. Redirected to Stripe Connect OAuth
3. Complete bank account verification
4. Account linked to StackTrackPro
5. Payouts automatically sent to bank account

---

## 5.7 Tax Considerations

- **1099-K Reporting**: Required if seller earnings > $20k/year
- **Sales Tax**: Platform does not charge sales tax (seller responsibility)
- **Income Tax**: All earnings are taxable income
- **Users informed**: Clear disclosure in Terms of Service

---

## 5.8 Fee Disclosures

### Required Disclosures
- All fees disclosed before checkout
- Seller receives detailed payout breakdown
- Buyer sees final price (no surprises)
- Monthly statements available to sellers

### Where Fees Shown
1. **Auction creation form** - Listing fee & featured fee
2. **Bidding page** - Final price (no buyer fees)
3. **Post-sale payout preview** - All deductions
4. **Payout request form** - Net amount clear
5. **Seller dashboard** - Fee summary & history
6. **User profile** - Fee disclosure link

---

## 5.9 Future Fee Options

Potential future features:
- **Tiered success fees** (10% for Pro, 8% for Premium)
- **Volume discounts** (reduced fee for 50+ auctions/month)
- **Promotional periods** (waived fees for new sellers)
- **Premium seller badges** ($9.99/month for badge + 12% fee)
- **Auction reserve protection** ($2 per auction with reserve)

