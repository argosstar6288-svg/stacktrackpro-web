# Founding Member Lifetime Plan

## Overview

The Founding Member Lifetime Plan is a one-time payment option that grants permanent, non-recurring access to all premium features. This coexists with the existing free, pro, and premium subscription tiers.

### Role Hierarchy

```
free (0)
  ↓
pro (1)
  ↓
premium (2)
  ↓
founder (PERMANENT) ← Lifetime membership
  ↓
admin (System administrator)
moderator (Moderation staff)
```

**Key Difference:** Unlike `pro` and `premium` which are recurring subscriptions, `founder` is a permanent role that can never be downgraded automatically.

---

## Architecture

### Payment Flow

```
User clicks "Become a Founding Member"
    ↓
Frontend → Cloud Function (createCheckoutSession)
    ↓
Cloud Function creates Stripe one-time payment session
    ↓
User → Stripe Checkout (one-time charge mode, not subscription)
    ↓
User completes payment with card
    ↓
Stripe webhook → handleStripeWebhook (event: charge.succeeded)
    ↓
Cloud Function → handleChargeSucceeded()
    ↓
Check if lifetime product (metadata: productType="lifetime")
    ↓
Call handleLifetimePayment(userId, charge)
    ↓
Update Firestore user doc:
  - role: "founder"
  - subscription.tier: "founder"
  - subscription.isLifetime: true
  - subscription.lifetimeActivatedAt: now
  - subscription.lifetimeChargeId: charge.id
    ↓
Frontend detects role change → Shows founder features
    ↓
User has permanent lifetime access
```

### Data Structure

#### User Document (Firestore)

```firestore
users/{userId}
├── role: "founder"  // Can only be modified by admin
├── subscription:
│   ├── tier: "founder"
│   ├── status: "active"
│   ├── isLifetime: true  // Protected by Firestore rules
│   ├── lifetimeActivatedAt: Timestamp
│   ├── lifetimeChargeId: "ch_1234567890"
│   └── (no stripeSubscriptionId - one-time, not subscription)
├── stripeCustomerId: "cus_xxx"
└── updatedAt: Timestamp
```

#### Firestore Admin Log (Lifetime Registrations)

```firestore
admin/logs/founderRegistrations/{docId}
├── event: "lifetime_purchased"
├── userId: "user123"
├── amount: 29999  // in cents
├── currency: "usd"
├── chargeId: "ch_1234567890"
└── timestamp: Timestamp
```

#### User Payment History

```firestore
users/{userId}/payments/{paymentId}
├── type: "lifetime_purchased"
├── amount: 29999
├── currency: "usd"
├── chargeId: "ch_1234567890"
└── timestamp: Timestamp
```

---

## Implementation Details

### 1. Stripe Configuration

#### Product Setup (in Stripe Dashboard)

1. Create a new **Product**:
   - Name: "StackTrackPro Founding Member Lifetime"
   - Type: Service (not subscription)

2. Create a **Price**:
   - Billing scheme: One-time
   - Price: $299.99 USD
   - Copy the Price ID → Add to `PRICING_TIERS.LIFETIME.stripePrice`

#### Webhook Configuration

1. Navigate to Stripe Webhooks
2. Add endpoint for: `https://us-central1-stacktrackpro.cloudfunctions.net/handleStripeWebhook`
3. Subscribe to these events:
   - `charge.succeeded` (for lifetime activations)
   - `customer.subscription.created` (for recurring plans)
   - `customer.subscription.updated` (for recurring plans)
   - `customer.subscription.deleted` (for recurring plans)
   - `invoice.payment_succeeded` (for recurring payments)
   - `invoice.payment_failed` (for failed payments)
   - `charge.dispute.created` (for fraud detection)
4. Copy Webhook Signing Secret → Add to `STRIPE_WEBHOOK_SECRET` env var

### 2. Frontend: Pricing Page

**File:** `app/dashboard/pricing/page.tsx`

#### Lifetime Plan Card
- Prominent blue gradient banner at top
- "FOUNDING MEMBER" badge
- One-time price: $299.99
- All features listed (9 features total)
- CTA: "Become a Founding Member"
- Limited-time messaging

#### Billing Toggle
- Only affects Pro/Premium (monthly/annual)
- Lifetime plan always shown (no toggle)

#### Data Flow
```typescript
handleCheckout(priceId: string)
  if (priceId === LIFETIME.stripePrice)
    → mode: "payment" (not "subscription")
  else
    → mode: "subscription"
  → Cloud Function creates appropriate session
  → User redirected to Stripe checkout
```

### 3. Cloud Functions: Stripe Integration

**File:** `functions/index.js`

