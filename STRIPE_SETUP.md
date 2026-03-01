# Stripe Subscription Integration Guide

## Overview

Complete Stripe integration for StackTrackPro allowing users to upgrade from Free to Pro or Premium tiers. The system handles:
- Stripe Checkout sessions
- Webhook processing
- User role updates
- Payment management
- Subscription lifecycle (create, update, cancel, reactivate)

---

## 🏗️ Architecture

```
User Flow:
User Clicks "Upgrade" 
    ↓
Frontend calls Cloud Function (createCheckoutSession)
    ↓
Cloud Function creates Stripe Checkout session
    ↓
User redirected to Stripe checkout
    ↓
User enters payment info & pays
    ↓
Stripe sends webhook event (customer.subscription.created)
    ↓
Cloud Function (handleStripeWebhook) processes event
    ↓
Firestore user document updated with new role
    ↓
Frontend detects role change, shows new features
    ↓
✓ Subscription active
```

---

## 🔧 Setup Instructions

### 1. **Install Dependencies**

```bash
cd functions
npm install
```

Installed packages:
- `firebase-admin` - Backend Firebase access
- `firebase-functions` - Cloud Functions SDK
- `stripe` - Stripe API client
- `cors` - Cross-origin requests

### 2. **Set Environment Variables**

Create `.env` file in `/functions` directory:

```bash
# Get these from Stripe Dashboard
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Optional
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLIC_KEY
```

To find these:
1. Go to https://dashboard.stripe.com
2. Login to your account
3. Go to Developers → API Keys
4. Copy "Secret Key" and "Publishable Key"

### 3. **Deploy Cloud Functions**

```bash
firebase deploy --only functions
```

This deploys:
- `createCheckoutSession` - Creates checkout session
- `handleStripeWebhook` - Processes Stripe webhooks
- `cancelSubscription` - Cancel subscription
- `reactivateSubscription` - Reactivate canceled subscription
- `getPortalSession` - Open Stripe billing portal

### 4. **Configure Stripe Webhook**

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your Cloud Function URL:
   ```
   https://us-east1-stacktrackpro.cloudfunctions.net/handleStripeWebhook
   ```
4. Select events to receive:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.dispute.created` (optional)
5. Click "Add endpoint"
6. Copy the "Signing secret" to `.env` as `STRIPE_WEBHOOK_SECRET`

### 5. **Create Stripe Products & Prices**

1. Go to https://dashboard.stripe.com/products
2. Create 4 products:
   ```
   - Pro (Monthly)     $9.99/mo
   - Pro (Yearly)      $99.99/yr
   - Premium (Monthly) $29.99/mo
   - Premium (Yearly)  $299.99/yr
   ```
3. Copy the Price IDs (price_xxx) and update in `app/lib/stripe.ts`:
   ```typescript
   PRICING_TIERS: {
     PRO_MONTHLY: {
       stripePrice: "price_1Pu0a1ABC123456789AB" // ← Update
     }
   }
   ```

### 6. **Update Firestore Rules**

Add webhook security rule:

```firestore
match /webhooks/{document=**} {
  allow read, write: if false; // Only Cloud Functions can write
}
```

---

## 📱 Frontend Usage

### Display Pricing Page

Access `/dashboard/pricing` to show all plans with:
- Monthly/Yearly toggle
- Feature comparison
- CTA buttons for each plan
- FAQ section

### Handle Upgrade Flow

```typescript
import { createCheckoutSession, PRICING_TIERS } from "@/lib/stripe";

// User clicks "Upgrade to Pro"
const handleUpgrade = async () => {
  try {
    await createCheckoutSession(PRICING_TIERS.PRO_MONTHLY.stripePrice);
    // User redirected to Stripe checkout
  } catch (error) {
    console.error(error.message);
  }
};
```

### Show Current Subscription Status

```typescript
import { useCurrentUser } from "@/lib/useCurrentUser";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const currentUser = useCurrentUser();
const userDoc = await getDoc(doc(db, "users", currentUser.user.uid));
const subscription = userDoc.data()?.subscription;

console.log(subscription.tier); // "free" | "pro" | "premium"
console.log(subscription.status); // "active" | "canceled" | "past_due"
```

### Manage Subscription

```typescript
import { 
  cancelSubscription, 
  reactivateSubscription,
  getPortalSession 
} from "@/lib/stripe";

// Cancel subscription (ends at period end, not immediately)
await cancelSubscription();

// Reactivate a canceled subscription
await reactivateSubscription();

