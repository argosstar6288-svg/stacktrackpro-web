#!/usr/bin/env node

const { getFirestore, admin } = require("./lib/firebase-admin");
const { generateSearchTokens } = require("./lib/catalog-normalizers");

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  if (args.includes(`--${name}`)) return true;
  return fallback;
}

function printHelp() {
  console.log(`
StackTrack Global Card Index Builder

Usage:
  node scripts/build-global-card-index.js
  node scripts/build-global-card-index.js --game=pokemon
  node scripts/build-global-card-index.js --game=magic --pageSize=500
  node scripts/build-global-card-index.js --limit=5000
  node scripts/build-global-card-index.js --dry-run

Options:
  --game=GAME         Optional game filter (pokemon|magic|yugioh|sports|marvel)
  --pageSize=NUMBER   Batch read/write size (default 400)
  --limit=NUMBER      Maximum cards to process
  --dry-run           Process + print stats only
  --help              Show this help
`);
}

function toIndexDoc(cardData, fallbackId) {
  const name = cardData.name || "Unknown Card";
  const setName = cardData.setName || cardData.set?.name || cardData.set || "Unknown Set";
  const number = String(cardData.cardNumber || cardData.number || "");
  const game = cardData.gameID || cardData.game || "other";
  const lookup = cardData.lookup || [name, number, setName]
    .map((part) => String(part || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""))
    .filter(Boolean)
    .join("_") || "unknown_card";

  return {
    cardID: cardData.cardID || cardData.stacktrackId || fallbackId,
    name,
    set: setName,
    number,
    game,
    rarity: cardData.rarity || null,
    image: cardData.image || cardData.images?.large || cardData.images?.small || cardData.imageUrl || null,
    lookup,
    searchTokens: generateSearchTokens({
      name,
      setName,
      number,
      game,
    }),
    updatedAt: new Date().toISOString(),
  };
}

async function processGame(db, game, options) {
  const pageSize = options.pageSize;
  const limit = options.limit;
  const dryRun = options.dryRun;

  let processed = 0;
  let written = 0;
  let lastDoc = null;

  while (true) {
    let queryRef = db.collection("cardCatalog").doc(game).collection("cards").orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) {
      queryRef = queryRef.startAfter(lastDoc.id);
    }

    const snapshot = await queryRef.get();
    if (snapshot.empty) break;

    const docs = snapshot.docs;
    const batch = db.batch();

    for (const docSnap of docs) {
      if (limit && processed >= limit) {
        break;
      }

      const data = docSnap.data();
      const indexDoc = toIndexDoc(data, docSnap.id);
      if (!indexDoc.cardID) continue;

      const indexRef = db.collection("globalCardIndex").doc(indexDoc.cardID);
      if (!dryRun) {
        batch.set(indexRef, indexDoc, { merge: true });
      }

      processed += 1;
      written += 1;
    }

    if (!dryRun) {
      await batch.commit();
    }

    lastDoc = docs[docs.length - 1];

    console.log(`[Index Builder] ${game}: processed ${processed} cards`);

    if (limit && processed >= limit) {
      break;
    }

    if (docs.length < pageSize) {
      break;
    }
  }

  return { processed, written };
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const game = String(getArg("game", "")).toLowerCase();
  const pageSize = Number(getArg("pageSize", process.env.INDEX_PAGE_SIZE || "400")) || 400;
  const limitArg = Number(getArg("limit", "0"));
  const limit = limitArg > 0 ? limitArg : undefined;
  const dryRun = Boolean(getArg("dry-run", false));

  const games = game ? [game] : ["pokemon", "magic", "yugioh", "sports", "marvel"];

  const db = getFirestore();

  console.log(`\n[Index Builder] Starting globalCardIndex rebuild`);
  console.log(`[Index Builder] Games: ${games.join(", ")}`);
  console.log(`[Index Builder] Page size: ${pageSize}`);
  if (limit) console.log(`[Index Builder] Limit per game: ${limit}`);
  if (dryRun) console.log(`[Index Builder] Dry run enabled`);

  let totalProcessed = 0;
  let totalWritten = 0;

  for (const gameId of games) {
    const result = await processGame(db, gameId, { pageSize, limit, dryRun });
    totalProcessed += result.processed;
    totalWritten += result.written;
  }

  console.log(`\n[Index Builder] Complete`);
  console.log(`[Index Builder] Processed: ${totalProcessed}`);
  console.log(`[Index Builder] ${dryRun ? "Prepared" : "Written"}: ${totalWritten}`);
}

main()
  .then(async () => {
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map((app) => app.delete()));
    }
  })
  .catch(async (error) => {
    console.error("\n[Index Builder] Failed:", error.message || error);
    if (admin.apps.length > 0) {
      await Promise.allSettled(admin.apps.map((app) => app.delete()));
    }
    process.exit(1);
  });
