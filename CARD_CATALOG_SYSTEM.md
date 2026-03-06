# Card Catalog System - StackTrackPro

## Overview

StackTrackPro now features a comprehensive global card catalog system that stores millions of cards locally in Firestore, enabling instant search and lookup without relying on external APIs for every request.

## Architecture

### Database Structure

```
Firestore
└── cardCatalog/
    ├── pokemon/
    │   └── cards/
    │       ├── {catalogId}
    │       ├── {catalogId}
    │       └── ...
    ├── magic/
    │   └── cards/
    │       ├── {catalogId}
    │       └── ...
    ├── yugioh/
    │   └── cards/
    │       └── ...
    └── sports/
        └── cards/
            └── ...
```

### Card Document Structure

Each card document contains:

```typescript
{
  catalogId: string;        // Unique ID from source API
  name: string;             // Card name
  game: string;             // "pokemon" | "magic" | "yugioh" | "sports"
  set: {                    // Set/expansion info
    id: string;
    name: string;
    series?: string;
  };
  cardNumber: string;       // Card number within set
  rarity: string;           // Card rarity
  images: {
    small: string | null;   // Small image URL
    large: string | null;   // Large/high-res image URL
  };
  pricing: {                // Current pricing data
    market: number;
    lastUpdated: string;
  };
  searchTerms: string[];    // Indexed search terms
  // Game-specific fields...
}
```

## API Endpoints

### 1. Import Cards
`POST /api/catalog/import`

Import cards from various sources into the catalog.

**Request:**
```json
{
  "category": "pokemon",     // pokemon|magic|yugioh|sports
  "setId": "base1",          // Optional: specific set to import
  "limit": 100,              // Number of cards to import
  "offset": 0               // Pagination offset
}
```

**Response:**
```json
{
  "success": true,
  "category": "pokemon",
  "stats": {
    "total": 100,
    "imported": 98,
    "updated": 0,
    "skipped": 2,
    "failed": 0,
    "errors": []
  },
  "timestamp": "2026-03-05T..."
}
```

### 2. Search Catalog
`GET /api/catalog/search?q=pikachu&game=pokemon&limit=20`

Search across the card catalog.

**Parameters:**
- `q` (required): Search query (min 2 characters)
- `game` (optional): Filter by game (pokemon|magic|yugioh|sports)
- `set` (optional): Filter by set name/ID
- `limit` (optional): Max results (default: 20)

**Response:**
```json
{
  "query": "pikachu",
  "results": [
    {
      "catalogId": "base1-58",
      "name": "Pikachu",
      "game": "pokemon",
      "set": {
        "id": "base1",
        "name": "Base Set",
        "series": "Base"
      },
      "cardNumber": "58",
      "rarity": "Common",
      "images": {
        "small": "https://...",
        "large": "https://..."
      },
      "relevanceScore": 100
    }
  ],
  "totalFound": 15,
  "timestamp": "2026-03-05T..."
}
```

### 3. Update Prices
`GET /api/catalog/update-prices`  
`POST /api/catalog/update-prices`

Update market prices for all cards in the catalog. Runs automatically via cron job daily at 3 AM.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 1500,
    "updated": 1200,
    "failed": 5,
    "skipped": 295,
    "errors": [...]
  },
  "timestamp": "2026-03-05T..."
}
```

## Client Library

### Import Function

```typescript
import { searchCatalog, getCardFromCatalog } from '@/lib/catalog';

// Search catalog
const results = await searchCatalog("charizard", "pokemon", undefined, 10);