// Open Stripe billing portal (manage payment methods, view invoices)
const portalUrl = await getPortalSession();
window.location.href = portalUrl;
```

---

## 🔐 Security

### Webhook Verification

All webhooks are signed by Stripe. The `handleStripeWebhook` function verifies:
```typescript
const sig = req.headers["stripe-signature"];
const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
```

This ensures requests are actually from Stripe.

### Data Protection

- Secret keys never exposed to frontend
- Cloud Functions run in secure environment
- Stripe handles all PCI compliance (payment data)
- User IDs stored in Stripe metadata

### User Verification

All Cloud Functions check user authentication:
```typescript
if (!context.auth) {
  throw new functions.https.HttpsError(
    "unauthenticated",
    "Must be logged in"
  );
}
```

---

## 📊 Firestore Data Structure

### User Document
```javascript
{
  uid: "user123",
  email: "user@example.com",
  
  stripeCustomerId: "cus_123abc", // Stripe customer ID
  
  subscription: {
    tier: "pro",                           // free | pro | premium
    status: "active",                      // active | canceled | past_due
    stripeSubscriptionId: "sub_456def",    // Stripe subscription ID
    stripeCustomerId: "cus_123abc",        // Duplicate for queries
    renewalDate: Timestamp(...),           // Next billing date
    cancellationDate: Timestamp(...),      // When canceled
  },
  
  // Payment history subcollection
  // /users/{userId}/payments/{paymentId}
  //   stripeInvoiceId
  //   amount
  //   currency
  //   status
  //   paidAt
}
```

---

## 🎯 Webhook Events

### `customer.subscription.created` / `.updated`
Triggered when subscription is created or updated. Updates:
- User role (free → pro → premium)
- Subscription tier
- Renewal date
```typescript
await db.collection("users").doc(userId).update({
  role: "pro",
  "subscription.tier": "pro",
  "subscription.status": "active",
  "subscription.renewalDate": new Date(...)
});
```

### `customer.subscription.deleted`
Triggered when subscription is canceled. Downgrades user:
```typescript
await db.collection("users").doc(userId).update({
  role: "free",
  "subscription.status": "canceled"
});
```

### `invoice.payment_succeeded` / `.failed`
Triggered for payment events. Logs payments:
```typescript
await db.collection("users").doc(userId)
  .collection("payments").add({
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid,
    status: "paid"
  });
```

---

## 🧪 Testing

### Test in Development

Use Stripe test cards:
```
Success: 4242 4242 4242 4242
Decline:  4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

Expiry: Any future date (e.g., 12/26)
CVC: Any 3 digits

### Webhook Testing

Use Stripe CLI to test locally:
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

stripe login
stripe listen --forward-to localhost:5001/handleStripeWebhook
stripe trigger customer.subscription.created
```

### Firestore Rules Testing

Use emulator:
```bash
firebase emulators:start
```

---

## 📝 Pricing Configuration

Current tiers in `app/lib/stripe.ts`:

### Pro - $9.99/mo or $99.99/yr
Features:
- 1,000 card portfolio (vs 100 for free)
- Create unlimited auctions
- Portfolio analytics
- Card organization (folders)
- Ad-free experience

### Premium - $29.99/mo or $299.99/yr
Features:
- Unlimited cards
- Unlimited auctions
- Advanced analytics & exports
- REST API access
- Bulk operations
- Priority support

---

## 🐛 Troubleshooting

### Webhook not triggering

1. Check Cloud Function logs:
   ```bash
   firebase functions:log
   ```

2. Verify endpoint in Stripe Dashboard (Settings → Webhooks)

3. Check that webhook secret matches `.env`

### User role not updating

1. Check Firestore Security Rules allow webhook writes

2. Verify `metadata.firebaseUID` in Stripe subscription

3. Check subscription event payload:
   ```bash
   stripe events list --limit 10
   stripe events retrieve evt_xxxxx
   ```

### Checkout not working

1. Verify Stripe Price IDs are correct

2. Check Cloud Function deployed:
   ```bash
   firebase deploy --only functions --force
   ```

3. Check browser console for errors

4. Verify CORS settings on webhook function

---

## 🚀 Production Checklist

- [ ] Use production Stripe keys (not test keys)
- [ ] Enable Stripe webhooks in production
- [ ] Test subscription flow end-to-end
- [ ] Test webhook events (especially cancellation)
- [ ] Set up Stripe monitoring alerts
- [ ] Update error messages for production
- [ ] Add email notifications for payments
- [ ] Set up email notifications for payment failures
- [ ] Test refund/chargeback handling
- [ ] Document billing support process
- [ ] Set up fraud detection rules in Stripe
- [ ] Add rate limiting to checkout endpoint
- [ ] Monitor Cloud Function costs

---

## 📧 Next Steps

1. **Email Integration** - Send payment receipts, upgrade confirmations
2. **Usage Analytics** - Track which features are used by tier
3. **Dunning Management** - Auto-retry failed payments
4. **Proration** - Handle mid-cycle upgrades/downgrades
5. **Custom Invoices** - Branded invoice generation
6. **Tax Calculation** - Add tax based on location
7. **Promotional Codes** - Discounts and coupons
8. **Annual Renewal Reminder** - Email before renewal
