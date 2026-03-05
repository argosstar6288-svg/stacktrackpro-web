# Pokemon TCG Card Database Integration

This guide explains how to populate your Firestore database with Pokemon TCG card image data.

## Overview

The Pokemon TCG card data integration provides three ways to import card images into Firestore:

1. **Web Admin Dashboard** - Easy UI for importing via your app
2. **Command-line Script** - Standalone Node.js script for bulk imports
3. **Programmatic API** - Use directly in your code

## What Gets Stored

Each card record includes:

```typescript
{
  id: "sv04pt-1",                    // Pokemon TCG card ID
  name: "Bulbasaur",                 // Card name
  supertype: "Pokémon",              // Card type
  types: ["Grass"],                  // Card types
  hp: 40,                            // Hit points
  images: {
    small: "...",                    // Small image URL
    large: "..."                     // Large image URL
  },
  set: {
    id: "sv04pt",
    name: "Paldean Fates",
    series: "Scarlet & Violet"
  },
  // ... plus more metadata
}
```

## Option 1: Web Admin Dashboard (Easiest)

### Import Popular Sets (Recommended)

1. Navigate to: `/dashboard/admin/pokemon-tcg-import`
2. Click **"Import Popular Sets"** button
3. Wait for import to complete (~1-3 minutes for 1000-1500 cards)
4. Check statistics to verify success

**Popular Sets Include:**
- Scarlet & Violet - Paldean Fates
- Scarlet & Violet - Obsidian Flames
- Scarlet & Violet - Paradox Rift
- Scarlet & Violet - 151
- Scarlet & Violet - Temporal Forces

### Import All Sets

1. Navigate to: `/dashboard/admin/pokemon-tcg-import`
2. Click **"Import All Sets"** button
3. Wait for import to complete (~5-10 minutes for 20,000+ cards)
4. Monitor progress in real-time

### Import from JSON File

1. Generate a JSON file with cards (see Option 2 below)
2. Navigate to: `/dashboard/admin/pokemon-tcg-import`
3. Use **"Import from JSON File"** section
4. Select your JSON file and upload
5. Wait for Firestore import to complete

## Option 2: Command-Line Script

### Prerequisites

```bash
npm install          # Install dependencies
```

### Basic Usage

```bash
# Import popular sets (recommended)
node scripts/import-pokemon-tcg.js

# Import all sets
node scripts/import-pokemon-tcg.js --all

# Import specific sets
node scripts/import-pokemon-tcg.js --sets sv04pt,sv4pt,sv04

# Get help
node scripts/import-pokemon-tcg.js --help
```

### Environment Variables

```bash
# Override the API URL
POKEMON_TCG_API_URL=https://api.pokemontcg.io/v2/cards

# Cards per API request (default: 250)
PAGE_SIZE=250

# Maximum cards to fetch (default: all)
MAX_CARDS=1000
```

### Example: Full Script

```bash
# Fetch popular sets and save to JSON
node scripts/import-pokemon-tcg.js

# Then upload the JSON via the admin dashboard
```

### Output

The script generates:
- A timestamped JSON file: `pokemon-tcg-cards-1234567890.json`
- A detailed report with statistics
- Ready to upload via the Web Dashboard

## Option 3: Programmatic API

### Using in Your Code

```typescript
import { batchUploadCards } from '@/app/lib/firestore-cards';
import { fetchPokeemonTCGCards } from '@/app/lib/pokemon-tcg-importer';

async function importCards() {
  // Fetch cards from Pokemon TCG API
  const cards = await fetchPokeemonTCGCards({
    setIds: ['sv04pt', 'sv4pt'],  // Optional: specific sets
    pageSize: 250,
    limit: 1000,                  // Optional: max cards
  });

  // Upload to Firestore
  const stats = await batchUploadCards(cards);
  
  console.log(`Imported: ${stats.imported} cards`);
  console.log(`Failed: ${stats.failed} cards`);
}
```

### Firestore Service Functions

