# Tournament System - Phase 1 Implementation Summary

## What Was Built

### Core Libraries (3 files)
1. **`lib/tournament-types.ts`** — Complete TypeScript interfaces for:
   - Tournament documents (config, rules, status)
   - Entries, scores, rewards
   - Request/response payloads
   - Leaderboard data structures

2. **`lib/tournament-scoring.ts`** — Scoring engine with:
   - Card-by-card scoring (value + rarity bonus)
   - Streak multiplier calculation
   - Whale cap (prevents $500+ transactions from dominating)
   - Speed bonus (10% for early scanners)
   - Badge determination logic
   - Prize distribution calculator

3. **`lib/tournaments.ts`** — Core business logic:
   - `joinTournament()` — Validate & deduct fee, create entry
   - `getLeaderboard()` — Paginated scores with ranking
   - `getUserTournamentScore()` — Individual score lookup
   - `updateTournamentScore()` — Real-time score updates
   - `finalizeTournament()` — Lock scores, create rewards
   - `claimReward()` — One-time payout, add credits

### API Endpoints (4 routes)
1. **`POST /api/tournaments/[id]/join`** — Join tournament
   - Validates fee, balance, capacity
   - Deducts credits, creates entry doc
   - Returns: entryId or error

2. **`GET /api/tournaments/[id]/leaderboard`** — Fetch leaderboard
   - Paginated (configurable pageSize, page)
   - Returns top 100 + user's rank if off-page
   - Real-time scores with breakdown

3. **`POST /api/tournaments/[id]/claim-reward`** — Claim prize
   - One-time claim (second attempt blocked)
   - Adds credits to user balance
   - Atomic transaction

4. **`GET /api/tournaments`** — List tournaments
   - Filter by: status, type
   - Sort by: startTime, endTime, etc.
   - Returns array of tournaments

### Admin Endpoint
- **`POST /api/admin/tournaments`** — Admin creates tournament
  - Validates admin role
  - Generates tournament ID
  - Sets default rules & structure

### Cloud Functions (2 functions)
1. **`scoreTournamentEntry`** (Firestore trigger on card creation)
   - Detects card scans during active tournaments
   - Calculates score (value + rarity + streak + speed bonus)
   - Updates real-time leaderboard
   - Prevents duplicate scans
   - Logs all scoring decisions

2. **`finalizeTournaments`** (Hourly scheduled job)
   - Finds ended tournaments
   - Creates reward documents for all participants
   - Distributes prizes by rank
   - Marks tournaments as "completed"

### Security & Firestore Rules
Updated `firestore.rules` with tournament-specific rules:
- Tournaments: Public read, admin-only write
- Entries: User-readable, user-writable (own only)
- Scores: Public read, Cloud Function-only write
- Rewards: User-readable (own only), Cloud Function-only write

### Testing & Documentation
1. **`TOURNAMENT_PHASE1_GUIDE.md`** — Comprehensive testing guide
   - Step-by-step core loop test
   - Cloud Function deployment instructions
   - Troubleshooting section
   - Performance estimates

2. **`__tests__/tournament-system.test.ts`** — Unit tests
   - Score calculation tests
   - Join validation tests
   - Leaderboard ranking tests
   - Prize distribution tests
   - Badge determination tests

3. **`scripts/test-tournament-core.js`** — Local test script
   - Validates all scoring logic without Firebase
   - Tests ranking, prizes, badges
   - Run: `node scripts/test-tournament-core.js`

---

## Core Loop: Entry → Action → Score → Leaderboard → Rewards → Repeat

### Step 1: User Joins Tournament
```bash
POST /api/tournaments/tournament-id/join
{
  "userId": "user123",
  "displayName": "Alice",
  "email": "alice@example.com"
}
```
- Fee deducted from user's creditBalance
- Entry document created
- Score initialized to 0

### Step 2: User Scans Card (Action)
User adds card to collection during tournament (via existing scan UI). This triggers the Cloud Function.

**Cloud Function detects:**
- Card added during active tournament window
- User is enrolled in that tournament
- Not a duplicate scan

**Cloud Function calculates:**
- Base score: $1 value = 1 point
- Rarity bonus: +50 (rare) or +100 (ultra-rare)
- Whale cap: If value > $500, cap points at 500
- Speed bonus: +10% if scanned in first 50% of tournament
- Streak multiplier: ×1.1 per 3 consecutive days of scans

