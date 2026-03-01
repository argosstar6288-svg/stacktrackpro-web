# Lifetime Cap & Referral System

## Overview

The Founding Member program features three interconnected systems:

1. **Limited Lifetime Slots** - Only 50 Founding Members can be created
2. **Referral Bonus System** - Earn $50 store credit per successful referral
3. **Founding Wall Leaderboard** - Public recognition of founders and top referrers

---

## System Architecture

### Lifetime Slot Cap (50 Total)

```
Hard Cap: 50 lifetime members max
Soft Cap: 25 members → display "limited slots" warning
Status Display:
  0-24 slots: ✓ X slots available
  25-49 slots: ⚠️ Limited availability warning  
  50 slots: ❌ FULL
```

**Enforcement Level:** Backend (Cloud Functions)
- Checked before checkout session created
- Double-checked when charge is processed
- Prevents race conditions via counter increment

### Referral Code System

**Structure:** 8 alphanumeric characters (e.g., `ABC123XY`)

**Generation:**
- Automatically generated when user becomes founder
- Unique per founder (collision prevention)
- Stored in Firestore user document
- Shareable via copy-to-clipboard button

**Usage:**
- Optional field during lifetime checkout
- Validated server-side
- Only valid if referrer is a founder
- Triggers bonus award on payment success

### Bonus Distribution

**Per Successful Referral:**
- Referrer gets: **$50 store credit**
- Referred user gets: **$50 discount** (encoded in referral tracking)

**Tracking:**
- Logged in `users/{userId}/referrals` subcollection
- Status: pending → completed (when referee becomes founder)
- Bonus awarded automatically via webhook

---

## Data Structure

### System Counter (admin/system)

```firestore
admin/system
├── lifetimePurchaseCount: number (0-50)
├── lastLifetimePurchaseAt: Timestamp
└── (other system flags)
```

### User Document (users/{userId}) - Founder Only

```firestore
users/{userId}
├── role: "founder"
├── subscription.isLifetime: true
├── subscription.lifetimeActivatedAt: Timestamp
├── subscription.lifetimeChargeId: "ch_xxx"
├── referralCode: "ABC123XY"
├── referralCodeCreatedAt: Timestamp
├── referralStats:
│   ├── totalReferrals: 5
│   ├── completedReferrals: 3
│   ├── totalBonusEarned: 15000 (cents, $150)
│   └── lastBonusAt: Timestamp
├── account:
│   └── storeCredit: 15000 (cents, $150)
└── (other user fields)
```

### Referral Subcollection

```firestore
users/{referrerId}/referrals/{referralId}
├── referredUserId: "uid_xxx"
├── referralCode: "ABC123XY"
├── status: "completed" | "pending"
├── bonusAwarded: true
├── createdAt: Timestamp
└── completedAt: Timestamp
```

### Founder Registration Log

```firestore
admin/logs/founderRegistrations/{docId}
├── event: "lifetime_purchased"
├── userId: "uid_xxx"
├── amount: 29999 (cents)
├── currency: "usd"
├── chargeId: "ch_xxx"
├── referralCode: "ABC123XY" (their code)
├── referredBy: "ABC123YZ" (code used, if any)
├── slotNumber: 25 (which slot: 1-50)
└── timestamp: Timestamp
```

### Referral Bonus Log

```firestore
admin/logs/referralBonuses/{docId}
├── event: "bonus_awarded"
├── referrerId: "uid_xxx"
├── referredUserId: "uid_yyy"
├── bonusAmount: 5000 (cents, $50)
└── timestamp: Timestamp
```

---

## Frontend Architecture

### Pricing Page

**Lifetime Card Features:**

1. **Slot Availability Display**
   - Shows count: `25 / 50` or `Limited slots!`
   - Grayed out if capped (no checkout possible)
   - Real-time updates from Firestore

2. **Referral Code Input** (if not founder yet)
   - Optional field: "Have a referral code?"
   - Uppercase conversion
   - Passed to Cloud Function

3. **Founder Stats Section** (if already founder)
   - Display their unique referral code
   - Copy-to-clipboard button
   - Stats:
     - Total referrals made
     - Bonuses earned ($XX.XX)
     - Store credit available

4. **Call-to-Action Button**
   - Disabled if slots capped
   - Shows "Slots Full" message when capped
   - Shows "Processing..." during checkout

### Founding Wall Page (`/dashboard/founding-wall`)