```typescript
// Search by exact name
const card = await searchCardsByName('Charizard');

// Search by partial name
const cards = await searchCardsPartial('char');

// Get by Pokemon TCG card ID
const card = await getCardById('sv04pt-5');

// Get by set
const cards = await getCardsBySet('sv04pt');

// Get by card type
const cards = await getCardsByType('Fire');

// Get collection statistics
const stats = await getCollectionStats();
// Returns: { totalCards, uniqueSets, uniqueTypes, supertypes }

// Update card metadata
await updateCard('sv04pt-5', { 
  customField: 'value' 
});

// Delete a card
await deleteCard('sv04pt-5');

// Clear entire collection (⚠️ use with caution!)
await clearCardCollection();
```

## Popular Set IDs Reference

| Set ID  | Name                              | Release |
|---------|-----------------------------------|---------|
| sv04pt  | Paldean Fates                     | Nov 2024 |
| sv4pt   | Obsidian Flames                   | Aug 2024 |
| sv04    | Paradox Rift                      | May 2024 |
| sv3pt   | Pokémon 151                       | Jun 2024 |
| sv3     | Temporal Forces                   | Apr 2024 |
| sv2pt   | Pokémon 151                       | Jun 2023 |
| sv2     | Paldea Evolved                    | Aug 2023 |
| sv1pt   | Paldean Fates                     | Oct 2023 |
| sv1     | Scarlet & Violet                  | Apr 2023 |

## Data Storage

### Firestore Collection Structure

```
firestore:
  └── pokemon_tcg_cards/
      ├── sv04pt-1    (Bulbasaur)
      ├── sv04pt-2    (Ivysaur)
      ├── sv04pt-3    (Venusaur)
      └── ... (20,000+ cards)
```

### Firestore Batch Limits

- **Max writes per batch:** 500 (automatically handled by the import script)
- **Max bulk import:** 20,000+ cards
- **Typical import time:** 
  - Popular sets: 1-3 minutes
  - All sets: 5-10 minutes

## Troubleshooting

### Connection Error (404 Not Found)

If you get a 404 error from the Pokemon TCG API:

1. Check internet connection
2. Verify API is online: https://api.pokemontcg.io/v2/cards?pageSize=1
3. Try using the command-line script instead
4. Use the JSON upload method as a fallback

### Import Failures

Check the admin dashboard `/dashboard/admin/pokemon-tcg-import` for:
- Error count
- Failed card IDs
- Detailed error messages

### Out of Memory

If importing all sets fails with out-of-memory:

1. Use the `--all` flag with the script and let it paginate
2. Import popular sets first, then add more incrementally
3. Increase Node.js memory: `NODE_OPTIONS=--max_old_space_size=4096 node script`

## Performance Notes

- **Firestore Read:** <10ms per search
- **Firestore Write:** ~1-5ms per card (batched)
- **Search Index:** Automatic (name, type, set)
- **Image URLs:** Store large and small sizes for flexibility

## File Locations

- **Admin Page:** `app/dashboard/admin/pokemon-tcg-import/page.tsx`
- **Firestore Service:** `app/lib/firestore-cards.ts`
- **Data Types:** `app/lib/card-types.ts`
- **Importer Utility:** `app/lib/pokemon-tcg-importer.ts`
- **CLI Script:** `scripts/import-pokemon-tcg.js`

## Next Steps

1. **Choose an import method** above
2. **Import popular sets first** to test the system
3. **Verify data** in Firestore console
4. **Update search functions** to use Firestore instead of API (optional optimization)
5. **Monitor collection size** in Firestore pricing calculator

## API Rate Limits

Pokemon TCG API is generous:
- No authentication required
- No strict rate limits for reasonable usage
- ~1000 cards per minute is safe

The import script automatically adds delays between requests to be respectful.

## Support

For issues or questions:
1. Check Firestore console for import errors
2. Review browser console during web imports
3. Run script with verbose logging
4. Verify Firebase credentials and permissions