#### createCheckoutSession()
```javascript
// Supports both subscription and payment modes
mode: data.mode || "subscription"

if (mode === "payment") {
  // One-time charge (lifetime)
  success_url: "/dashboard/billing?lifetime=success"
  cancel_url: "/dashboard/pricing?lifetime=canceled"
} else {
  // Subscription
  success_url: "/dashboard/billing?success=true"
  cancel_url: "/dashboard/pricing?canceled=true"
}
```

#### handleStripeWebhook()
```javascript
Routes events:
- charge.succeeded → handleChargeSucceeded()
- customer.subscription.* → subscription handlers
- invoice.payment_* → payment handlers
- charge.dispute.created → handleDispute()
```

#### handleChargeSucceeded()
```javascript
// Only called for one-time charges
1. Extract userId from charge metadata or customer
2. Check if isLifetimeCharge (productType=lifetime or description contains "lifetime")
3. If lifetime:
   - Call handleLifetimePayment(userId, charge)
4. Else:
   - Log as regular charge_succeeded payment
```

#### handleLifetimePayment()
```javascript
1. Update Firestore user doc:
   - role: "founder"
   - subscription.tier: "founder"
   - subscription.isLifetime: true
   - subscription.lifetimeActivatedAt: now
   - subscription.lifetimeChargeId: charge.id

2. Log to admin lifetime registrations

3. Log to user payment history

4. Lifetime member now has permanent access!
```

#### cancelSubscription()
```javascript
// NEW PROTECTION for founders
const userDoc = await db.collection("users").doc(userId).get();
const userData = userDoc.data();

if (userData?.role === "founder" || userData?.subscription?.isLifetime) {
  throw HttpsError(
    "permission-denied",
    "Lifetime members cannot cancel. Your founding membership is permanent."
  );
}

// Continue with subscription cancellation for non-founders
```

### 4. Role Manager: Founder Role

**File:** `app/lib/roleManager.ts`

#### Type Definition
```typescript
type UserRole = "free" | "pro" | "premium" | "founder" | "admin" | "moderator"
```

#### Founder Permissions
```typescript
ROLE_PERMISSIONS.founder = {
  canCreateAuctions: true,
  canListCards: -1,           // Unlimited
  canAccessMarketplace: true,
  canAccessAnalytics: true,
  canAccessFolders: true,
  canAccessPortfolioNotes: true,
  canAccessAdvancedSearch: true,
  can2FA: true,
  canAccessAPI: true,
  advertisingFree: true,
  monthlyExportLimit: -1,     // Unlimited
}
```

#### New Functions

**isFoundingMember(userId)**
```typescript
// Returns true if user is founder or has isLifetime=true
const isFounder = await isFoundingMember(userId);
```

**safeDowngradeRole(userId, newRole)**
```typescript
// Safely downgrades users, protecting founders
const success = await safeDowngradeRole(userId, "pro");
// Returns false if user is founder (prevents downgrade)
```

**forceDowngradeRole(userId, newRole)** (Admin only)
```typescript
// Admin can force downgrade even founders
// Use with extreme caution - verify admin context first!
await forceDowngradeRole(userId, "free");
```

### 5. Firestore Security Rules

**File:** `firestore.rules`

#### New Helper Function
```firestore
function isFounder(userId) {
  return get(/databases/{database}/documents/users/$(userId)).data.role == "founder" ||
         get(/databases/{database}/documents/users/$(userId)).data.subscription.isLifetime == true;
}
```

#### User Database Protection
```firestore
match /users/{userId} {
  // User cannot modify their own role or lifetime flags
  allow write: if !request.resource.data.keys().hasAny([
    'role', 
    'customClaims', 
    'suspended',
    'subscription.isLifetime',
    'subscription.lifetimeActivatedAt'
  ]);
  
  // Only admins can modify role and lifetime data
  allow update: if isAdmin() && 
    request.resource.data.keys().hasAny(['role', 'subscription.isLifetime']);
}

// Lifetime subscription data is protected
match /users/{userId}/subscription/{doc} {
  allow write: if !request.resource.data.keys().hasAny([
    'isLifetime',
    'lifetimeActivatedAt',
    'lifetimeChargeId'
  ]);
  allow write: if isAdmin(); // Admin can modify anything
}
```

---

## Usage Examples

### Frontend: Trigger Lifetime Checkout

```typescript
import { createCheckoutSession, PRICING_TIERS } from "@/lib/stripe";

const handleLifetimeUpgrade = async () => {
  try {
    await createCheckoutSession(PRICING_TIERS.LIFETIME.stripePrice);
    // User redirected to Stripe checkout
  } catch (error) {
    console.error(error);
  }
};
```

### Check if User is Founder

