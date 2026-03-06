# Card DNA Matching System - StackTrackPro

## Overview

The Card DNA system enables **fuzzy matching** that identifies cards even when OCR makes mistakes. Instead of exact text matching, it calculates a confidence score based on normalized "DNA" fields.

**Problem Solved:** OCR often misreads text:
- "Topps" → "Tops" (missing letter)
- "Los Angeles Lakers" → "LA Lakers" (abbreviation)
- "Kobe Bryant" → "Kobe Braynt" (typo)

**DNA Solution:** Normalize all fields and score matches:
- 95% match → Auto-select
- 80-94% match → High confidence
- 60-79% match → Medium confidence (show options)

## How It Works

### 1. DNA Profile

Every card gets a normalized "DNA" profile stored in the catalog:

```typescript
{
  "cardId": "STK-BASKETBALL-1996-TOPPS-138-KOBE",
  "name": "Kobe Bryant Rookie Card",
  "player": "Kobe Bryant",
  "year": 1996,
  "set": "Topps",
  "cardNumber": "138",
  "team": "Los Angeles Lakers",
  
  // DNA - Normalized for matching
  "dna": {
    "player": "kobe bryant",
    "team": "lakers",
    "year": "1996",
    "set": "topps",
    "number": "138"
  }
}
```

**DNA Fields:**
- All lowercase
- Punctuation removed
- Common abbreviations expanded
- Team names standardized

### 2. Normalization

The system applies intelligent transformations:

```typescript
// Team normalization
"LA Lakers" → "lakers"
"Los Angeles Lakers" → "lakers"
"L.A. Lakers" → "lakers"

// Set/brand normalization
"Tops" → "topps"
"TOPPS" → "topps"
"Topps Chrome" → "topps chrome"

// Number normalization
"138A" matches "138" (partial)
"#138" → "138" (remove symbol)
"054" matches "54" (leading zeros)
```

### 3. Scoring Algorithm

Each attribute has a weight. Matches accumulate points:

| Attribute | Weight | Notes |
|-----------|--------|-------|
| Player/Name | 40 | Most important identifier |
| Year | 25 | Strong filter |
| Set/Brand | 20 | Can vary (Chrome, Base, etc.) |
| Card Number | 10 | Often clear on scans |
| Team | 5 | Additional validation |
| Sport | 3 | Category filter |
| Type | 2 | TCG cards |

**Total Possible:** 100 points

**Example Scoring:**

Scan reads:
```
KOBE BRAYNT (typo)
1996
TOPS (missing P)
138
LA LAKERS
```

Catalog card DNA:
```json
{
  "player": "kobe bryant",
  "year": "1996",
  "set": "topps",
  "number": "138",
  "team": "lakers"
}
```

Score calculation:
```
Player: "kobe braynt" contains "bryant" → +28 (partial match, 70% of 40)
Year: "1996" === "1996" → +25 (exact match)
Set: "tops" partial match "topps" → +15 (75% of 20)
Number: "138" === "138" → +10 (exact match)
Team: "lakers" === "lakers" → +5 (exact match)

Total: 83/100 = 83% confidence (High)
```

### 4. Confidence Levels

Based on the percentage:

```typescript
≥95% - AUTO MATCH
├─ Automatically use this card
├─ No user confirmation needed
└─ Example: All fields exact match

80-94% - HIGH CONFIDENCE
├─ Show as top result
├─ Visually highlight
└─ Example: Minor OCR error in one field

60-79% - MEDIUM CONFIDENCE
├─ Show as possible match
├─ Yellow highlight
└─ Example: Multiple partial matches

40-59% - LOW CONFIDENCE
├─ Show in "Other possibilities"
├─ Gray highlight
└─ Example: Year + partial name only

<40% - NO MATCH
└─ Don't show
```

## API Reference

### DNA Matching Endpoint

```bash
POST /api/catalog/dna-match
```

**Request Body:**
```json
{
  "player": "Kobe Braynt",
  "team": "LA Lakers",
  "year": 1996,
  "set": "Tops",
  "cardNumber": "138",
  "sport": "basketball",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "stacktrackId": "STK-BASKETBALL-1996-TOPPS-138-KOBE",
      "catalogId": "xyz123",
      "name": "Kobe Bryant Rookie Card",
      "score": 83,
      "maxScore": 100,
      "percentage": 83,
      "confidence": "high",
      "breakdown": {
        "player": 28,
        "year": 25,
        "set": 15,
        "number": 10,
        "team": 5
      },
      "cardData": { /* full card details */ }
    }
  ],
  "totalMatches": 1,
  "autoMatch": null,
  "scanDNA": {
    "player": "kobe braynt",
    "team": "lakers",
    "year": "1996",
    "set": "tops",
    "number": "138"
  }
}
```

