# Universal Card ID System - StackTrackPro

## Overview

The Universal Card ID System provides a single, permanent identifier for every card across all of StackTrackPro's features. This eliminates data duplication, enables powerful cross-feature analytics, and simplifies marketplace/auction integrations.

## Architecture

### 1. Universal ID Format

**Pattern:** `STK-{GAME}-{YEAR}-{SET}-{NUMBER}-{NAME}`

**Examples:**
```
STK-BASKETBALL-1996-TOPPS-138-KOBE
STK-POKEMON-1999-BASE-004-CHARIZARD
STK-MAGIC-1993-ALPHA-001-BLACK
STK-FOOTBALL-2017-PRIZM-050-MAHOMES
```

**Components:**
- `STK` - StackTrack prefix (all IDs start with this)
- `GAME` - Game/sport category (BASKETBALL, POKEMON, MAGIC, etc.)
- `YEAR` - Card release year (4 digits, 0000 if unknown)
- `SET` - Set/brand identifier (sanitized, max 20 chars)
- `NUMBER` - Card number (padded to 3 digits, max 10 chars)
- `NAME` - Primary identifier (player name or card name, first word only)

**Length:** Max 80 characters
**Format:** Alphanumeric + hyphens only

### 2. Database Structure

#### Card Catalog (Master Database)

```
cardCatalog/
  ├── pokemon/
  │   └── cards/
  │       └── {catalogId}
  │           ├── stacktrackId: "STK-POKEMON-1999-BASE-004-CHARIZARD"
  │           ├── catalogId: "base1-4"
  │           ├── tcgplayerId: "12345"
  │           ├── name: "Charizard"
  │           ├── game: "pokemon"
  │           ├── set: {...}
  │           ├── cardNumber: "4"
  │           ├── year: 1999
  │           ├── images: {...}
  │           └── pricing: {...}
  │
  ├── magic/
  │   └── cards/...
  │
  ├── yugioh/
  │   └── cards/...
  │
  └── sports/
      └── cards/...
```

#### User Collections (References Only)

```
userCollections/
  └── {itemId}
      ├── userId: "user123"
      ├── stacktrackId: "STK-BASKETBALL-1996-TOPPS-138-KOBE"
      ├── condition: "PSA 9"
      ├── quantity: 1
      ├── purchasePrice: 1200
      ├── purchaseDate: "2024-01-15"
      ├── folderId: "folder1"
      ├── customValue: 1500 (optional override)
      ├── customImageUrl: "..." (optional override)
      ├── createdAt: timestamp
      └── updatedAt: timestamp
```

#### Marketplace Listings (References Only)

```
marketplaceListings/
  └── {listingId}
      ├── stacktrackId: "STK-BASKETBALL-1996-TOPPS-138-KOBE"
      ├── sellerId: "user456"
      ├── price: 1200
      ├── condition: "PSA 9"
      ├── quantity: 1
      ├── status: "active"
      └── createdAt: timestamp
```

#### Auction Listings (References Only)

```
auctionListings/
  └── {auctionId}
      ├── stacktrackId: "STK-BASKETBALL-1996-TOPPS-138-KOBE"
      ├── sellerId: "user789"
      ├── currentBid: 1000
      ├── endTime: timestamp
      └── status: "active"
```

#### Price History (Tracking Over Time)

```
priceHistory/
  └── {entryId}
      ├── stacktrackId: "STK-BASKETBALL-1996-TOPPS-138-KOBE"
      ├── date: "2024-03-05"
      ├── marketPrice: 950
      ├── lowPrice: 800
      ├── highPrice: 1200
      └── source: "pricecharting"
```

## Benefits

### 1. Single Source of Truth

Every card has exactly ONE record in the catalog. All features reference this record.

**Without Universal ID:**
```
User Collection -> Stores full card data (name, player, year, etc.)
Marketplace -> Stores full card data again
Auction -> Stores full card data again
Price Tracking -> Doesn't know which cards are the same
```

**With Universal ID:**
```
Card Catalog -> ONE card record: STK-NBA-1996-TOPPS-138-KOBE
     │
     ├─→ User Collections (reference only)
     ├─→ Marketplace Listings (reference only)
     ├─→ Auction Listings (reference only)
     └─→ Price History (tracks over time)
```

### 2. Data Consistency

Card details (name, image, stats) update in ONE place, affecting all features instantly.

**Example:** Charizard image URL changes in catalog
- Collections automatically show new image
- Marketplace listings show new image
- Auction listings show new image
- No manual updates needed

