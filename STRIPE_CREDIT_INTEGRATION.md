# StackTrack Credit System - Stripe Integration Guide

Complete guide for setting up Stripe payment processing for credit purchases.

---

## 📋 Overview

The StackTrack Credit System allows Collector and Pro users to purchase credits for premium AI features. This guide covers the complete Stripe integration setup.

### Credit Packs

| Pack | Credits | Price (CAD) | Per Credit | Savings |
|------|---------|-------------|------------|---------|
| Starter | 10 | $5.00 | $0.50 | 0% |
| Popular | 50 | $20.00 | $0.40 | 20% |
| Best Value | 200 | $60.00 | $0.30 | 40% |

---

## 🔧 Setup Steps

### Step 1: Create Stripe Account

1. Go to [stripe.com/register](https://dashboard.stripe.com/register)
2. Complete account registration
3. Verify your email address
4. Complete business verification (for live mode)

### Step 2: Get API Keys

#### Test Mode Keys (Development)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Click "Developers" → "API Keys"
3. Toggle to "Test mode" (top right)
4. Copy **Secret key** (starts with `sk_test_`)
   - Add to `.env.local` as `STRIPE_SECRET_KEY`
5. Copy **Publishable key** (starts with `pk_test_`)
   - Add to `.env.local` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

#### Live Mode Keys (Production - Only after testing)

1. Toggle to "Live mode"
2. Copy **Secret key** (starts with `sk_live_`)
3. Copy **Publishable key** (starts with `pk_live_`)
4. Add to production environment variables

### Step 3: Create Credit Pack Products

Create 3 products in Stripe Dashboard for each credit pack.

#### Product 1: 10 Credits

1. Go to [Products](https://dashboard.stripe.com/products)
2. Click **+ Add product**
3. Fill in details:
   ```
   Name: 10 StackTrack Credits
   Description: 10 credits for premium AI features
   ```
4. Under **Pricing**:
   ```
   Model: One-time
   Price: 5.00
   Currency: CAD
   Billing period: One-time
   ```
5. Click **Add product**
6. Copy the **Price ID** (starts with `price_`)
7. Add to `.env.local` as `STRIPE_PRICE_10_CREDITS`

#### Product 2: 50 Credits

Repeat the above with:
```
Name: 50 StackTrack Credits (20% OFF)
Description: 50 credits for premium AI features - Best for regular users
Price: 20.00 CAD
```
Copy Price ID → `STRIPE_PRICE_50_CREDITS`

#### Product 3: 200 Credits

Repeat the above with:
```
Name: 200 StackTrack Credits (40% OFF)
Description: 200 credits for premium AI features - Best value!
Price: 60.00 CAD
```
Copy Price ID → `STRIPE_PRICE_200_CREDITS`

**✅ Result:** You should now have 3 products, each with a Price ID in your `.env.local`

### Step 4: Set Up Webhooks

Webhooks are CRITICAL - this is where credits are securely added after payment.

#### Development Setup (Using Stripe CLI)

1. **Install Stripe CLI**
   - Download: [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
   - Windows: Use the MSI installer
   - Mac: `brew install stripe/stripe-cli/stripe`
   - Linux: Download binary from GitHub releases

2. **Login to Stripe CLI**
   ```bash
   stripe login
   ```
   This will open a browser to authorize the CLI.

3. **Forward Webhooks to Local Server**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe-credits
   ```
   
4. **Copy Webhook Secret**
   - The CLI will output: `whsec_xxxxxxxxxxxxxxxx`
   - Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

5. **Keep CLI Running**
   - Leave this terminal open while developing
   - You'll see webhook events in real-time

#### Production Setup (Using Stripe Dashboard)

1. Go to [Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **+ Add endpoint**
3. Enter endpoint URL:
   ```
   https://stacktrackpro.com/api/webhooks/stripe-credits
   ```
4. Under **Events to send**, select:
   - `checkout.session.completed` ✓
   - `checkout.session.expired` ✓
   - `charge.refunded` ✓ (optional, for manual refunds)
5. Click **Add endpoint**
6. Copy **Signing secret** (starts with `whsec_`)
7. Add to production environment variables as `STRIPE_WEBHOOK_SECRET`

**🛡️ Security Note:** The webhook secret is used to verify that webhook events actually came from Stripe, not a malicious actor.

### Step 5: Configure Environment Variables

Update your `.env.local` file with all values:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Credit Pack Price IDs
STRIPE_PRICE_10_CREDITS=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_50_CREDITS=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_200_CREDITS=price_xxxxxxxxxxxxxxxxxxxxx

# Application URL
NEXT_PUBLIC_URL=http://localhost:3000
```

For production (Vercel), add these to your [Environment Variables](https://vercel.com/stacktrackpro/settings/environment-variables).

### Step 6: Test the Integration

#### Test Cards

Use these test cards in Stripe's test mode:

| Card Number | Scenario | Result |
|-------------|----------|--------|
| 4242 4242 4242 4242 | Success | Payment succeeds |
| 4000 0025 0000 3155 | 3D Secure | Requires authentication |
| 4000 0000 0000 9995 | Decline | Payment fails (insufficient funds) |

- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

#### Testing Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Start Stripe CLI (Separate Terminal)**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe-credits
   ```

3. **Login as Collector/Pro User**
   - Free users are automatically redirected to upgrade page

4. **Go to Credits Page**
   ```
   http://localhost:3000/dashboard/credits
   ```

5. **Purchase Credits**
   - Click "Buy Now" on any pack
   - Use test card: 4242 4242 4242 4242
   - Complete checkout

6. **Verify Webhook Received**
   - Check Stripe CLI terminal - you should see:
   ```
   checkout.session.completed [evt_xxxxx]
   ```

7. **Check Credits Added**
   - You should be redirected back with success message
   - Credit balance should be updated
   - Check Firestore:
     - `users/{userId}` → `credits` field updated
     - `creditTransactions` → New transaction logged

#### Debugging Checklist

If credits aren't added:

- [ ] Stripe CLI is running and forwarding webhooks
- [ ] Webhook secret matches in `.env.local`
- [ ] API route exists: `/app/api/webhooks/stripe-credits/route.ts`
- [ ] Check browser console for errors
- [ ] Check terminal console for webhook processing logs
- [ ] Verify user ID matches between checkout and webhook
- [ ] Check Firestore rules allow credit writes

---

## 🚀 Production Deployment

### 1. Switch to Live Mode

In Stripe Dashboard:
1. Toggle from "Test mode" to "Live mode" (top right)
2. Get new **Live API keys**
3. Create new **Live products** (repeat Product creation)
4. Set up **Live webhook endpoint**

### 2. Update Environment Variables

In [Vercel Dashboard](https://vercel.com/stacktrackpro):

1. Go to Settings → Environment Variables
2. Update these to LIVE values:
   - `STRIPE_SECRET_KEY` → Live secret key (`sk_live_`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Live publishable key
   - `STRIPE_WEBHOOK_SECRET` → Live webhook secret
   - `STRIPE_PRICE_10_CREDITS` → Live price ID
   - `STRIPE_PRICE_50_CREDITS` → Live price ID
   - `STRIPE_PRICE_200_CREDITS` → Live price ID
   - `NEXT_PUBLIC_URL` → `https://stacktrackpro.com`

3. Click **Save**
4. Redeploy the application

### 3. Test with Real Payment

⚠️ **Use a real card for testing (you'll be charged)**

1. Go to production site
2. Login as Collector/Pro user
3. Buy smallest pack (10 credits = $5 CAD)
4. Complete real payment
5. Verify credits added
6. Issue a refund in Stripe Dashboard if needed

### 4. Monitor Webhooks

1. Go to [Stripe Webhooks Dashboard](https://dashboard.stripe.com/webhooks)
2. Click on your production webhook
3. Monitor "Recent deliveries" tab
4. Check for any failed deliveries
5. Stripe will automatically retry failed webhooks

---

## 🔐 Security Best Practices

### ✅ DO

- ✅ Always verify webhook signatures
- ✅ Use separate Stripe accounts for test/production
- ✅ Add credits ONLY in webhook handler
- ✅ Log all transactions to Firestore
- ✅ Set up webhook retry monitoring
- ✅ Keep Stripe secret keys in environment variables only
- ✅ Use HTTPS in production
- ✅ Rate limit credit purchases (built-in)

### ❌ DON'T

- ❌ Never trust frontend success page for credit addition
- ❌ Never expose secret keys in client-side code
- ❌ Never add credits based on query parameters
- ❌ Never commit `.env.local` to Git
- ❌ Never reuse test mode keys in production
- ❌ Never skip webhook signature verification

---

## 📊 Monitoring & Analytics

### Stripe Dashboard

Monitor these metrics:

1. **Payments** → View successful/failed payments
2. **Customers** → Track user purchases
3. **Disputes** → Handle chargebacks (rare)
4. **Revenue** → Track total earnings

### Application Analytics

Track in your analytics:

- Total credits purchased by tier (Collector vs Pro)
- Average purchase value
- Conversion rate (visits → purchases)
- Most popular pack
- Credit usage patterns

### Webhook Health

Set up alerts for:

- Failed webhook deliveries
- Webhook processing errors
- Unusually high refund rates
- Duplicate transaction attempts

---

## 🆘 Troubleshooting

### "No Stripe signature found"

**Cause:** Webhook signature missing from request headers.

**Solution:**
- Ensure Stripe CLI is running in development
- Verify webhook endpoint URL is correct in production
- Check that request isn't going through proxy stripping headers

### "Webhook signature verification failed"

**Cause:** Wrong webhook secret or modified request body.

**Solution:**
- Copy webhook secret from Stripe Dashboard
- Paste into `STRIPE_WEBHOOK_SECRET`
- Restart development server
- Ensure API route doesn't parse body before verification

### Credits not added after payment

**Cause:** Webhook not received or failed to process.

**Solutions:**
1. Check Stripe CLI output (development)
2. Check "Webhook deliveries" in Stripe Dashboard (production)
3. Check server logs for webhook processing errors
4. Verify metadata is present in checkout session:
   ```javascript
   {
     userId: "xxx",
     packId: "pack_10",
     credits: "10"
   }
   ```
5. Check Firestore rules allow writes to `users` and `creditTransactions`

### Payment succeeds but user sees error

**Cause:** Credits not added but payment went through.

**Solution:**
1. Find the payment in Stripe Dashboard
2. Get the `session_id`
3. Manually trigger webhook or add credits via Firebase console
4. Update `creditTransactions` for audit trail
5. Issue refund if unable to add credits

### Users bypassing Collector/Pro restriction

**Cause:** Frontend access control not sufficient.

**Solution:**
- Access control is checked in `page.tsx` (frontend)
- Add server-side check in `/api/create-credit-checkout`:
  ```typescript
  // Verify user tier before creating checkout
  const userDoc = await getDoc(doc(db, 'users', userId));
  const tier = userDoc.data()?.subscription;
  
  if (tier === 'free' || tier === 'starter') {
    return NextResponse.json(
      { error: 'Upgrade to Collector or Pro to purchase credits' },
      { status: 403 }
    );
  }
  ```

---

## 📚 Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Cards](https://stripe.com/docs/testing)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Handling Failed Payments](https://stripe.com/docs/declines)

---

## ✅ Launch Checklist

Before going live:

- [ ] All 3 products created in Stripe (live mode)
- [ ] Live API keys added to production environment
- [ ] Live webhook endpoint configured and verified
- [ ] Test purchase with real card (smallest pack)
- [ ] Verify credits added successfully
- [ ] Verify transaction logged in Firestore
- [ ] Test refund process
- [ ] Set up webhook monitoring alerts
- [ ] Document emergency contact for Stripe issues
- [ ] Enable Stripe Radar for fraud protection
- [ ] Review Stripe fee structure (2.9% + $0.30 CAD)

---

**Last Updated:** January 2025  
**Stripe API Version:** 2024-12-18.acacia  
**Next.js Version:** 16.1.6