**GET Alternative:**
```bash
GET /api/catalog/dna-match?player=Kobe&year=1996&set=Topps&cardNumber=138
```

## Integration Examples

### 1. Scanner Integration

```typescript
import { matchCardDNA } from "@/lib/card-dna";

// After OCR extracts text
const scanResult = {
  player: "KOBE BRAYNT",
  year: 1996,
  set: "TOPS",
  cardNumber: "138",
  team: "LA LAKERS",
};

// Call DNA matching API
const response = await fetch("/api/catalog/dna-match", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(scanResult),
});

const data = await response.json();

if (data.autoMatch) {
  // ≥95% confidence - use automatically
  addCardToCollection(data.autoMatch.stacktrackId);
} else if (data.matches.length > 0) {
  // Show user the top matches
  showMatchOptions(data.matches);
} else {
  // No matches - manual entry
  showManualEntryForm(scanResult);
}
```

### 2. Manual Search

```typescript
// User types partial information
const searchQuery = {
  player: "kobe",
  year: 1996,
};

const response = await fetch("/api/catalog/dna-match", {
  method: "POST",
  body: JSON.stringify(searchQuery),
});

// Returns all cards with DNA matching
const { matches } = await response.json();
```

### 3. Validation

```typescript
// Verify user's manual entry
const userInput = {
  player: "Kobe Bryant",
  year: 1996,
  set: "Topps",
  cardNumber: "138",
};

const { autoMatch } = await fetch("/api/catalog/dna-match", {
  method: "POST",
  body: JSON.stringify(userInput),
}).then(r => r.json());

if (autoMatch) {
  // Card exists in catalog
  useExistingCard(autoMatch);
} else {
  // Create new catalog entry
  createCustomCard(userInput);
}
```

## Synonym Mappings

The system includes common text variations:

```typescript
// Teams
"la" → "los angeles"
"lakers" → "los angeles lakers"
"bulls" → "chicago bulls"
"heat" → "miami heat"

// Brands/Sets
"tops" → "topps"
"topp" → "topps"
"upper deck" → "upperdeck"
"prizm" → "prizm"
"chrome" → "chrome"

// Pokemon Sets
"base" → "base set"
"jungle" → "jungle"
"fossil" → "fossil"

// Common OCR mistakes
"0" → "o" (zero to letter O)
"1" → "i" (one to letter i)
"5" → "s" (five to letter s)
"8" → "b" (eight to letter b)
```

## Performance

### Search Optimization

Before DNA scoring, the system pre-filters the catalog:

```typescript
// Step 1: Narrow search (Firestore query)
// - Year filter (if provided)
// - Player/name search terms (if provided)
// - Returns ~100 cards instead of millions

// Step 2: DNA score remaining cards (in-memory)
// - Calculate score for each card
// - Sort by score
// - Return top 10 matches
```

**Timing:**
- Pre-filter: 100-300ms (Firestore query)
- DNA scoring: 10-50ms (100 cards @ 0.5ms each)
- Total: ~150-350ms

### Comparison to Exact Match

**Before (Exact String Match):**
```typescript
// Fails with any variation
query(where("player", "==", "Kobe Braynt")) // ❌ No results
query(where("set", "==", "Tops"))           // ❌ No results
```

**After (DNA Fuzzy Match):**
```typescript
// Finds matches despite errors
matchCardDNA({ player: "Kobe Braynt", set: "Tops" })
// ✅ Returns: "Kobe Bryant Rookie" (83% match)
```

## Real-World Examples

### Example 1: Perfect Scan

```json
Scan: {
  "player": "Kobe Bryant",
  "year": 1996,
  "set": "Topps",
  "cardNumber": "138",
  "team": "Los Angeles Lakers"
}

Result:
✅ AUTO MATCH (100%)
└─ STK-BASKETBALL-1996-TOPPS-138-KOBE
```

### Example 2: OCR Errors

```json
Scan: {
  "player": "KOBE BRAYNT",
  "year": 1996,
  "set": "TOPS",
  "cardNumber": "138",
  "team": "LA"
}

Result:
⚡ HIGH CONFIDENCE (83%)
├─ STK-BASKETBALL-1996-TOPPS-138-KOBE
└─ Breakdown: player+28, year+25, set+15, number+10, team+5
```

### Example 3: Incomplete Scan

```json
Scan: {
  "player": "Kobe",
  "year": 1996
}

Result:
⚠️  MEDIUM CONFIDENCE (65%)
├─ STK-BASKETBALL-1996-TOPPS-138-KOBE (65%)
├─ STK-BASKETBALL-1996-FLEER-203-KOBE (65%)
└─ STK-BASKETBALL-1996-SKYBOX-055-KOBE (65%)

Action: Show user all options to choose from
```