```typescript
import { isFoundingMember } from "@/lib/roleManager";

const checkAccess = async (userId: string) => {
  const isFounder = await isFoundingMember(userId);
  
  if (isFounder) {
    // Grant lifetime access + exclusive features
  }
};
```

### Prevent Founder Downgrade

```typescript
import { safeDowngradeRole, getUserRole } from "@/lib/roleManager";

const downgradeUser = async (userId: string) => {
  const success = await safeDowngradeRole(userId, "free");
  
  if (!success) {
    console.log("User is a founder - cannot downgrade automatically");
  }
};
```

### Admin Force Downgrade (Extreme Case)

```typescript
import { forceDowngradeRole } from "@/lib/roleManager";

// DANGEROUS OPERATION - Only use with verified admin context
const suspendFounder = async (userId: string) => {
  // Verify user is admin first!
  if (!user.token.admin) throw new Error("Unauthorized");
  
  // Force downgrade founding member
  await forceDowngradeRole(userId, "free");
};
```

---

## Pricing

| Plan | Price | Term | Type |
|------|-------|------|------|
| Free | $0 | Forever | Free |
| Pro Monthly | $9.99 | Monthly | Recurring |
| Pro Yearly | $99.99 | Annual | Recurring |
| Premium Monthly | $29.99 | Monthly | Recurring |
| Premium Yearly | $299.99 | Annual | Recurring |
| **Lifetime** | **$299.99** | **One-time** | **Permanent** |

**Note:** Lifetime price is same as Premium Yearly for perceived value, but it's one-time instead of annual.

---

## Feature Comparison

| Feature | Free | Pro | Premium | Lifetime |
|---------|------|-----|---------|----------|
| Card Portfolio | 100 | 1,000 | Unlimited | **Unlimited** |
| Create Auctions | ❌ | ✓ | ✓ | **✓** |
| Portfolio Analytics | ❌ | ✓ | ✓ | **✓** |
| Folders | ❌ | ✓ | ✓ | **✓** |
| Advanced Search | ❌ | ✓ | ✓ | **✓** |
| REST API | ❌ | ❌ | ✓ | **✓** |
| Ad-free | ❌ | ✓ | ✓ | **✓** |
| Monthly Exports | 0 | 12 | Unlimited | **Unlimited** |
| **Early Access** | ❌ | ❌ | ❌ | **✓** |
| **Lifetime** | ❌ | ❌ | ❌ | **✓** |

---

## Error Handling

### Attempted Lifetime Cancellation

```
User calls cancelSubscription()
→ Cloud Function checks: role === "founder" || isLifetime === true
→ Throws HttpsError("permission-denied", "Lifetime members cannot cancel...")
→ Frontend displays: "Your founding membership is permanent and cannot be canceled"
```

### Attempting to Modify Lifetime Flags

```
Firestore Rule:
!request.resource.data.keys().hasAny([
  'subscription.isLifetime',
  'subscription.lifetimeActivatedAt'
])

→ Write rejected for non-admin users
→ Only admins can modify lifetime status
```

### Webhook Retry on Failure

```
handleLifetimePayment() throws error
→ Stripe webhook queued for retry
→ Retries: 5 times over 5 days
→ Max wait: 5 days after payment
→ If fails: Manual intervention required
```

---

## Testing

### Test Lifetime Checkout

1. Navigate to `/dashboard/pricing`
2. Click "Become a Founding Member"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Any expiry and CVC

### Verify Firestore Update

After successful payment:
```firestore
users/{testUserId}
├── role: "founder" ✓
├── subscription.isLifetime: true ✓
├── subscription.lifetimeActivatedAt: [timestamp] ✓
└── subscription.lifetimeChargeId: "ch_test_..." ✓
```

### Test Lifetime Protection

1. Log in as lifetime member
2. Go to `/dashboard/billing`
3. Click "Cancel Subscription"
4. Verify error: "Lifetime members cannot cancel..."

### Test Role Gating

```typescript
// In component
const permissions = await getPermissions(userId);
if (permissions.monthlyExportLimit === -1) {
  // Show "Unlimited exports" badge
}
```

---

## Production Checklist

- [ ] Create Stripe product & price in production account
- [ ] Update `PRICING_TIERS.LIFETIME.stripePrice` with production price ID
- [ ] Set `STRIPE_SECRET_KEY` to production key in Firebase Functions
- [ ] Configure Stripe webhook with production endpoint
- [ ] Set `STRIPE_WEBHOOK_SECRET` to production signing secret
- [ ] Update `SITE_URL` to `https://stacktrackpro.web.app` in Functions config
- [ ] Deploy updated Cloud Functions: `firebase deploy --only functions`
- [ ] Test end-to-end with real payment method (use Stripe test mode first)
- [ ] Monitor webhook logs for 24 hours after launch
- [ ] Set up admin notifications for lifetime purchases
- [ ] Create help docs explaining lifetime membership benefits
- [ ] Add founding member badge to user profiles
- [ ] Consider marketing: "Limited Founding Member offer"

