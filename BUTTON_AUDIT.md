# StackTrack Pro - Button & Feature Audit

## 📋 Complete Navigation Map

### Main Sidebar Navigation
| Button/Link | Current Route | Status | Auth Required | Notes |
|-------------|---------------|--------|---------------|-------|
| Overview | `/dashboard` | ✅ | Yes | Main dashboard |
| AI Hub | `/dashboard/ai` | ✅ | Yes | AI card scanning |
| Live Auctions | `/auctions/live` | ✅ | Yes | Active auctions |
| Create Auction | `/auctions/create` | ✅ | Yes + 18+ | Needs verification |
| Collection | `/dashboard/collection` | ✅ | Yes | User's cards |
| Market | `/dashboard/market` | ✅ | Yes | Marketplace browse |
| Marketplace | `/dashboard/marketplace` | ✅ | Yes | Direct sales |
| Pricing | `/dashboard/pricing` | ✅ | Yes | Subscription plans |
| Inbox | `/dashboard/inbox` | ✅ | Yes | Messages |
| Watchlist | `/dashboard/watchlist` | ✅ | Yes | Saved items |
| Help | `/dashboard/help` | ✅ | Yes | FAQ/Support |
| Settings | `/dashboard/settings` | ✅ | Yes | User settings |
| Admin | `/dashboard/admin` | ✅ | Admin only | Admin panel |

### Dashboard Page Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| View Collection | Navigate | `/dashboard/collection` | Load user cards |
| Scan Card | Open modal | `/dashboard/ai` | Check scan limits |
| Create Auction | Navigate | `/auctions/create` | Check 18+ verification |
| View Auctions | Navigate | `/auctions/live` | Load active auctions |

### Collection Page Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Add Card | Navigate | `/dashboard/collection/add` | Open add form |
| Scan Card | Navigate | `/dashboard/ai` | Open scanner |
| View Card Details | Navigate | `/dashboard/collection/[id]` | Load card data |
| Delete Card | API Call | Stay on page | Confirm + delete |
| List for Auction | Navigate | `/auctions/create?cardId={id}` | Pre-fill card info |

### AI Hub / Scanner Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Scan Card | API Call | Stay | Check limits, call OpenAI |
| Save to Collection | API Call | `/dashboard/collection` | Save + redirect |
| Try Again | Reset | Stay | Clear results |
| Upgrade (if limit hit) | Navigate | `/dashboard/pricing` | Show plans |

### Auction Pages Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Create Auction | Form submit | `/auctions/live` | Verify 18+, save auction |
| Place Bid | API Call | Stay | Check balance, place bid |
| View Auction | Navigate | `/auctions/[id]` | Load auction details |
| Watch Auction | API Call | Stay | Add to watchlist |

### Marketplace Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Create Listing | Navigate | `/dashboard/marketplace/create` | Open form |
| Buy Now | API Call | Stripe checkout | Verify payment |
| Make Offer | Modal | Stay | Open offer modal |
| Propose Trade | Navigate | `/dashboard/inbox` | Start chat |
| Contact Seller | Navigate | `/dashboard/inbox?user={id}` | Open chat |
| Edit Listing | Navigate | `/dashboard/marketplace/edit/[id]` | Load listing |

### Settings Page Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Save Settings | API Call | Stay | Update user prefs |
| Change Password | Modal | Stay | Firebase auth |
| Logout | Auth action | `/login` | Clear session |
| Delete Account | Confirm modal | `/login` | Permanent delete |
| Upgrade Plan | Navigate | `/dashboard/pricing` | Show plans |

### Profile Page Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Edit Profile | Inline edit | Stay | Toggle edit mode |
| Save Profile | API Call | Stay | Update Firestore |
| Upload Photo | File picker | Stay | Upload to Storage |
| View Public Profile | Navigate | `/profile/[username]` | Show public view |

### Watchlist Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| View Auction | Navigate | `/auctions/[id]` | Load auction |
| Remove from Watchlist | API Call | Stay | Delete record |
| Refresh | API Call | Stay | Reload data |
| Filter (All/Price Drop/Ending) | Filter | Stay | Update display |