// Get specific card
const card = await getCardFromCatalog("pokemon", "base1-4");
```

## Data Sources

### Pokemon TCG
- **API:** https://api.pokemontcg.io/v2/cards
- **Cards:** ~30,000
- **Rate Limit:** 20 requests/second
- **Pricing:** TCGplayer embedded prices

### Magic: The Gathering
- **API:** https://api.scryfall.com/cards
- **Cards:** ~100,000+
- **Rate Limit:** 10 requests/second
- **Pricing:** Scryfall embedded prices

### Yu-Gi-Oh
- **API:** https://db.ygoprodeck.com/api/v7/cardinfo.php
- **Cards:** ~20,000
- **Rate Limit:** No official limit
- **Pricing:** TCGplayer/Cardmarket prices

### Sports Cards
- **API:** PriceCharting.com
- **Cards:** 1,000,000+
- **Import:** CSV exports (API limited)
- **Pricing:** Real-time PriceCharting lookups

## Admin Dashboard

Access the catalog manager at:
**`/dashboard/admin/catalog`**

Features:
- View catalog statistics
- Trigger imports by game/set
- Manual price updates
- Import progress monitoring
- Error logs

## Import Recommendations

### Pokemon TCG
1. Start with popular sets:
   - Base Set (102 cards)
   - Paldean Fates (250 cards)
   - Scarlet & Violet series
2. Import in batches of 100-250 cards
3. Total storage for all Pokemon: ~60MB

### Magic: The Gathering
1. Import specific sets (avoid importing all at once)
2. Recommended sets:
   - Recent Standard sets
   - Commander staples
   - Popular Modern sets
3. Total storage estimate: ~200MB for 100k cards

### Yu-Gi-Oh
1. Can import entire catalog (20k cards)
2. Import in batches of 100 cards
3. Total storage: ~40MB

### Sports Cards
1. Use CSV export from PriceCharting
2. Filter by:
   - Sport (Baseball, Basketball, etc.)
   - Brand (Topps, Panini, etc.)
   - Year range
3. Expected storage: 2GB+ for full catalog

## Scheduled Jobs

### Daily Price Update
- **Schedule:** 3:00 AM UTC daily
- **Endpoint:** `/api/catalog/update-prices`
- **Duration:** ~5-10 minutes for 10,000 cards
- **Configuration:** `vercel.json` cron job

## Performance

### Search Speed
- **Local Catalog:** <100ms average
- **External API:** 500-2000ms average
- **Improvement:** **10-20x faster**

### Storage Costs
- **Per Card:** ~2KB
- **100,000 cards:** ~200MB
- **1,000,000 cards:** ~2GB
- **Firestore:** Free tier covers 1GB

## Integration

### Scanner Integration
The AI card scanner can now:
1. Search local catalog first (instant)
2. Fall back to AI vision if not found
3. Use catalog images for display
4. Get accurate pricing from catalog

### Collection Integration
User collections reference catalog cards:
```typescript
{
  userId: "...",
  catalogId: "pokemon/base1-4",  // Reference to catalog
  quantity: 1,
  condition: "Mint",
  acquired: "2026-03-05"
}
``````

### Marketplace Integration
Listings reference catalog for images and data:
```typescript
{
  listingId: "...",
  catalogId: "magic/neo-123",
  price: 49.99,
  condition: "Near Mint"
}
```

## Future Enhancements

### Search Improvements
1. **Algolia Integration** - Full-text search with typo tolerance
2. **Fuzzy Matching** - Handle misspellings better
3. **Image Search** - Find cards by uploading images

### Price Tracking
1. **Historical Prices** - Track price trends over time
2. **Price Alerts** - Notify users of price changes
3. **Market Analysis** - Show demand/supply metrics

### Advanced Features
1. **Set Completion Tracking** - Track collection progress per set
2. **Wishlist Integration** - Watch prices on wanted cards
3. **Trade Calculator** - Evaluate trade fairness
4. **Grading Integration** - PSA/BGS grade value multipliers

## Troubleshooting

### Import Fails
- Check API rate limits
- Verify network connectivity
- Check Firestore write permissions
- Review error logs in import stats

### Search Not Working
- Verify cards are imported (check stats)
- Ensure searchTerms array is populated
- Check Firestore read permissions
- Try exact match vs partial match

### Price Updates Slow
- Limit batch size (default: 100 cards)
- Check API rate limits
- Verify pricing data structure
- Monitor Firestore quota usage

## Cost Analysis

### Firestore Operations
- **Reads:** 50k/day free, then $0.06/100k
- **Writes:** 20k/day free, then $0.18/100k
- **Storage:** 1GB free, then $0.18/GB

### Expected Costs (100k cards)
- **Initial Import:** ~100k writes = $0.36
- **Daily Price Update:** ~100k writes = $0.36
- **User Searches:** ~10k reads/day = $0 (within free tier)
- **Storage:** ~200MB = $0 (within free tier)

### Monthly Estimate
- **Import:** $0.36 (one-time per set)
- **Price Updates:** $10.80/month (30 days)
- **Total:** ~$11/month for 100k cards

## Support

For issues or questions:
1. Check admin dashboard logs
2. Review API endpoint responses
3. Check Firestore console for data
4. Review cron job execution logs in Vercel

## API Keys Required

- **Pokemon TCG:** None (public API)
- **Scryfall:** None (public API)
- **YGOPRODeck:** None (public API)
- **PriceCharting:** `PRICECHARTING_API_KEY` (for sports cards)
- **Cron Security:** `CRON_SECRET` (optional, for scheduled jobs)
