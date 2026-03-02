# StackTrack Credit System Implementation

## Overview

The credit system enables premium features while keeping the core auction platform free and clean. Credits are a subscription benefit and purchasable add-on that unlock advanced tools for collectors.

## Core Principles

✅ **Clean Architecture**
- Two separate systems: Marketplace fees (%) and Credits (features)
- No confusion between payment types
- No legal gray areas around mandatory paid features

✅ **Optional, Not Required**
- Free users can still:
  - Create and win auctions
  - View basic card info
  - Use all core features
- Credits unlock premium tools, not core functionality

✅ **Growth Play**
- Subscription bonus credits create incentive to upgrade
- Low-friction credit purchases enable repeat monetization
- Premium features showcase value of paid tiers

## Who Can Use Credits

| User Type | Can Buy | Monthly Allowance | Purpose |
|-----------|---------|-------------------|---------|
| Free | ❌ No | 0 | Full auction access without premium tools |
| Collector | ✅ Yes | 5 credits | Affordable entry to premium features |
| Pro | ✅ Yes | 15 credits | Heavy premium tool usage |
| Lifetime | ✅ Yes | 15 credits | Maximum monthly credits + lifetime premium |

## Credit Packs & Pricing

```
Pack     Price    Per Credit    Value
10       $5       $0.50         Baseline
50       $20      $0.40         20% savings
200      $60      $0.30         40% savings
```

Bulk purchases incentivize higher spending and better unit economics.

## Premium Features (Phase 1 Launch: Premium AI Scan)

### Premium AI Card Scan (1 Credit)

**What it does:**
- Analyzes card image instantly
- Provides estimated raw value
- Calculates PSA grade estimates (Low-High range)
- Shows recent sale averages by grade
- Rates rarity level
- Displays population insight (if available)
- Gives condition guidance

**Why it's valuable:**
- Collectors want confidence in card value before bidding
- Removes guesswork from condition assessment
- Provides market data in seconds
- Directly tied to auction activity

**User Flow:**
1. Upload card image (free basic scan shown)
2. See basic identification (name, set, year)
3. See locked premium section with blurred content
4. Click "Use 1 Credit" to unlock
5. If insufficient credits → BuyCreditsModal appears
6. Results animate in with visual polish
7. Full analysis displayed with real market data

### Future Premium Features

**Market Analysis (2 credits)**
- Deep trend analysis
- Price history graphs
- Seasonality insights
- Grading distribution data

**Grading Probability Prediction (3 credits)**
- ML model predicts grading outcomes
- Current grade guidance
- What condition improvements would help
- Grading service recommendations

## Technical Implementation

### Core System (lib/credits.ts)

```typescript
// Deduct credits BEFORE running feature
await deductCredits(userId, 1, 'premium_scan', { cardId });

// Add credits from purchase
await addCredits(userId, 50, 'stripe_purchase', { packId, stripePaymentId });

// Check affordability
const { canAfford, currentCredits } = await canAffordFeature(userId, 1);

// Get balance
const { credits } = await getUserCredits(userId);

// Award monthly bonus
await awardMonthlyCredits(userId, 'collector'); // Awards 5 credits
```

### Database Schema

**Users Collection** (add fields)
```typescript
{
  uid: string;
  email: string;
  subscriptionTier: 'free' | 'starter' | 'collector' | 'pro' | 'lifetime';
  credits: number;           // NEW: Current balance
  lastMonthlyAward: Date;   // NEW: Track when monthly credits awarded
  // ... existing fields
}
```

**Credit Transactions Collection** (new)
```typescript
{
  userId: string;
  action: 'premium_scan' | 'credit_purchase' | 'subscription_monthly';
  creditsUsed?: number;      // For purchases/awards
  creditsBefore: number;
  creditsAfter: number;
  source?: string;           // 'stripe_purchase', 'subscription_monthly'
  metadata: {
    cardId?: string;         // For scans
    packId?: string;         // For purchases (pack_10, pack_50, pack_200)
    stripePaymentId?: string; // Payment tracking
    tier?: string;           // For monthly awards
  };
  createdAt: Timestamp;
}
```

### Security Rules

**Firebase Firestore Security Rules**
```typescript
// Users can only read/update their own credits
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId 
    && !request.resource.data.credits; // Can't update credits directly
}

// Users can only read their own transactions
match /creditTransactions/{docId} {
  allow read: if request.auth.uid == resource.data.userId;
  allow create: if request.auth.uid == request.resource.data.userId;
}
```

## Component Hierarchy

### CreditBalance.tsx
- Displays current credit count
- Shows in header/navbar
- Real-time refresh every 30s
- Emoji + count styling

```tsx
<CreditBalance size="medium" showLabel={true} />
// Output: 💳 24 Credits
```

### BuyCreditsModal.tsx
- Radio selection of packs
- Shows savings percentage
- Stripe integration (TODO)
- Non-refundable terms

```tsx
<BuyCreditsModal 
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSuccess={(creditsAdded) => console.log('Got', creditsAdded, 'credits')}
  reason="Not enough credits for premium scan"
/>
```

### PremiumScanUnlock.tsx
- Locked section with blurred content
- "🔒 Unlock Premium Analysis" overlay
- "Use 1 Credit" button
- Animated reveal on unlock
- Shows all premium data in grid layout

```tsx
<PremiumScanUnlock
  cardName="Charizard ex"
  onUnlock={async () => runPremiumScan(userId, imageUrl)}
  cost={1}
  canAfford={currentCredits >= 1}
  currentCredits={currentCredits}
/>
```

## Integration Checklist