### Payouts Page Actions
| Button | Action | Route | Should Also Do |
|--------|--------|-------|----------------|
| Request Payout | API Call | Stay | Check minimum balance |
| Connect Stripe | Stripe OAuth | Stay | Setup Stripe account |
| View Transaction | Expand | Stay | Show details |

## 🔒 Auth Protection Status

### Pages That MUST Have Auth
- ✅ `/dashboard/*` - All dashboard pages
- ✅ `/auctions/create` - Create auction
- ✅ `/auctions/live` - View auctions
- ⚠️ `/dashboard/ai` - Needs scan limit check
- ⚠️ `/auctions/create` - Needs 18+ verification

### Public Pages (No Auth Required)
- `/` - Landing page
- `/login` - Login page
- `/signup` - Signup page
- `/legal/*` - Legal pages

## 🚨 High Priority Fixes Needed

### 1. Missing Routes
- [ ] `/dashboard/collection/[id]` - Card detail page
- [ ] `/dashboard/marketplace/edit/[id]` - Edit listing
- [ ] `/profile/[username]` - Public profile

### 2. Missing Auth Checks
- [ ] 18+ verification for auction creation
- [ ] Scan limit enforcement on AI Hub
- [ ] Subscription tier checks for premium features

### 3. Missing Loading States
- [ ] Scan card button (during API call)
- [ ] Place bid button (during submission)
- [ ] Payout request button
- [ ] Save settings button

### 4. Missing Error Handling
- [ ] Failed API calls (OpenAI)
- [ ] Failed Firestore operations
- [ ] Failed Stripe operations

## 🎯 Critical User Flows to Test

### Flow 1: New User Onboarding
1. Sign up → `/signup`
2. Redirect to → `/dashboard`
3. Click "Scan Card" → `/dashboard/ai`
4. Complete scan → Save to collection
5. View collection → `/dashboard/collection`

**Status**: ⚠️ Needs testing

### Flow 2: Create Auction
1. From collection → Click card
2. Click "List for Auction"
3. Verify 18+ (required)
4. Fill auction details
5. Submit → Redirect to `/auctions/live`

**Status**: ⚠️ Needs 18+ gate

### Flow 3: Buy Item
1. Browse marketplace → `/dashboard/marketplace`
2. Click listing → `/dashboard/marketplace/[id]`
3. Click "Buy Now"
4. Stripe checkout
5. Return to success page

**Status**: ⚠️ Needs testing

### Flow 4: Upgrade Subscription
1. Hit scan limit
2. See upgrade prompt
3. Click "Upgrade" → `/dashboard/pricing`
4. Select plan
5. Stripe checkout
6. Verify new limits applied

**Status**: ⚠️ Needs limit enforcement

## 🔧 Recommended Fixes

### Priority 1: Add Loading States
```tsx
<button disabled={loading}>
  {loading ? "Saving..." : "Save"}
</button>
```

### Priority 2: Add Auth Guards
```tsx
useEffect(() => {
  if (!user) {
    router.push("/login");
  }
}, [user]);
```

### Priority 3: Add 18+ Verification
```tsx
if (!user.isAuctionVerified) {
  router.push("/verify-age");
}
```

### Priority 4: Add Scan Limits
```tsx
const { scansRemaining } = useFeatureAccess();
if (scansRemaining === 0) {
  router.push("/dashboard/pricing");
}
```

## 📊 Next Steps

1. ✅ Create admin system check page (`/dashboard/admin/system-check`)
2. ⚠️ Add loading states to all buttons
3. ⚠️ Add auth protection to all protected routes
4. ⚠️ Add 18+ verification flow
5. ⚠️ Add scan limit enforcement
6. ⚠️ Test all critical user flows
7. ⚠️ Review console errors
8. ⚠️ Add error boundaries

---

**Last Updated**: March 1, 2026
**Status**: In Progress
