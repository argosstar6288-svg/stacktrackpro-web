# StackTrack Pro - Deployment & Setup Guide

## Deployment Information

**Project:** stacktrackpro  
**Live URL:** https://stacktrackpro.web.app  
**Region:** nam5 (North America)  
**Firestore Database:** (default)  

### Last Deployment
- **Date:** February 21, 2026
- **Components:** Firestore Rules + Next.js Frontend
- **Status:** ✅ Live

## Architecture Overview

```
┌─────────────────────────────────────────┐
│     Firebase Hosting (Static Next.js)   │
│     https://stacktrackpro.web.app       │
└────────────┬────────────────────────────┘
             │
             ├─→ Firebase Auth
             ├─→ Firestore (Database)
             ├─→ Firebase Storage (Images)
             └─→ Real-time Listeners
```

## Key Features Deployed

### ✅ Core Systems
- [x] Email/Password Authentication
- [x] Real-time Auction System
- [x] Bid Management (Immutable)
- [x] Auction Countdown Timer
- [x] Real-time Chat (Auction + Direct)
- [x] Firestore Security Rules (Production-Grade)

### ⏳ Coming Soon
- [ ] Email Verification Enforcement (Blocking)
- [ ] Card Collection System
- [ ] Marketplace Listings
- [ ] Payment Processing (Stripe)
- [ ] Admin Panel

## Firestore Rules Deployed

The following security rules are now ACTIVE:

### Auctions Collection
- ✅ Only authenticated users can create
- ✅ Only creators can modify/delete
- ✅ Anyone can read
- ✅ Bids are immutable (create-only)
- ✅ Cannot delete auctions with bids
- ✅ Prevents self-bidding

### Bids Subcollection
- ✅ Immutable (no edits after creation)
- ✅ Prevents bidders from editing bid amounts
- ✅ Prevents self-bidding via Firestore validation
- ✅ Rate limiting ready (via Cloud Functions - TODO)

### Chat Collections
- ✅ Only authenticated users can write
- ✅ Direct chat limited to participants
- ✅ Message size limits (≤ 2000 chars)

## Environment Variables

Required `.env.local` in `/web` directory:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=stacktrackpro.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=stacktrackpro-test
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=stacktrackpro.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=XXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_APP_ID=1:XXXXXX:web:XXXXXXXXXX
```

> ⚠️ These are public keys (NEXT_PUBLIC_*) - they're safe to commit

## Deployment Process

### Prerequisites
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Ensure you're in the /web directory
cd c:\Users\argos\Documents\stacktrackpro\web
```

### Build
```bash
npm run build
# Output to: ./out directory
```

### Deploy Everything
```bash
firebase deploy
```

### Deploy Specific Components
```bash
# Firestore Rules Only
firebase deploy --only firestore:rules

# Hosting Only
firebase deploy --only hosting

# Show deployment status
firebase projects:list
```

## Monitoring & Troubleshooting

### View Logs
```bash
firebase log --project=stacktrackpro
```

### Check Firestore Rules Errors
1. Go to Firebase Console
2. Navigate to Firestore → Rules
3. Check for any compilation errors

### Debug Real-time Issues
1. Open DevTools Console (F12)
2. Check for Firebase errors
3. Open Firebase Console → Real-time Database → Data

### Performance Issues
1. Check Firestore Indexes (should be auto-created)
2. Monitor quota usage: Firebase Console → Quotas
3. Review slow queries in: Firebase Console → Logs

## Security Checklist

- [x] Firestore rules deployed
- [x] Users can only edit own data
- [x] Bids cannot be edited after creation
- [x] Auctions cannot be deleted if bids exist
- [x] Self-bidding prevented
- [ ] Email verification enforcement (TODO)
- [ ] Rate limiting on writes (TODO: Cloud Functions)
- [ ] 2FA optional (TODO)
- [ ] CORS headers configured (TODO)

## Next Steps

1. **Run Testing Suite** (TESTING_GUIDE.md)
   - Verify all auction flows work
   - Test edge cases and security

2. **Implement Email Verification**
   - Block selling until email verified
   - Send verification reminders

3. **Add Cloud Functions**
   - Auto-close auctions at end time
   - Send notifications to winners
   - Rate limiting on bids

4. **Build Collection System**
   - Card CRUD operations
   - Image upload to Storage
   - Portfolio calculations

5. **Launch Marketplace**
   - Fixed-price listings
   - Trade offers
   - Counter-offer logic

## Rollback Procedure

If critical issues occur:

```bash
# Revert to previous Firestore rules
firebase deploy --only firestore:rules --etag <previous-etag>

# View previous deployments
firebase deploy --json | jq '.[] | select(.type=="firestore") | .name'
```

## Support & Documentation

- Firebase Console: https://console.firebase.google.com/project/stacktrackpro
- Firebase Docs: https://firebase.google.com/docs
- Next.js Docs: https://nextjs.org/docs
- GitHub Repo: [Link to your repo]

## Contact

For deployment issues:
1. Check this guide first
2. Review Firebase Console logs
3. Check GitHub issues
4. Contact DevOps team

---

**Last Updated:** February 21, 2026