### 3. Powerful Analytics

Universal IDs enable cross-feature analytics:

```typescript
// Get all data for one card across entire platform
const cardId = "STK-NBA-1996-TOPPS-138-KOBE";

// How many users own it?
const owners = await countCollectionsByCardId(cardId);

// What's the price trend?
const history = await getPriceHistory(cardId, 90); // Last 90 days

// How many are for sale?
const listings = await getMarketplaceListings(cardId);

// What's the average sale price?
const avgPrice = await getAverageSalePrice(cardId);
```

### 4. Marketplace Integration

Buyers can see:
- How many exist in user collections
- Price history over time
- Recent auction prices
- Trending cards (most traded)

### 5. Portfolio Tracking

```typescript
// Calculate user's total collection value
const collection = await getUserCollection(userId);
const totalValue = collection.reduce((sum, item) => {
  const catalogCard = getCatalogCard(item.stacktrackId);
  const itemValue = catalogCard.pricing.market * item.quantity;
  return sum + itemValue;
}, 0);
```

### 6. External ID Mapping

Cards can have multiple external IDs stored in catalog:

```typescript
{
  stacktrackId: "STK-POKEMON-1999-BASE-004-CHARIZARD",
  catalogId: "base1-4",        // Pokemon TCG API
  tcgplayerId: "12345",         // TCGplayer
  pricechartingId: "98765",     // PriceCharting
  psaId: "123"                  // PSA grading
}
```

This allows:
- Import from any source
- Price updates from multiple APIs
- Grading authentication
- External marketplace sync

## API Reference

### Generate Universal ID

```typescript
import { generateStackTrackId } from "@/lib/universal-card-id";

const stacktrackId = generateStackTrackId({
  game: "basketball",
  name: "Kobe Bryant Rookie Card",
  player: "Kobe Bryant",
  year: 1996,
  set: "Topps",
  cardNumber: "138",
  sport: "basketball"
});
// Returns: "STK-BASKETBALL-1996-TOPPS-138-KOBE"
```

### Lookup Card by ID

```typescript
import { getCatalogCardById } from "@/lib/card-references";

const card = await getCatalogCardById("STK-NBA-1996-TOPPS-138-KOBE");
// Returns: CatalogCard with full details
```

### Add Card to Collection (Reference-Based)

```typescript
import { addCardToCollection } from "@/lib/card-references";

const itemId = await addCardToCollection(
  userId,
  "STK-BASKETBALL-1996-TOPPS-138-KOBE",
  {
    condition: "PSA 9",
    quantity: 1,
    purchasePrice: 1200,
  }
);
```

### Get Collection with Catalog Data

```typescript
import { getUserCollectionWithCatalog } from "@/lib/card-references";

const collection = await getUserCollectionWithCatalog(userId);
// Returns: Array of { collection: CollectionItem, catalog: CatalogCard }

for (const item of collection) {
  console.log(item.catalog.name); // Card name from catalog
  console.log(item.collection.condition); // User's condition
  console.log(item.catalog.pricing.market); // Current market price
}
```

### Create Marketplace Listing

```typescript
import { createMarketplaceListing } from "@/lib/marketplace";

const listingId = await createMarketplaceListing({
  stacktrackId: "STK-BASKETBALL-1996-TOPPS-138-KOBE",
  sellerId: userId,
  price: 1200,
  condition: "PSA 9",
  quantity: 1,
});
```

### API Endpoints

#### ID Lookup

```bash
# Get card by StackTrack ID
GET /api/catalog/id-lookup?stacktrackId=STK-NBA-1996-TOPPS-138-KOBE

# Get card by external catalog ID
GET /api/catalog/id-lookup?catalogId=base1-4

# Search by name/year/set
GET /api/catalog/id-lookup?name=Kobe&year=1996&set=Topps

# Generate StackTrack ID
POST /api/catalog/id-lookup
{
  "cardData": {
    "game": "basketball",
    "name": "Kobe Bryant",
    "year": 1996,
    "set": "Topps",
    "cardNumber": "138"
  },
  "checkExists": true
}

# Bulk ID generation
PUT /api/catalog/id-lookup/bulk
{
  "cards": [
    { "game": "pokemon", "name": "Charizard", ... },
    { "game": "magic", "name": "Black Lotus", ... }
  ]
}
```

## Migration Strategy

### Phase 1: Parallel Systems (CURRENT)

- Keep existing `cards` collection
- Add new `userCollections` (reference-based)
- Catalog cards now include `stacktrackId`
- Both systems work simultaneously

