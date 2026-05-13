/**
 * Tournament System - Phase 1: Core Loop Implementation Guide
 * 
 * This document covers:
 * 1. What was built
 * 2. How to test the core loop
 * 3. Cloud Function deployment
 * 4. Known limitations & next steps
 */

# Tournament System - Phase 1 Core Loop

## What Was Built

### Database Schema
- `/tournaments/{id}` - Tournament config, rules, status, prize pool
- `/tournament_entries/{tournamentId}_{userId}` - User entry with baseline snapshot
- `/tournament_scores/{tournamentId}_{userId}` - Real-time leaderboard scores
- `/tournament_rewards/{tournamentId}_{userId}` - Post-tournament rewards
- Firestore security rules added to protect collections

### Core Libraries
- `lib/tournament-types.ts` - TypeScript interfaces for all data structures
- `lib/tournament-scoring.ts` - Scoring engine (value + rarity + streak + whale cap)
- `lib/tournaments.ts` - Join, leaderboard, reward claim logic

### API Endpoints
- `POST /api/tournaments/[id]/join` - User joins, fee deducted
- `GET /api/tournaments/[id]/leaderboard` - Paginated leaderboard with real-time scores
- `POST /api/tournaments/[id]/claim-reward` - Claim reward, credits added
- `GET /api/tournaments` - List tournaments with filters

### Cloud Functions
- `functions/tournaments.ts` - Contains:
  - `scoreTournamentEntry` - Triggered on card scan, updates score in real-time
  - `finalizeTournaments` - Runs hourly, finalizes ended tournaments, creates rewards

## Core Loop Test (E2E)

### Prerequisites
1. Admin creates tournament via admin panel (UI coming in Phase 2)
2. User has credits in their balance
3. At least one active tournament exists

### Test Steps

#### 1. Setup: Create Test Tournament (CLI or Firestore UI)

**Via Firestore UI:**
1. Create document in `/tournaments/test-tournament-1`
2. Add these fields:
```json
{
  "type": "value_sprint",
  "name": "Test Tournament",
  "status": "active",
  "entryFeeCredits": 50,
  "minEntries": 2,
  "maxEntries": 100,
  "currentEntryCount": 0,
  "prizePoolCredits": 500,
  "platformCutPercent": 30,
  "winnerPercents": {
    "1": 40,
    "2": 30,
    "3": 20,
    "4-10": 10
  },
  "startTime": <NOW>,
  "endTime": <NOW + 72 hours>,
  "registrationDeadline": <NOW + 24 hours>,
  "rules": {
    "scoringConfig": {
      "pointsPerDollarGain": 1,
      "rarityBonusRare": 50,
      "rarityBonusUltraRare": 100,
      "streakMultiplierPerThreeDays": 1.1,
      "maxPointsPerTransaction": 500,
      "speedBonusPercent": 0.1
    },
    "antiCheatRules": {
      "ignoreDuplicateScans": true,
      "requireMinimumValueChange": 1,
      "enforceAccountAgeMinDays": 0
    }
  },
  "createdBy": "<admin-id>",
  "createdAt": <NOW>,
  "updatedAt": <NOW>
}
```

#### 2. User Joins Tournament

**Via API:**
```bash
curl -X POST http://localhost:3000/api/tournaments/test-tournament-1/join \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "displayName": "Test User",
    "email": "test@example.com",
    "photoUrl": "https://..."
  }'
```

**Expected response:**
```json
{
  "success": true,
  "entryId": "entry_1234567890_abc123",
  "message": "Successfully joined Test Tournament!"
}
```

**Verification:**
- ✅ User's creditBalance decreased by 50
- ✅ Document created at `/tournament_entries/test-tournament-1_user123`
- ✅ Document created at `/tournament_scores/test-tournament-1_user123` with totalScore=0

#### 3. User Scans Cards (Simulating Real App)

**In production, this happens automatically when user adds cards via the scanning system.**

**For testing, manually create cards:**
```javascript
// In Firestore UI or via app code
db.collection('cards').add({
  userId: 'user123',
  name: 'Pikachu Charizard',
  marketPrice: 250,
  value: 250,
  rarity: 'Ultra Rare',
  cardNumber: '001',
  year: 1999,
  set: 'Base Set',
  brand: 'Pokemon',
  addedAt: new Date(),
  // ... other card fields
})
```

**Cloud Function triggers automatically:**
- Detects card was added during tournament
- Calculates score: 250 * 1 (value) + 100 (ultra-rare bonus) + speed bonus (if <50% elapsed)
- **Total: ~360 points**
- Updates `/tournament_scores/test-tournament-1_user123` with new score
- Updates entry to track scanned card

**Verification in Firestore:**
- ✅ Card created in `/cards/{cardId}`
- ✅ Score updated: `totalScore` should be ~360
- ✅ `breakdown` shows valueGain: 250, rarityBonusPoints: 100, speedBonusPoints: ~36

#### 4. Check Leaderboard

**Via API:**
```bash
curl "http://localhost:3000/api/tournaments/test-tournament-1/leaderboard?pageSize=10&page=0&userId=user123"
```