**Public Leaderboard:**
- Lists all 50 founders (or fewer if not full)
- Sorted by join date (newest first)
- Columns:
  - Slot number (#1 / #50)
  - Name (first + last)
  - Join date
  - Referrals completed (count)
  - Bonus earned ($XXX.XX)
  - Referral code (click to copy)

**Statistics Cards:**
- Total founding members
- Total referrals made (across all founders)
- Total bonuses distributed

**How It Works Section:**
- Explains referral program
- Benefits list (lifetime, early access, badge, support, earn $50/referral, featured on wall)

---

## Backend Implementation

### 1. Checkout Validation

**File:** `functions/index.js` → `createCheckoutSession()`

```javascript
// Check lifetime cap BEFORE creating Stripe session
const isLifetime = (mode === "payment");

if (isLifetime) {
  const systemDoc = await db.collection("admin").doc("system").get();
  const currentCount = systemDoc.data()?.lifetimePurchaseCount || 0;
  
  if (currentCount >= 50) {
    throw HttpsError(
      "resource-exhausted",
      "Founding Member slots are full..."
    );
  }
}

// Include referral code in session metadata
metadata: {
  referralCode: referralCode || "",
}
```

**Why:** Prevents users getting to Stripe checkout if slots full

### 2. Webhook Processing

**File:** `functions/index.js` → `handleChargeSucceeded()`

```javascript
// 1. Extract userId from charge metadata
// 2. Detect if lifetime charge (productType="lifetime")
// 3. Call handleLifetimePayment(userId, charge)
```

### 3. Lifetime Payment Handler

**File:** `functions/index.js` → `handleLifetimePayment()`

```javascript
async function handleLifetimePayment(userId, charge) {
  // 1. Increment counter (atomic check-then-increment)
  const currentCount = systemDoc.data().lifetimePurchaseCount;
  if (currentCount >= 50) throw Error("Cap exceeded");
  
  // 2. Generate unique referral code
  const code = generateReferralCodeServer();
  
  // 3. Upgrade user to founder
  update user doc with:
    - role: "founder"
    - subscription.isLifetime: true
    - referralCode: code
    - referralStats initialized
  
  // 4. Process referral bonus (if code used)
  if (charge.metadata.referralCode) {
    await processReferralBonus(userId, referralCode, now);
  }
  
  // 5. Log to admin (slot number = current count + 1)
  log to founderRegistrations
  
  // 6. Increment counter
  update system doc:
    - lifetimePurchaseCount += 1
}
```

### 4. Referral Bonus Processor

**File:** `functions/index.js` → `processReferralBonus()`

```javascript
async function processReferralBonus(newUserId, referralCode, now) {
  // 1. Find referrer by code
  const referrer = db.collection("users")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get();
  
  if (empty) return; // Invalid code
  
  // 2. Record referral in referrer's subcollection
  add to users/{referrerId}/referrals:
    - referredUserId
    - status: "completed"
    - bonusAwarded: true
  
  // 3. Award bonus to referrer
  update referrer doc:
    - referralStats.completedReferrals += 1
    - referralStats.totalBonusEarned += 5000
    - account.storeCredit += 5000
  
  // 4. Log bonus award
  add to admin/logs/referralBonuses
}
```

---

## Security & Validation

### Server-Side Enforcement

✅ **Slot Cap Check**
- Verified at checkout creation
- Verified again at charge processing
- Counter is source of truth

✅ **Referral Code Validation**
- Must exist in Firestore
- Referrer must have role="founder"
- Case-insensitive matching (stored uppercase)

✅ **Atomic Operations**
- Increment is checked-then-updated (could race at scale)
- In production: use Cloud Firestore transactions

✅ **Webhook Signature Verification**
- Stripe signature validated before processing
- Prevents forged webhook events
- Charge amount verified

### Client-Side Safeguards

⚠️ **Slot Availability Display**
- Shows real-time count (may be stale)
- Checkout will fail if capped anyway
- Button disabled if capped

⚠️ **Referral Code Input**
- Optional (no validation needed)
- Server validates during payment processing
- If invalid, referral is skipped (doesn't fail checkout)

---

## Frontend Usage

### Check Slot Availability

```typescript
import { getLifetimeStats } from "@/lib/lifetimeCap";

const stats = await getLifetimeStats();
if (stats.isCapped) {
  // Show "slots full" message
} else if (stats.isNearCap) {
  // Show "limited slots" warning
}
```

### Use Referral Code During Checkout

```typescript
import { createCheckoutSession, PRICING_TIERS } from "@/lib/stripe";

const referralCode = "ABC123XY"; // from user input
await createCheckoutSession(
  PRICING_TIERS.LIFETIME.stripePrice,
  referralCode // optional
);
```

### Display Founder Referral Code

```typescript
import { getUserReferralCode, getReferralStats } from "@/lib/referral";

const code = await getUserReferralCode(userId);
const stats = await getReferralStats(userId);

console.log(`Share code: ${code}`);
console.log(`Referrals: ${stats.completedReferrals}, Bonus: $${stats.totalBonusEarned / 100}`);
```

### View Founding Wall

Navigate to `/dashboard/founding-wall`

---

## Testing

### Test Slot Availability

1. Check `admin/system.lifetimePurchaseCount` in Firestore
2. Manually set to 49
3. Try to checkout lifetime → should succeed
4. Check again, should be 50
5. Try to checkout again → should fail with "Slots Full"

### Test Referral Code

**Happy Path:**
1. User A becomes founder (gets code: `ABC123XY`)
2. User B tries to checkout lifetime with code `ABC123XY`
3. User B pays successfully
4. Check Firestore:
   - User B has role="founder" ✓
   - User A has `referralStats.completedReferrals = 1` ✓
   - User A has `account.storeCredit = 5000` ($50) ✓
5. Check admin logs: `referralBonuses` collection has entry ✓

**Invalid Code Path:**
1. User C tries to checkout with invalid code `INVALID00`
2. Payment succeeds normally
3. User C has role="founder" ✓
4. Referral bonus not awarded (code didn't match) ✓

### Test Slot Performance

1. Set `lifetimePurchaseCount` to 48
2. Start 3 simultaneous checkout requests
3. Expected: 2 succeed, 1 fails with "slots full"
   - Due to race condition in current implementation
   - In production: implement Firestore transaction

---

## Production Checklist

- [ ] Set LIFETIME_CAP = 50 in Stripe product settings
- [ ] Create foundation/system doc in Firestore with lifetimePurchaseCount = 0
- [ ] Deploy updated Cloud Functions
- [ ] Verify Stripe webhook configured (charge.succeeded event)
- [ ] Test slot cap enforcement
- [ ] Test referral code flow
- [ ] Deploy updated Next.js frontend (includes Founding Wall)
- [ ] Create marketing copy for referral program
- [ ] Set up email notifications for:
  - User becomes founder (include referral code)
  - User earns referral bonus (show store credit balance)
- [ ] Monitor webhook logs for failures
- [ ] Set up alerts for cap reached (slot #50)

---

## Monitoring & Metrics

### Key Metrics

**Slots:**
- `/admin/dashboard` - Show current slots filled
- Alert when slots > 45 (nearing full)
- Alert when slots = 50 (full)

**Referrals:**
- Count of completed referrals (sum across all users)
- Average referrals per founder
- Total bonuses distributed

**Performance:**
- Average checkout time
- Stripe session creation time
- Webhook processing time

### Logs to Monitor

```firestore
admin/logs/founderRegistrations
  ✓ New founder entry per purchase
  ✓ Check slotNumber field (should be sequential)
  ✓ Verify referredBy field when referral code used

admin/logs/referralBonuses
  ✓ Bonus awarded entries
  ✓ Verify amounts ($50 each = 5000 cents)
  ✓ Track referrer → referee relationships
```

---

## FAQ

**Q: What if the 50th slot is purchased twice simultaneously?**
A: Race condition exists. Both would see count=49, both would increment. In production, use Firestore transactions to ensure atomicity.

```javascript
// Production-safe version:
const transaction = await db.runTransaction(async (t) => {
  const systemRef = doc(db, "admin", "system");
  const systemDoc = await t.get(systemRef);
  const count = systemDoc.data().lifetimePurchaseCount;
  
  if (count >= 50) throw new Error("Slots full");
  
  t.update(systemRef, { lifetimePurchaseCount: count + 1 });
  return count + 1;
});
```

**Q: Can a founder revoke their referral code?**
A: Not currently. Code is permanent. Could add feature to refresh code, but would break old shared links.

**Q: What if someone buys lifetime with a fake/typo referral code?**
A: Payment succeeds, no referral bonus awarded. Error is logged but doesn't fail transaction.

**Q: Can a user use their own referral code?**
A: No, they can't use their own code to get bonus (would be fraud). Server validates referral before payment.

Could add check: `if (referrerId === newUserId) return;` to prevent self-referral.

**Q: What if store credit is added but not used?**
A: Stays in account forever. Could set expiry (e.g., 1 year) if desired.

**Q: How are slots numbered?**
A: Sequentially by join date. User #1 joined first, User #50 is last. Slot number is logged in `founderRegistrations`.

---

## Future Enhancements

1. **Tiered Referral Bonuses**
   - $50 for first referral
   - $75 for 5th referral
   - $100 for 10th+ referral
   
2. **Referral Leaderboard**
   - Sort Founding Wall by # of referrals
   - "Top Referrer of Month" badge
   
3. **Store Credit Usage**
   - Allow $50 credit toward Pro or Premium upgrade
   - Implement discount code system
   - Track redemptions

4. **Referral Analytics**
   - Dashboard showing referral performance
   - Conversion rates by source
   - A/B test different referral messages

5. **Viral Mechanics**
   - Bonus for being referred by another founder
   - Tiered discounts for group referrals
   - Referral streak bonuses

---

## Maintenance

### Annual Tasks

- [ ] Review slot cap (consider increasing if oversubscribed)
- [ ] Analyze referral program effectiveness
- [ ] Audit store credit redemptions
- [ ] Update marketing messaging based on adoption

### Quarterly Tasks

- [ ] Check for referral code collisions (should be near-zero)
- [ ] Verify webhook delivery success rate
- [ ] Review support tickets related to referrals
- [ ] Update Founding Wall styling/features
