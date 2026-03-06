import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, where, limit as firestoreLimit } from "firebase/firestore";

interface PriceUpdateStats {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Scheduled price update endpoint
 * Called by Vercel Cron or manually
 * 
 * Vercel cron configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/catalog/update-prices",
 *     "schedule": "0 2 * * *"  // Daily at 2 AM
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Price Update] Starting scheduled price update");

    const stats: PriceUpdateStats = {
      total: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Update prices for each game
    await updatePokemonPrices(stats);
    await updateMagicPrices(stats);
    await updateYuGiOhPrices(stats);
    // Sports cards use PriceCharting lookup on-demand

    console.log(`[Price Update] Complete: ${stats.updated} updated, ${stats.failed} failed`);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Price Update] Error:", error);
    return NextResponse.json(
      {
        error: "Price update failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Update Pokemon TCG prices
 */
async function updatePokemonPrices(stats: PriceUpdateStats) {
  try {
    const cardsRef = collection(db, "cardCatalog", "pokemon", "cards");
    
    // Get cards that need price updates (older than 24 hours or no price)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    // In production, you'd batch this and process in chunks
    const snapshot = await getDocs(query(cardsRef, firestoreLimit(100)));
    
    for (const cardDoc of snapshot.docs) {
      const card = cardDoc.data();
      try {
        // Get TCGplayer price if available
        if (card.tcgplayer?.url) {
          // Note: TCGplayer requires API authentication
          // For now, we'll use the embedded price data from the card
          if (card.tcgplayer.prices) {
            const prices = card.tcgplayer.prices;
            const marketPrice = 
              prices.holofoil?.market ||
              prices.normal?.market ||
              prices.reverseHolofoil?.market ||
              null;

            if (marketPrice) {
              const cardRef = doc(db, "cardCatalog", "pokemon", "cards", cardDoc.id);
              await updateDoc(cardRef, {
                "pricing.market": marketPrice,
                "pricing.lastUpdated": new Date().toISOString(),
              });
              stats.updated++;
            } else {
              stats.skipped++;
            }
          } else {
            stats.skipped++;
          }
        } else {
          stats.skipped++;
        }
        
        stats.total++;
        
        // Rate limit: 10 requests per second
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Failed to update ${card.name || cardDoc.id}: ${err}`);
      }
    }
    
  } catch (error) {
    stats.errors.push(`Pokemon price update error: ${error}`);
  }
}

/**
 * Update Magic: The Gathering prices
 */
async function updateMagicPrices(stats: PriceUpdateStats) {
  try {
    const cardsRef = collection(db, "cardCatalog", "magic", "cards");
    const snapshot = await getDocs(query(cardsRef, firestoreLimit(100)));
    
    for (const cardDoc of snapshot.docs) {
      const card = cardDoc.data();
      try {
        // Scryfall includes pricing in the card data
        if (card.prices) {
          const marketPrice = 
            parseFloat(card.prices.usd) ||
            parseFloat(card.prices.usd_foil) ||
            null;

          if (marketPrice) {
            const cardRef = doc(db, "cardCatalog", "magic", "cards", cardDoc.id);
            await updateDoc(cardRef, {
              "pricing.market": marketPrice,
              "pricing.lastUpdated": new Date().toISOString(),
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }
        } else {
          stats.skipped++;
        }
        
        stats.total++;
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Failed to update ${card.name || cardDoc.id}: ${err}`);
      }
    }
    
  } catch (error) {
    stats.errors.push(`Magic price update error: ${error}`);
  }
}

/**
 * Update Yu-Gi-Oh prices
 */
async function updateYuGiOhPrices(stats: PriceUpdateStats) {
  try {
    const cardsRef = collection(db, "cardCatalog", "yugioh", "cards");
    const snapshot = await getDocs(query(cardsRef, firestoreLimit(100)));
    
    for (const cardDoc of snapshot.docs) {
      const card = cardDoc.data();
      try {
        // YGOPRODeck includes pricing
        if (card.prices) {
          const marketPrice = 
            parseFloat(card.prices.tcgplayer_price) ||
            parseFloat(card.prices.cardmarket_price) ||
            null;

          if (marketPrice) {
            const cardRef = doc(db, "cardCatalog", "yugioh", "cards", cardDoc.id);
            await updateDoc(cardRef, {
              "pricing.market": marketPrice,
              "pricing.lastUpdated": new Date().toISOString(),
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }
        } else {
          stats.skipped++;
        }
        
        stats.total++;
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Failed to update ${card.name || cardDoc.id}: ${err}`);
      }
    }
    
  } catch (error) {
    stats.errors.push(`Yu-Gi-Oh price update error: ${error}`);
  }
}

/**
 * Manual trigger endpoint (POST)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