**Expected response:**
```json
{
  "tournamentId": "test-tournament-1",
  "totalEntries": 1,
  "pageSize": 10,
  "currentPage": 0,
  "totalPages": 1,
  "entries": [
    {
      "rank": 1,
      "userId": "user123",
      "displayName": "Test User",
      "score": 360,
      "scoreBreakdown": {
        "valueGain": 250,
        "rarityBonusPoints": 100,
        "streakMultiplier": 1,
        "speedBonusPoints": 36,
        "transactionCap": 0
      }
    }
  ],
  "userEntry": { ... },
  "lastUpdated": "2026-05-11T12:34:56Z"
}
```

#### 5. Finalize Tournament (Simulate End)

**Option A: Update tournament to completed (manual)**
```javascript
// In Firestore UI
tournaments/test-tournament-1 -> status = "completed"
```

**Option B: Wait for Cloud Function (hourly)**
- Function runs at top of each hour
- Automatically finalizes tournaments where endTime < now

**Verification:**
- ✅ Documents created in `/tournament_rewards/test-tournament-1_user123`
- ✅ Reward shows: finalRank=1, creditsWon=200 (40% of 500), shareableLink generated

#### 6. User Claims Reward

**Via API:**
```bash
curl -X POST http://localhost:3000/api/tournaments/test-tournament-1/claim-reward \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "rewardId": "test-tournament-1_user123",
    "tournamentId": "test-tournament-1"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "creditsAdded": 200,
  "newBalance": 150,
  "badges": []
}
```

**Verification:**
- ✅ User creditBalance increased by 200 (was -50 from entry, now +150 net)
- ✅ Reward marked as `claimedAt` with txnId
- ✅ Attempting to claim again returns error "Reward already claimed"

## Cloud Function Deployment

### Prerequisites
1. Firebase project initialized with Cloud Functions
2. `functions/tournaments.ts` created (done above)
3. Firebase CLI installed (`npm i -g firebase-tools`)

### Deploy Steps

```bash
# Ensure you're in the project root
cd /path/to/stacktrackpro/web

# Authenticate Firebase (if not already)
firebase login

# Deploy only the tournament functions
firebase deploy --only functions:scoreTournamentEntry,functions:finalizeTournaments

# Or deploy all functions
firebase deploy --only functions
```

### Verify Deployment

1. **Check Firebase Console:**
   - Go to Firebase Project → Functions
   - Should see `scoreTournamentEntry` and `finalizeTournaments` listed
   - Check for recent executions and logs

2. **Test the trigger:**
   - Create a new card in Firestore
   - Go to Functions → scoreTournamentEntry → Logs
   - Should see execution logs indicating score was calculated

### Troubleshooting

**Function not triggering:**
- Check that `/cards/{cardId}` document has `userId` field
- Verify tournament status is "active" and current time is within startTime/endTime
- Check logs in Firebase Console for errors

**Score not updating:**
- Check Cloud Function logs for error messages
- Verify tournament document exists and has proper rules config
- Check `tournament_scores/{id}` document exists

**Finalization errors:**
- Ensure Cloud Scheduler is enabled (for pubsub trigger)
- Check logs for detailed error messages
- Verify tournament dates are in correct format (Timestamp type)

## Testing Checklist

- [ ] Tournament creation (Firestore or admin panel)
- [ ] User join (fee deducted, entry created)
- [ ] Card scan trigger (score updated via Cloud Function)
- [ ] Leaderboard query (top 100, pagination works)
- [ ] Whale cap (>$500 value transaction capped at 500 points)
- [ ] Anti-cheat (duplicate scan ignored)
- [ ] Streaks (multiple cards increase multiplier)
- [ ] Speed bonus (early cards get +10%)
- [ ] Tournament finalization (rewards created)
- [ ] Reward claim (credits added, claim lock works)
- [ ] Leaderboard real-time (scores update within 30s)

## Known Limitations (Phase 1)

1. **UI not built yet** - Use Firestore Console or API directly for testing
2. **No Cloud Function local testing** - Deploy to Firebase to test
3. **No admin panel** - Tournament creation requires Firestore direct access
4. **No notifications** - No emails or in-app alerts yet
5. **No badges** - Badge logic exists but not applied to UI
6. **No sharing** - Share links generated but no UI to show them
7. **Scoring is simplified** - Streak multiplier is approximation, not exact
8. **No anti-fraud** - No detection of exploits (e.g., card value manipulation)

## What's Next (Phase 2)

1. Build `/dashboard/tournaments` hub page
2. Build tournament detail pages with join UI
3. Build leaderboard component with real-time polling
4. Build reward claim & share UI
5. Implement tournament admin panel
6. Add notifications & emails
7. Add badge system to user profiles
8. Create "Featured Tournament" banner on dashboard

## Database Size & Performance Estimates

For 1000 users in a tournament:
- Tournament scores query: ~200-400ms (indexed by score)
- Score update (on card scan): ~100-200ms
- Entry creation: ~150-300ms
- Leaderboard pagination (50 items): ~150-300ms

Indexes required (create in Firebase Console if not auto-created):
- `/tournament_scores`: (tournamentId, totalScore DESC, userId ASC)
- `/tournament_entries`: (userId, status, tournamentId)
- `/tournaments`: (status, endTime ASC)

