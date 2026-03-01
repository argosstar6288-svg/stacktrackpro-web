# StackTrack Pro - Auction System Testing Guide

**Deployment Status:** ✅ Live at https://stacktrackpro.web.app

## Phase 1: Basic Auction Flow

### 1.1 User Registration & Login
- [ ] Create new account with email (e.g., seller@test.com)
- [ ] Verify email verification email is sent
- [ ] Complete email verification
- [ ] Login with verified account
- [ ] Verify session persists after page refresh
- [ ] Test logout functionality

### 1.2 Auction Creation
- [ ] Navigate to `/auction`
- [ ] Click "Create Auction" button
- [ ] Fill in auction details:
  - [ ] Card Name (e.g., "1952 Mickey Mantle")
  - [ ] Starting Bid ($100)
  - [ ] Bid Increment ($5)
  - [ ] End Time (24 hours from now)
- [ ] Submit and verify auction appears in list
- [ ] Verify auction shows correct details
- [ ] Verify countdown timer starts

### 1.3 Auction Details Page
- [ ] Click on created auction
- [ ] Verify all auction info displays correctly
- [ ] Verify "Current Bid" shows starting bid
- [ ] Verify countdown timer is running
- [ ] Verify creator cannot bid on own auction (button disabled)

## Phase 2: Bidding System

### 2.1 Placing Bids
- [ ] Create second account (bidder@test.com)
- [ ] Login as bidder
- [ ] Navigate to active auction
- [ ] Enter bid amount above current bid + increment
- [ ] Submit bid
- [ ] Verify bid appears in bid history (latest first)
- [ ] Verify current bid updates
- [ ] Verify highest bidder name shows

### 2.2 Bid Validation
- [ ] Attempt bid lower than current bid + increment
  - [ ] Verify error message: "Bid must be at least ${amount}"
- [ ] Attempt bid equal to current bid (not increment higher)
  - [ ] Verify error message
- [ ] Attempt negative bid
  - [ ] Verify rejected
- [ ] Attempt non-numeric bid
  - [ ] Verify rejected

### 2.3 Self-Bid Prevention
- [ ] Login as original creator
- [ ] Navigate to own auction
- [ ] Verify bid button is disabled
- [ ] Verify tooltip shows "Cannot bid on your own auction"

### 2.4 Bid Sniping Protection (Optional)
- [ ] Create auction ending in 5 minutes
- [ ] Place bid at ~4 minute mark
- [ ] Place another bid at ~30 second mark
- [ ] Verify auction still allows bids until end time

## Phase 3: Multi-User Auction Scenario

### 3.1 Multiple Bidders
- [ ] Create 3+ test accounts (bidder1, bidder2, bidder3)
- [ ] Create new auction as seller
- [ ] Have bidder1 place first bid: $100
  - [ ] Verify displays as highest bidder
- [ ] Have bidder2 place bid: $105
  - [ ] Verify bidder2 is now highest
  - [ ] Verify bidder1 name still in history
- [ ] Have bidder3 place bid: $110
  - [ ] Verify bidder3 is highest
  - [ ] Verify all three bids in history in reverse order
- [ ] Have bidder1 place counter-bid: $115
  - [ ] Verify bidder1 back on top
  - [ ] Verify bid increments as expected

### 3.2 Real-Time Updates
- [ ] Open auction in two browser windows/tabs
- [ ] Place bid in window #1
- [ ] Verify bid appears in window #2 within 1-2 seconds
- [ ] Verify "Current Bid" updates in real-time

## Phase 4: Auction Expiration

### 4.1 Countdown Timer
- [ ] Create auction ending in 2 minutes
- [ ] Watch countdown timer
  - [ ] Verify counts down: "1 mins : 45 sec" → "45 secs" → "30 secs"
  - [ ] Verify format is correct
- [ ] Wait for auction to end
- [ ] Verify "Auction Ended" message displays
- [ ] Verify bid button becomes disabled
- [ ] Verify error message shown when attempting bid: "Auction has ended"

### 4.2 Post-Expiration
- [ ] Refresh page after auction ends
- [ ] Verify still shows "Auction Ended"
- [ ] Verify auction still in list but marked as ended
- [ ] Verify no new bids can be placed

## Phase 5: Auction Chat System

### 5.1 Chat Functionality
- [ ] Open auction detail page
- [ ] Scroll to chat section
- [ ] Type test message in chat input
- [ ] Submit message
- [ ] Verify message appears in chat (yours in different color)
- [ ] Verify timestamp is correct
- [ ] Verify username displays correctly

### 5.2 Real-Time Chat
- [ ] Open auction in two browser windows
- [ ] Send message in window #1
- [ ] Verify message appears in window #2 within 1-2 seconds
- [ ] Send message from window #2
- [ ] Verify both users see messages in order

### 5.3 Chat Permissions
- [ ] Test as non-authenticated user
- [ ] Verify chat input disabled
- [ ] Verify tooltip: "Login required"

## Phase 6: Security & Edge Cases

### 6.1 Firestore Rules Validation
- [ ] Attempt to edit existing bid manually (via console)
  - [ ] Verify DENIED by Firestore rules
- [ ] Attempt to set current bid lower (via console)
  - [ ] Verify DENIED
- [ ] Attempt to bid on auction owned by self
  - [ ] Verify DENIED by client-side check

### 6.2 Bid Race Condition
- [ ] Create auction with $100 starting bid
- [ ] Open in 2 browser windows
- [ ] In both windows, enter bid amount: $105
- [ ] Click submit in both within 1 second of each other
- [ ] Verify only one bid succeeds
- [ ] Verify other gets error: "Bid too low" or similar

### 6.3 Expired Auction Bids
- [ ] Create auction ending in 1 minute
- [ ] Wait until 10 seconds before end
- [ ] Attempt to place bid
- [ ] Verify bid is processed OR gets error if past end time

## Phase 7: UI/UX Verification

### 7.1 Responsiveness
- [ ] Test on mobile (375px width)
  - [ ] Bid buttons still accessible
  - [ ] Countdown timer readable
  - [ ] Chat scrollable
- [ ] Test on tablet (768px)
- [ ] Test on desktop (1920px)

### 7.2 Error Handling
- [ ] Verify all error messages are clear and helpful
- [ ] Test loading states (disabled buttons during bid submission)
- [ ] Verify no console errors when placing bids

### 7.3 Accessibility
- [ ] Test keyboard navigation (Tab through inputs)
- [ ] Verify bid buttons have proper aria-labels
- [ ] Test with screen reader (if available)

## Phase 8: Performance Testing

### 8.1 Load Testing
- [ ] Create 50+ auctions in quick succession
- [ ] Verify auction list loads within 2 seconds
- [ ] Verify no lag when scrolling through auctions

### 8.2 Bid Latency
- [ ] Place bid and measure time to see update
  - [ ] Target: < 1 second for real-time update
- [ ] With 10+ simultaneous auctions open
  - [ ] Verify all update in real-time

## Known Issues & Limitations

- [ ] Email verification currently not enforced (TODO: add enforcement)
- [ ] No auction ending notifications yet (TODO: implement)
- [ ] Chat profanity filtering not yet implemented
- [ ] No user reputation system yet

## Test Completion Checklist

- [ ] All Phase 1-4 tests passed
- [ ] No console errors
- [ ] No security violations detected
- [ ] Performance acceptable
- [ ] Ready for: Collection System / Marketplace

## Notes

Adding test cases during execution:
- Time: _______________
- Tester: _______________
- Issues Found: _______________
- Recommendations: _______________
