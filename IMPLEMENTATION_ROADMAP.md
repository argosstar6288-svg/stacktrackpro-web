

## Implementation Roadmap & Status

### Phase 1: Stripe Connect Onboarding ✅ (In Progress)

**Completed:**
- `lib/stripe-connect.ts` - All utility functions for Stripe Connect
- `hooks/useStripeConnect.ts` - React hook for managing onboarding UI
- Database schema ready (user.stripeAccountId, stripeAccountStatus)
- Fee calculation ready in `lib/fees.ts` with subscription tiers

**TODO:**
- API routes for creating Express account (Firebase Admin build issue to resolve)
- Guard in Create Auction page (depends on API routes)
- Frontend UI for Stripe setup modal

**Issue to Fix:**
Firebase Admin SDK initialization during Next.js build-time page collection causes build failures. Solution: Either (1) use dynamic="force-dynamic" with async imports, or (2) move Firebase Admin to separate microservice.

---

### Phase 2: Payout Hold Logic ✅ Documented

**Completed:**
- 24-hour hold system design (spreads hold  time to 12h for Pro sellers)
- Database schema with `releaseHold` fields
- Dispute system architecture
- Three auto-release mechanisms (Firebase Function, Vercel Cron, Dashboard Trigger)

**Code Ready:**
All code examples in PAYOUT_HOLD_SYSTEM.md lines 220-400 for implementing:
-$ `shipAuction()` - Seller marks as shipped, triggers 24h timer
- `openDispute()` - Buyer can dispute during hold window
- `resolveDispute()` - Admin approval/refund logic

---

### Phase 3: Auto-Release Cron Job ⏳ Ready to Deploy

**Code provided** (pick one):

**Option A - Firebase Scheduled Function** (RECOMMENDED)
- File: PAYOUT_HOLD_SYSTEM.md lines 250-310
- Runs hourly, finds eligible payouts, auto-triggers Stripe transfers
- Includes error handling and admin alerts

**Option B - Vercel Cron Job**
- File: PAYOUT_HOLD_SYSTEM.md lines 312-370
-  Simple HTTP endpoint, configure in vercel.json
- No Firebase Functions needed

**Option C - Dashboard Trigger**
- File: PAYOUT_HOLD_SYSTEM.md lines 372-390
- Check on page load (least robust)
- Good for MVP testing

---

### Phase 4: Dispute Button & Backend ⏳ Needs Implementation

Files to create:
- `components/DisputeButton.tsx` - Buyer dispute UI
- `app/api/disputes/open/route.ts` - Backend handler
- `app/api/disputes/resolve/route.ts` - Admin resolution

Dispute UX:
- Button appears in buyer's auction view when `status === "shipped_pending_release"`
- Modal: reason dropdown (item different, item damaged, never received, etc.)
- Sets `releaseHold.disputeOpened = true` in Firestore
- Blocks auto-release
- Alerts admin

---

### Phase 5: Admin Dispute Panel ⏳ Needs Implementation

Files to create:
- `app/dashboard/admin/disputes/page.tsx` - Main disputes page
- Components:
  - `DisputeCard.tsx` - Individual dispute  
  - `DisputeStats.tsx` - Rate, average resolution time
  - `DisputeActions.tsx` - Approve seller/buyer/refund buttons

Display:
- All open disputes sorted by date
- Auction ID, amounts (sale price, fee, refund)
- Buyer reason, seller response space
- Timeline of events (payment, ship, dispute open)
- Admin approval buttons: Release Payout | Full Refund | Partial Refund

---

### Phase 6: Seller Earnings Dashboard ⏳ Needs Implementation

Files to create:
- `app/dashboard/payouts/earnings.tsx` - Complete earnings view

Show:
```
Current Balance:     $2,345.67 (available now)
Pending (24h hold):  $1,200.00 (releases in 18 hours)
Total Earned:        $23,450.21

Recent Payouts:
- Dec 15: $367.70 (auction: Charizard) → Transferred
- Dec 14: $425.30 (auction: Blastoise) → Transferred  
- Dec 13: $156.40 (auction: Venusaur) → Pending

Next Payout:
- Auction: Pikachu PSA 10
- Amount: $1,200.00
- Status: Waiting for 24h review window (18 hours remain)
- Tracking: Canada Post 1234567890
```

---

## Build Issues & Solutions

### Firebase Admin in API Routes

**Problem:** Firebase Admin SDK initialization fails during Next.js build-time page data collection.

**Attempted Solutions:**
1. ✗ Lazy loading modules - still gets executed during build
2. ✗ `export const dynamic = 'force-dynamic'` - Next.js still collects pages
3. ✓ **Skip dynamic routes entirely for now** - Use this temporary approach

**Recommended Permanent Solutions:**
- A. Use external Cloud Functions (Firebase takes care of initialization)
- B. Separate Node.js microservice for auth-needed endpoints
- C. Upgrade Next.js/Firebase SDK for better compatibility

**Current Status:** Stripe Connect utilities ready in lib/. API routes deferred until Firebase Admin initialization is resolved.

---

## Testing Checklist

- [ ] Stripe Connect Express account creation
- [ ] Onboarding link generation and redirect
- [ ] Account status verification (chargesEnabled/payoutsEnabled)
- [ ] 24-hour hold trigger after shipment
- [ ] Dispute button appears in 24h window
- [ ] Auto-release after 24h (no dispute)
- [ ] Dispute blocks auto-release
- [ ] Admin can approve/reject disputes  
- [ ] Refunds processed correctly
- [ ] Seller earnings dashboard shows accurate balances
- [ ] Email notifications sent to all parties
- [ ] Failed Stripe transfers trigger admin alerts

---

## Security Checklist

- [ ] Stripe Connect account requires identity verification
- [ ] Only authenticated users can access payout routes
- [ ] Dispute resolution requires admin authorization
- [ ] Refunds check Stripe charge existence
- [ ] Fake tracking numbers detected (carrier API validation)
- [ ] Audit log for all payout decisions
- [ ] Webhook signature verification for Stripe events
- [ ] PCI compliance maintained (no card data stored)