**Result:** Score updated in `/tournament_scores/tournament-id_user123`

### Step 3: User Sees Leaderboard (Real-Time Feedback)
```bash
GET /api/tournaments/tournament-id/leaderboard?page=0&pageSize=50&userId=user123
```
Returns:
- Top 50 entries with rank, score, breakdown
- User's rank (pinned if not in top 50)
- Rank change indicator for animation

### Step 4: Tournament Ends (Automatic)
When endTime arrives:
1. Cloud Function (hourly check) detects tournament has ended
2. Calculates final rankings
3. Creates reward documents for all participants
4. Distributes prizes: 1st=40%, 2nd=30%, 3rd=20%, 4-10th=10%/7

### Step 5: User Claims Reward
```bash
POST /api/tournaments/tournament-id/claim-reward
{
  "userId": "user123",
  "rewardId": "tournament-id_user123"
}
```
- Credits added to user balance
- Reward marked as claimed
- Subsequent claims blocked

### Step 6: User Shares Achievement
Share link automatically generated: 
`stacktrackpro.com/share/tournament/{tournamentId}/{userId}`

Shows: Rank, score, badges earned

---

## Deployment Checklist

### Phase 1: Core Loop Only

- [ ] **Firestore Setup**
  - [ ] Create collections (auto-created on first write): tournaments, tournament_entries, tournament_scores, tournament_rewards
  - [ ] Deploy security rules: `firebase deploy --only firestore:rules`
  - [ ] Verify indexes (or let Firestore auto-create): (tournamentId, score DESC, userId ASC)

- [ ] **Cloud Functions Deployment**
  - [ ] Ensure `functions/tournaments.ts` exists
  - [ ] Deploy: `firebase deploy --only functions:scoreTournamentEntry,functions:finalizeTournaments`
  - [ ] Verify in Firebase Console → Functions (check recent executions & logs)

- [ ] **API Routes**
  - [ ] Test all 4 endpoints locally:
    - POST /api/tournaments/[id]/join
    - GET /api/tournaments/[id]/leaderboard
    - POST /api/tournaments/[id]/claim-reward
    - GET /api/tournaments

- [ ] **Test Suite**
  - [ ] Run unit tests: `npm test -- tournament-system.test.ts`
  - [ ] Run local test script: `node scripts/test-tournament-core.js`

- [ ] **Manual E2E Test** (follow TOURNAMENT_PHASE1_GUIDE.md)
  - [ ] Create test tournament (via Firestore UI or /api/admin/tournaments)
  - [ ] User joins (balance decreases)
  - [ ] Add card to collection (Cloud Function triggers, score updates)
  - [ ] Check leaderboard (see updated score)
  - [ ] Finalize tournament (rewards created)
  - [ ] Claim reward (credits added, claim lock works)

---

## Key Design Decisions

### Scoring System
- **Base: $1 = 1 point** — Easy to understand, fair for all budget types
- **Rarity bonuses**: +50 (rare), +100 (ultra-rare) — Encourages hunting valuable cards
- **Whale cap at 500 points** — Prevents single-card whales from dominating
- **Speed bonus: +10% early** — Rewards early engagement, creates urgency
- **Streak multiplier: ×1.1 per 3 days** — Encourages daily participation
- **No negative scoring** — Only add points, never subtract (participation > perfection)

### Entry & Economy
- **Credit-based entry & rewards** — Aligns with existing StackTrack economy
- **70/30 split** (70% to winners, 30% platform) — Standard marketplace rate
- **One-time claim** — Prevents double-dipping, atomic transactions
- **Atomic batch writes** — Prevents race conditions on join/claim

### Leaderboard
- **Poll-refresh (not WebSocket)** — Sufficient for engagement, simpler architecture
- **Paginated, 50/page** — Scales to 1000s of users without perf issues
- **Ranking deterministic** (by score DESC, then userId ASC) — Fair tiebreaking
- **Real-time updates from Cloud Function** — <2sec latency to leaderboard

### Anti-Cheat
- **Duplicate scan detection** — Same card scored only once per tournament
- **Whale cap** — Prevents $1000 cards from breaking the game
- **Streak tracking** — Can add cooldown or limits later if exploited
- **Phase 2 could add:** Behavior analysis, collusion detection, account age checks

---

## Known Limitations (Phase 1)