---

## FAQ

**Q: Can founders upgrade subscriptions?**
A: No. Founders have permanent lifetime access at the highest tier. Upgrading would be redundant.

**Q: Can founders downgrade to free?**
A: No. On the Firestore level, founders cannot be automatically downgraded. Admins can force downgrade if needed (extreme cases like ToS violations).

**Q: What if a founder account is suspended?**
A: Suspended flag is separate from role. Founders can be suspended for violations while keeping their role. When unsuspended, lifetime access is restored.

**Q: Can we refund a founder?**
A: Yes, but they lose the role. Admin can:
1. Issue refund via Stripe Dashboard
2. Force downgrade user to "free" role
3. Lifetime flags remain in Firestore for audit trail

**Q: How do we count founder lifetime revenue?**
A: Check `admin/logs/founderRegistrations` collection - each charge is logged with amount and date.

**Q: Can founders gift their account?**
A: No. Lifetime membership is account-specific. Transfer via account sharing is against Terms.

**Q: What if Stripe webhook fails?**
A: Stripe retries for 5 days. If it ultimately fails, manually set user role to "founder" via Cloud Function (admin only).

---

## Security Considerations

### Lifetime Protection
```
- Firestore rules prevent user from modifying lifetime flags
- Only Cloud Functions (via webhook) or admin can set isLifetime=true
- Role cannot be modified except by admin after lifetime activation
```

### Charge Verification
```
- Cloud Function verifies Stripe webhook signature
- Prevents forged webhook events
- Charge is from Stripe, not user
```

### Metadata Tracking
```
- Charge stores firebaseUID in metadata
- Founding member is tied to specific user account
- Cannot transfer to other accounts
```

### Suspension & Moderation
```
- Founder can be suspended for ToS violations
- Suspected fraud → charge.dispute.created path
- Logs all actions for audit trail
```

---

## Monitoring & Logging

### Key Metrics
- Lifetime purchases per day
- Total lifetime revenue
- Founder account churn (if downgraded)
- Webhook failures or retries

### Logs Location
- `admin/logs/founderRegistrations` - All lifetime purchases
- `admin/logs/disputes` - Fraud/chargeback cases
- Cloud Functions dashboard - Webhook execution logs

### Alert Conditions
- Webhook failure after 5 retries
- Dispute on lifetime charge
- Unusual number of lifetime purchases from same IP
- Founder account suspended

---

## Future Enhancements

1. **Founder Community**
   - Private Discord channel for founders
   - Exclusive features voting
   - Monthly founder-only events

2. **Benefits Tier**
   - Lifetime + Premium exclusive perks
   - 10% discount referral code
   - Free official certificate

3. **Milestone Recognition**
   - Display join date on profile
   - "Original Founder" badge for early members
   - Limited NFT of founder status (optional)

4. **Loyalty Rewards**
   - Earn points for referrals
   - Exclusive gear/swag
   - Priority feature requests

---

## Troubleshooting

### Lifetime purchase doesn't activate role

**Check:**
1. Stripe webhook is configured ✓
2. `STRIPE_WEBHOOK_SECRET` is set ✓
3. Cloud Function is deployed ✓
4. Check Cloud Function logs for errors
5. Verify charge was "succeeded", not "failed"
6. Manual fix: Call `setUserSubscription` Cloud Function with tier="founder"

### User cannot checkout lifetime

**Check:**
1. `PRICING_TIERS.LIFETIME.stripePrice` is correct ✓
2. Stripe product exists ✓
3. Not using test price ID in production ✓
4. Network connection (Stripe API accessible) ✓

### "Cannot cancel lifetime" error

**This is intentional.** Recovery:
- User cannot self-cancel lifetime
- Only admin can downgrade via `forceDowngradeRole()`
- Refund via Stripe + manual admin action

---

## Stripe Dashboard References

### For Setup
- Webhook Endpoints: https://dashboard.stripe.com/webhooks
- API Keys: https://dashboard.stripe.com/apikeys
- Products & Prices: https://dashboard.stripe.com/products
- Charges: https://dashboard.stripe.com/payments/charges

### For Monitoring
- Webhook Delivery: https://dashboard.stripe.com/webhooks/[endpoint]/attempts
- Recent Charges: https://dashboard.stripe.com/payments/charges
- Disputes: https://dashboard.stripe.com/disputes
