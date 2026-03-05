#!/usr/bin/env node

/**
 * Standalone Pokemon TCG Card Importer Script
 * 
 * This script fetches Pokemon TCG cards from the official API and imports them into Firestore.
 * 
 * Usage:
 *   node scripts/import-pokemon-tcg.js                    # Import popular sets
 *   node scripts/import-pokemon-tcg.js --all               # Import all sets
 *   node scripts/import-pokemon-tcg.js --sets sv04pt,sv4pt # Import specific sets
 *   node scripts/import-pokemon-tcg.js --help              # Show help
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Command-line argument parsing
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');
const allFlag = args.includes('--all');
const setsArg = args.find(arg => arg.startsWith('--sets='));
const clearFlag = args.includes('--clear');

if (helpFlag) {
  console.log(`
🎮 Pokemon TCG Card Importer

Usage:
  node scripts/import-pokemon-tcg.js                    # Import popular sets (default)
  node scripts/import-pokemon-tcg.js --all               # Import all available sets
  node scripts/import-pokemon-tcg.js --sets sv04pt,sv4pt # Import specific sets (comma-separated)
  node scripts/import-pokemon-tcg.js --clear             # Clear all cards from Firestore first
  node scripts/import-pokemon-tcg.js --help              # Show this help message

Sets (examples):
  sv04pt - Scarlet & Violet - Paldean Fates
  sv4pt  - Scarlet & Violet - Obsidian Flames
  sv04   - Scarlet & Violet - Paradox Rift
  sv3pt  - Scarlet & Violet - 151
  sv3    - Scarlet & Violet - Temporal Forces

Environment Variables:
  POKEMON_TCG_API_URL - Override API URL (default: https://api.pokemontcg.io/v2/cards)
  PAGE_SIZE          - Cards per API request (default: 250)
  MAX_CARDS          - Maximum cards to import (default: unlimited)
  `);
  process.exit(0);
}

const POKEMON_TCG_API = process.env.POKEMON_TCG_API_URL || 'https://api.pokemontcg.io/v2/cards';
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '250', 10);
const MAX_CARDS = process.env.MAX_CARDS ? parseInt(process.env.MAX_CARDS, 10) : undefined;

const POPULAR_SETS = [
  'sv04pt', // Scarlet & Violet - Paldean Fates
  'sv4pt', // Scarlet & Violet - Obsidian Flames
  'sv04', // Scarlet & Violet - Paradox Rift
  'sv3pt', // Scarlet & Violet - 151
  'sv3', // Scarlet & Violet - Temporal Forces
];

let setIds = POPULAR_SETS;
if (allFlag) {
  setIds = [];
  console.log('📦 Will fetch all available sets');
} else if (setsArg) {
  setIds = setsArg.replace('--sets=', '').split(',').map(s => s.trim());
  console.log(`📦 Importing specific sets: ${setIds.join(', ')}`);
}

/**
 * Fetch cards from Pokemon TCG API
 */
async function fetchCards(setIds, pageSize = PAGE_SIZE, maxCards = MAX_CARDS) {
  const cards = [];
  let page = 1;
  let totalCount = 0;
  let hasMore = true;

  console.log('\n🔄 Fetching Pokemon TCG cards from official API...');
  console.log(`   📍 API: ${POKEMON_TCG_API}`);
  console.log(`   📦 Page size: ${pageSize}`);

  if (setIds && setIds.length > 0) {
    console.log(`   🎯 Sets: ${setIds.join(', ')}`);
  } else {
    console.log(`   🎯 Sets: ALL`);
  }

  if (maxCards) {
    console.log(`   📊 Max cards: ${maxCards}`);
  }

  return new Promise((resolve, reject) => {
    async function fetchPage() {
      try {
        let url = `${POKEMON_TCG_API}?pageSize=${pageSize}&page=${page}`;

        // Add set filter if specified
        if (setIds && setIds.length > 0) {
          const setQueries = setIds.map(id => `set.id:${id}`).join(' OR ');
          url = `${POKEMON_TCG_API}?q=${encodeURIComponent(setQueries)}&pageSize=${pageSize}&page=${page}`;
        }

        console.log(`\n📥 Fetching page ${page}...`);

        https.get(url, (res) => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const json = JSON.parse(data);

              if (!json.data || !Array.isArray(json.data)) {
                console.warn('⚠️ No data in response');
                hasMore = false;
                return;
              }

              cards.push(...json.data);
              totalCount = json.totalCount;

              console.log(
                `   ✅ Fetched ${json.data.length} cards (Total: ${cards.length}/${totalCount})`
              );

              // Check if we should continue
              if (json.data.length < pageSize) {
                hasMore = false;
              } else if (maxCards && cards.length >= maxCards) {
                cards.splice(maxCards);
                hasMore = false;
              } else {
                page++;
                // Be respectful with API - small delay between requests
                setTimeout(fetchPage, 100);
                return;
              }

              console.log(`\n✅ Fetch complete! Total cards: ${cards.length}`);
              resolve(cards);
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      } catch (error) {
        reject(error);
      }
    }

    fetchPage();
  });
}

/**
 * Generate import report
 */
function generateReport(cards) {
  const sets = new Map();
  const types = new Map();
  const supertypes = new Map();
  let cardsWithImages = 0;
  let cardsWithoutImages = 0;

  cards.forEach(card => {
    // Count by set
    const setName = card.set?.name || 'Unknown';
    sets.set(setName, (sets.get(setName) || 0) + 1);

    // Count by type
    card.types?.forEach(type => {
      types.set(type, (types.get(type) || 0) + 1);
    });

    // Count by supertype
    supertypes.set(card.supertype, (supertypes.get(card.supertype) || 0) + 1);

    // Count images
    if (card.images?.large || card.images?.small) {
      cardsWithImages++;
    } else {
      cardsWithoutImages++;
    }
  });

  let report = `
📊 Pokemon TCG Card Import Report
==================================

Total Cards: ${cards.length}
  ✅ With Images: ${cardsWithImages}
  ❌ Missing Images: ${cardsWithoutImages}

Top Sets:
${Array.from(sets)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([set, count]) => `  • ${set}: ${count} cards`)
  .join('\n')}

Card Types:
${Array.from(types)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `  • ${type}: ${count} cards`)
  .join('\n')}

Supertypes:
${Array.from(supertypes)
  .sort((a, b) => b[1] - a[1])
  .map(([supertype, count]) => `  • ${supertype}: ${count} cards`)
  .join('\n')}
`;

  return report;
}

/**
 * Main execution
 */
async function main() {
  try {
    const cards = await fetchCards(setIds, PAGE_SIZE, MAX_CARDS);
    console.log(generateReport(cards));

    // Save to JSON file
    const outputFile = path.join(__dirname, `pokemon-tcg-cards-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(cards, null, 2));
    console.log(`\n💾 Saved ${cards.length} cards to: ${outputFile}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Upload this JSON file to Firestore via the admin dashboard`);
    console.log(`   2. Visit: /dashboard/admin/pokemon-tcg-import`);
    console.log(`   3. Click "Import from JSON File" and select the generated file`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