### Phase 1: Setup
- [ ] Add `credits` field to users collection
- [ ] Create `creditTransactions` collection
- [ ] Deploy credit system utilities (lib/credits.ts)
- [ ] Create UI components (Balance, Modal, Unlock)

### Phase 2: Premium AI Scan
- [ ] Integrate with AI card scan endpoint
- [ ] Add PremiumScanUnlock to card view page
- [ ] Test full flow: scan → unlock → analyze
- [ ] Set up Stripe payment integration
- [ ] Monitor credit usage and revenue

### Phase 3: Monitoring
- [ ] Dashboard showing credit sales/usage
- [ ] Per-user credit lifetime value tracking
- [ ] Feature usage analytics
- [ ] Monthly credit award automation

## Revenue Models

### Model 1: Direct Sales
- Users buy credit packs
- $5-$60 per pack
- Immediate revenue

### Model 2: Subscription Bonus
- Collectors: 5 free credits/month
- Pro: 15 free credits/month
- Drives subscription value
- Creates repeat purchases (users burn bonus, buy more)

### Model 3: Feature Addiction
- Premium scan takes 1 credit
- User does 10 scans = $4.00
- Repeat monthly = $48/year per user
- Scale to 1,000 users = $48k/year

## Abuse Prevention

### Rate Limiting
- Free users: 5 basic scans/day
- Paid users: 50 premium scans/day
- Prevents rapid-fire abuse

### Validation
- Image URL validation before processing
- Check image size/format
- Prevent duplicates (same card scanned twice)
- NSFW filtering (optional)

### Credit Deduction Timing
- **Critical**: Always deduct BEFORE running feature
- Prevents exploits where user cancels mid-process
- Use Firebase transactions for atomicity

## Monitoring & Analytics

### Metrics to Track

```typescript
// Daily
- Credits sold (units)
- Revenue from credit sales
- Premium features used per day
- Average credits per user

// Monthly
- Credit pack preferences (which pack sells most?)
- Feature usage distribution
- Monthly credit award completion rate
- Churn impact on subscription tier

// Per-User
- Lifetime credits purchased
- Lifetime credits earned (bonus)
- Features used count
- Cost per feature use
```

### Dashboard Queries

```typescript
// Top spenders on credits
SELECT userId, SUM(creditsAdded) as totalPurchased
FROM creditTransactions
WHERE source = 'stripe_purchase'
GROUP BY userId
ORDER BY totalPurchased DESC
LIMIT 20

// Most popular feature
SELECT action, COUNT(*) as uses
FROM creditTransactions
WHERE action LIKE '%premium%'
GROUP BY action
ORDER BY uses DESC

// Revenue this month
SELECT SUM((creditsAdded / pricePer) * (pricePer * cost))
FROM creditTransactions
WHERE createdAt > startOfMonth AND source = 'stripe_purchase'
```

## Payment Integration (Stripe)

### Webhook Endpoint
```typescript
POST /api/credits/webhook

{
  type: 'charge.succeeded',
  data: {
    object: {
      customer: stripeCustomerId,
      amount: 5000, // $50.00
      metadata: {
        packId: 'pack_50',
        credits: 50,
        userId: 'uid_12345'
      }
    }
  }
}
```

### Handling
1. Verify webhook signature
2. Extract userId and credits from metadata
3. Call `addCredits(userId, credits, 'stripe_purchase', { ... })`
4. Return 200 OK
5. Stripe retries on error

## Edge Cases & Solutions

### Problem: User runs out of credits mid-scan
**Solution:** Deduct BEFORE scanning, show error if insufficient

### Problem: User buys credits, doesn't appear instantly
**Solution:** Webhook delay (Stripe → server → database). Show "Processing your purchase, credits arriving momentarily"

### Problem: Monthly credits awarded twice
**Solution:** Track `lastMonthlyAward` timestamp, check before awarding

### Problem: User upgrades subscription, should get new tier credits
**Solution:** When subscription updates, check if new tier has more monthly, award difference

### Problem: Credits expire/reset
**Solution:** Clear messaging: "Credits do not expire" - build it into contract

## Legal/Compliance

### Terms Required

```
Credits Terms of Service
✓ Non-refundable
✓ No cash value (cannot withdraw as money)
✓ Do not expire
✓ No warranty on AI scan accuracy (best effort)
✓ Subscription credits: valid only during active subscription
✓ No transfer between accounts
```

### Fraud Prevention
- Link credits to user account only
- Validate card/payment method
- Monitor for chargebacks
- Implement velocity limits (max $X purchased per day)

## Launch Checklist

- [ ] Core credit system deployed and tested
- [ ] Premium AI scan integrated
- [ ] Stripe payment integration working
- [ ] UI components styled and responsive
- [ ] CreditBalance showing in navbar
- [ ] BuyCreditsModal accessible
- [ ] PremiumScanUnlock integrated into card view
- [ ] Database transactions logging correctly
- [ ] Monthly credit awards automated
- [ ] Analytics dashboard functional
- [ ] Error handling comprehensive
- [ ] Terms of service added
- [ ] Support documentation updated
- [ ] Beta test with 10-20 users
- [ ] Collect feedback on pricing
- [ ] Monitor chargeback rates
- [ ] Adjust pack pricing if needed

## Success Metrics (Target)

- **Month 1:** 5% of paying users try credits
- **Month 3:** 15% of paying users have purchased credits
- **Month 6:** 25% of Pro users spending $20+/month on credits
- **Year 1:** $50k+ in credit revenue

---

**Status:** Ready for development  
**Priority:** High (second revenue stream)  
**Effort:** 2-3 weeks integration + AI endpoint work