1. **No UI** — Use API directly or Firestore console for testing
2. **No admin UI for creating tournaments** — Use /api/admin/tournaments or Firestore
3. **No notifications** — No emails or in-app alerts on rank changes
4. **No badges on profiles** — Badge logic exists but not integrated with profile UI
5. **No sharing UI** — Share links generated but not shown to users
6. **Scoring is simplified** — Streak assumes ~1 scan/day, not actual day gaps
7. **No tournament cancellation** — Once started, can't be stopped
8. **No entry withdrawal** — Users can't leave once joined
9. **Cloud Functions require Firebase deployment** — Can't test locally without emulator
10. **No rate limiting** — Could add if abuse detected

---

## Performance Notes

### Estimated Latencies
- **Join tournament:** ~200-400ms (write entry + score docs)
- **Card score update:** ~100-200ms (Cloud Function processing)
- **Leaderboard query (50 items):** ~150-300ms (Firestore indexed query)
- **Claim reward:** ~200-400ms (atomic batch write)

### Database Indexing
Firestore should auto-create these if needed:
- `/tournament_scores`: (tournamentId, totalScore DESC, userId ASC)
- `/tournament_entries`: (userId, status, tournamentId)
- `/tournaments`: (status, endTime ASC)

### Scaling Limits
- **1000 concurrent users per tournament:** ~500-800ms leaderboard refresh
- **10 concurrent tournaments:** No issues (separate collections)
- **Storage:** ~1KB per entry + ~500B per score = ~1.5KB per user per tournament

---

## What's Next (Phase 2)

### UI Layer
1. `/dashboard/tournaments` — Hub page (featured, live, my tournaments)
2. `/dashboard/tournaments/[id]` — Detail view (join, rules, prizes)
3. `/dashboard/tournaments/[id]/leaderboard` — Full leaderboard component
4. `/dashboard/tournaments/[id]/my-entry` — Personal tracker
5. Reward claim modal with badge display

### Features
1. Real-time leaderboard polling (every 15-30s)
2. Rank change animations (↑ +3 spots)
3. Share modal with social buttons
4. Badge display on user profiles
5. Tournament notifications & emails
6. Admin tournament creation UI

### New Tournament Types
1. **Rarity Hunt** — Points based on card rarity tier, not value
2. **Head-to-Head Brackets** — 1v1 elimination, playoff-style

---

## Testing Resources

### Local Testing (No Firebase Required)
```bash
# Run unit tests
npm test -- tournament-system.test.ts

# Run core logic test
node scripts/test-tournament-core.js
```

### Firebase Testing
See `TOURNAMENT_PHASE1_GUIDE.md` for step-by-step E2E test with real Firestore.

### Cloud Function Logs
1. Firebase Console → Functions → scoreTournamentEntry → Logs
2. Look for: `[Tournament Scorer]` prefix in logs
3. Should see score calculations and errors (if any)

---

## Files Created/Modified

### New Files
- ✅ `lib/tournament-types.ts`
- ✅ `lib/tournament-scoring.ts`
- ✅ `lib/tournaments.ts`
- ✅ `app/api/tournaments/route.ts`
- ✅ `app/api/tournaments/[id]/join.ts`
- ✅ `app/api/tournaments/[id]/leaderboard.ts`
- ✅ `app/api/tournaments/[id]/claim-reward.ts`
- ✅ `app/api/admin/tournaments/route.ts`
- ✅ `functions/tournaments.ts`
- ✅ `firestore.rules` (updated with tournament rules)
- ✅ `TOURNAMENT_PHASE1_GUIDE.md`
- ✅ `__tests__/tournament-system.test.ts`
- ✅ `scripts/test-tournament-core.js`

### Files to Modify (Phase 2)
- `app/dashboard/layout.tsx` — Add "Tournaments" nav link
- `app/dashboard/page.tsx` — Add tournament banner
- `lib/useCurrentUser.ts` — Add tournament enrollment data

---

## Ready to Test!

✅ **Core loop is complete and ready for deployment.**

### Next Steps:
1. Run `node scripts/test-tournament-core.js` to validate scoring logic locally
2. Deploy Cloud Functions: `firebase deploy --only functions`
3. Deploy Firestore rules: `firebase deploy --only firestore:rules`
4. Follow `TOURNAMENT_PHASE1_GUIDE.md` to test end-to-end with real data
5. Once validated, move to Phase 2 (UI layer)