### Example 4: Pokemon Card

```json
Scan: {
  "name": "Charazard",  // Typo
  "year": 1999,
  "set": "Base Set",
  "cardNumber": "4"
}

Result:
✅ HIGH CONFIDENCE (88%)
└─ STK-POKEMON-1999-BASE-004-CHARIZARD
```

## Testing

### Admin Dashboard

Access the DNA testing interface at:
```
/dashboard/admin/dna-match
```

**Features:**
- Quick example buttons
- Live DNA preview
- Match scoring breakdown
- Confidence visualization

### Test Cases

```typescript
// Test 1: Perfect match
{
  player: "Kobe Bryant",
  year: 1996,
  set: "Topps",
  cardNumber: "138"
}
// Expected: 95-100% auto-match

// Test 2: OCR errors
{
  player: "Kobe Braynt",
  year: 1996,
  set: "Tops"
}
// Expected: 80-90% high confidence

// Test 3: Partial data
{
  player: "Kobe",
  year: 1996
}
// Expected: 60-70% medium confidence, multiple options
```

## Future Enhancements

### 1. Machine Learning

Train model on successful matches:
- Learn common OCR error patterns
- Adjust weights automatically
- Improve synonym detection

### 2. Image Similarity

Combine DNA with visual matching:
```typescript
score = (dnaSimilarity * 0.7) + (imageSimilarity * 0.3)
```

### 3. User Feedback

Track which matches users select:
```typescript
// If user rejects high-confidence match
// → Adjust weights for that card type
```

### 4. Context-Aware Scoring

Adjust weights by card type:
```typescript
// Sports cards: Player + Year most important
weights.sports = { player: 40, year: 25, ... }

// Pokemon: Name + Set most important
weights.pokemon = { name: 40, set: 25, ... }
```

## Troubleshooting

### Issue: No Matches Found

**Cause:** Pre-filter too restrictive or typo in critical field

**Solution:**
1. Check if year is correct
2. Check if player/name has minimum 3 characters
3. Try with just year filter
4. Check catalog has been imported

### Issue: Wrong Auto-Match

**Cause:** Multiple very similar cards (variants, parallels)

**Solution:**
1. Lower auto-match threshold from 95% to 90%
2. Add more fields (team, card number)
3. Show top 3 matches even with high confidence

### Issue: Low Confidence for Obvious Match

**Cause:** OCR misread multiple critical fields

**Solution:**
1. Review synonym mappings
2. Add more year/number data to scan
3. Use partial matching mode

## Architecture

```
Scanner/OCR
     │
     ├─ Extract text
     │
     ▼
DNA Normalization
     │
     ├─ Lowercase
     ├─ Remove punctuation
     ├─ Apply synonyms
     │
     ▼
Pre-Filter Catalog
     │
     ├─ Year query (if available)
     ├─ Player/name query (if available)
     ├─ Fetch ~100 candidates
     │
     ▼
DNA Scoring
     │
     ├─ Score each candidate
     ├─ Calculate percentage
     ├─ Determine confidence
     ├─ Sort by score
     │
     ▼
Return Matches
     │
     ├─ autoMatch (≥95%)
     ├─ Top 10 matches
     └─ Breakdown scores
```

## Files

- **lib/card-dna.ts** - Core DNA logic (400 lines)
  - `generateCardDNA()` - Create normalized profile
  - `calculateDNAScore()` - Score two profiles
  - `matchCardDNA()` - Find matches in array
  - `normalizeText()` - Text normalization
  
- **app/api/catalog/dna-match/route.ts** - Matching API (200 lines)
  - POST endpoint for matching
  - GET endpoint for testing
  - Pre-filtering logic
  
- **app/dashboard/admin/dna-match/page.tsx** - Testing UI (400 lines)
  - Example buttons
  - Live DNA preview
  - Match visualization
  
- **CARD_DNA_SYSTEM.md** - This documentation

## Integration Checklist

- [ ] Import cards into catalog (includes DNA generation)
- [ ] Test DNA matching at /dashboard/admin/dna-match
- [ ] Update scanner to use DNA matching API
- [ ] Add match selection UI for medium/low confidence
- [ ] Monitor match success rates
- [ ] Adjust weights based on data

## Support

For issues or questions:
- Review example test cases at /dashboard/admin/dna-match
- Check synonym mappings in lib/card-dna.ts
- Verify catalog has DNA fields (should be auto-generated on import)
- Test with simple queries first (just year + name)