### Phase 2: Gradual Migration

```typescript
// Migrate existing cards to reference system
import { migrateOldCardToReferences } from "@/lib/card-references";

const oldCards = await getOldUserCards(userId);
for (const oldCard of oldCards) {
  await migrateOldCardToReferences(oldCard);
}
```

### Phase 3: Complete Transition

- All new cards use reference system
- Scanner creates catalog entries + collection references
- Marketplace/auctions use stacktrackId
- Old `cards` collection deprecated

## Performance Improvements

### Before (No Universal ID)

```
User loads collection:
├─ Fetch 100 user cards (100 reads)
├─ Each card stores full data (50KB per card)
└─ Total: 5MB transferred

Price update:
├─ Fetch 100 user cards
├─ Update each card individually (100 writes)
└─ Total: 100 write operations
```

### After (With Universal ID)

```
User loads collection:
├─ Fetch 100 collection items (100 reads, 5KB per item)
├─ Fetch 100 unique catalog cards (100 reads, cached)
└─ Total: 500KB transferred (90% reduction)

Price update:
├─ Update catalog card (1 write)
├─ All collections automatically reflect new price
└─ Total: 1 write operation (99% reduction)
```

## Cost Analysis

### Firestore Operations

**Before:**
- 100 users with Kobe rookie card
- Price update = 100 writes (1 per collection)
- Monthly price updates = 3,000 writes/month
- Cost: $0.054 per month (for one card)

**After:**
- 100 users with Kobe rookie card
- Price update = 1 write (catalog only)
- Monthly price updates = 30 writes/month
- Cost: $0.00054 per month (99% reduction)

**Savings for 1,000 cards:** $54/month → $0.54/month

## Real-World Examples

### Example 1: Portfolio Value

```typescript
// User has 500 cards in collection
// All stored as references, not full data

const { totalValue, breakdown } = await calculateCollectionValue(userId);
console.log(`Total: $${totalValue}`);

// Breakdown by card
for (const [stacktrackId, value] of Object.entries(breakdown)) {
  console.log(`${stacktrackId}: $${value}`);
}
```

### Example 2: Trending Cards

```typescript
// Find most traded cards this week
const trendig = await getTrendingCards(7); // Last 7 days

// Returns cards by transaction count
[
  {
    stacktrackId: "STK-NBA-1996-TOPPS-138-KOBE",
    transactions: 45,
    avgPrice: 1150,
    priceChange: +5.2%
  },
  ...
]
```

### Example 3: Marketplace Search

```typescript
// Find all Kobe cards for sale
const results = await searchMarketplace("Kobe Bryant");

// Returns marketplace listings with catalog data
for (const result of results) {
  console.log(result.catalog.name); // "Kobe Bryant Rookie Card"
  console.log(result.listing.price); // Seller's asking price
  console.log(result.catalog.pricing.market); // Market value
}
```

## Troubleshooting

### Issue: Card Not Found in Catalog

**Solution:** Import card into catalog first

```typescript
// Option 1: Import from external API
await importPokemonCards("base1", 102);

// Option 2: Create custom catalog entry
const stacktrackId = generateStackTrackId({...});
await createCatalogCard(stacktrackId, cardData);
```

### Issue: Duplicate IDs

**Solution:** Add suffix for duplicates

```typescript
// System automatically handles duplicates
STK-POKEMON-1999-BASE-004-CHARIZARD
STK-POKEMON-1999-BASE-004-CHARIZARD-1 (first duplicate)
STK-POKEMON-1999-BASE-004-CHARIZARD-2 (second duplicate)
```

### Issue: Migration Errors

**Solution:** Batch process with error handling

```typescript
const results = { success: 0, failed: 0, errors: [] };

for (const oldCard of oldCards) {
  try {
    await migrateOldCardToReferences(oldCard);
    results.success++;
  } catch (err) {
    results.failed++;
    results.errors.push(`${oldCard.name}: ${err.message}`);
  }
}

console.log(results);
```

## Next Steps

1. **Import Core Sets:** Use admin dashboard to import popular card sets
2. **Test Scanner Integration:** Verify scanner creates proper stacktrackIds
3. **Migrate Existing Data:** Run migration script for current user collections
4. **Update UI:** Show catalog images and data in collection views
5. **Enable Marketplace:** Launch marketplace with reference-based listings

## Support

For questions or issues:
- Check CARD_CATALOG_SYSTEM.md for catalog import details
- Review universal-card-id.ts for ID generation logic
- See card-references.ts for collection management functions
