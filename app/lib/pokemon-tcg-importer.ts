/**
 * Utility script to fetch Pokemon TCG card data and populate Firestore
 * 
 * Usage:
 * 1. Create a Node.js script that imports this module
 * 2. Call fetchAndImportPokemonTCGCards() with optional parameters
 * 3. Run: node scripts/import-pokemon-tcg.js
 */

import fetch from 'node-fetch';
import { PokemonCardData, PokemonTCGApiResponse } from './card-types';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2/cards';

// Optional: Filter for specific sets
const POPULAR_SETS = [
  'sv04pt', // Scarlet & Violet - Paldean Fates
  'sv4pt', // Scarlet & Violet - Obsidian Flames
  'sv04', // Scarlet & Violet - Paradox Rift
  'sv3pt', // Scarlet & Violet - 151
  'sv3', // Scarlet & Violet - Temporal Forces
  'sv2pt', // Scarlet & Violet - Pokémon 151
  'sv2', // Scarlet & Violet - Paldea Evolved
  'sv1pt', // Scarlet & Violet - Paldean Fates Promos
  'sv1', // Scarlet & Violet
];

interface FetchOptions {
  setIds?: string[]; // If provided, only fetch these sets
  limit?: number; // Max cards to fetch (undefined = all)
  pageSize?: number; // Cards per API request (default: 250)
}

/**
 * Fetch all Pokemon TCG cards from the official API
 */
export async function fetchPokeemonTCGCards(
  options: FetchOptions = {}
): Promise<PokemonCardData[]> {
  const {
    setIds = POPULAR_SETS,
    limit = undefined,
    pageSize = 250,
  } = options;

  const cards: PokemonCardData[] = [];
  let page = 1;
  let totalCount = 0;
  let hasMore = true;

  console.log('🔄 Fetching Pokemon TCG cards from official API...');
  console.log(`   📍 API: ${POKEMON_TCG_API}`);
  console.log(`   📦 Page size: ${pageSize}`);
  if (setIds && setIds.length > 0) {
    console.log(`   🎯 Sets: ${setIds.join(', ')}`);
  }

  try {
    while (hasMore && (!limit || cards.length < limit)) {
      try {
        let url = `${POKEMON_TCG_API}?pageSize=${pageSize}&page=${page}`;

        // Add set filter if specified
        if (setIds && setIds.length > 0) {
          const setQuery = setIds.map(id => `q=set.id:${id}`).join('&');
          url = `${POKEMON_TCG_API}?${setQuery}&pageSize=${pageSize}&page=${page}`;
        }

        console.log(`\n📥 Fetching page ${page}...`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PokemonCardCollector/1.0',
            Accept: 'application/json',
          },
          timeout: 30000,
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as PokemonTCGApiResponse;

        if (!data.data || !Array.isArray(data.data)) {
          console.warn('⚠️ No data in response');
          break;
        }

        cards.push(...data.data);
        totalCount = data.totalCount;

        console.log(
          `   ✅ Fetched ${data.data.length} cards (Total: ${cards.length}/${totalCount})`
        );

        // Check if we should continue
        if (data.data.length < pageSize) {
          hasMore = false;
        } else if (limit && cards.length >= limit) {
          cards.splice(limit);
          hasMore = false;
        } else {
          page++;
          // Be respectful with API - small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (pageError) {
        console.error(`❌ Error fetching page ${page}:`, pageError);
        hasMore = false;
      }
    }

    console.log(`\n✅ Fetch complete! Total cards: ${cards.length}`);
    return cards;
  } catch (error) {
    console.error('Fatal error during fetch:', error);
    throw error;
  }
}

/**
 * Generate a summary report of fetched data
 */
export function generateImportReport(cards: PokemonCardData[]): string {
  const sets = new Map<string, number>();
  const types = new Map<string, number>();
  const supertypes = new Map<string, number>();
  let cardsWithImages = 0;
  let cardsWithoutImages = 0;

  cards.forEach(card => {
    // Count by set
    const setName = card.set.name;
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
  .map(([supertype, count]) => `  • ${supertype}: ${count} cards`)
  .join('\n')}
`;

  return report;
}

/**
 * Standalone execution example
 * 
 * This would be called from a command-line script:
 * 
 * ```typescript
 * import { fetchPokeemonTCGCards, generateImportReport } from './pokemon-tcg-importer';
 * import { batchUploadCards } from './firestore-cards';
 * 
 * async function main() {
 *   // Fetch all Pokemon TCG cards (popular sets)
 *   const cards = await fetchPokeemonTCGCards({
 *     pageSize: 250,
 *     // Leave setIds undefined to fetch ALL sets, or specify specific ones:
 *     // setIds: ['sv04pt', 'sv4pt', 'sv04'],
 *   });
 *   
 *   // Print report
 *   console.log(generateImportReport(cards));
 *   
 *   // Upload to Firestore
 *   const stats = await batchUploadCards(cards);
 *   console.log('Import stats:', stats);
 * }
 * 
 * main().catch(console.error);
 * ```
 */

export default {
  fetchPokeemonTCGCards,
  generateImportReport,
};
