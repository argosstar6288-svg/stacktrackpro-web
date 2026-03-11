#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getFirestore, admin } = require("./lib/firebase-admin");
const {
  normalizePokemonCard,
  normalizeMagicCard,
  normalizeSportsCard,
} = require("./lib/catalog-normalizers");

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  if (args.includes(`--${name}`)) return true;
  return fallback;
}

function printHelp() {
  console.log(`
StackTrack Catalog Importer

Usage:
  node scripts/import-card-catalog.js --source=pokemon
  node scripts/import-card-catalog.js --source=pokemon --set=sv3pt --limit=500
  node scripts/import-card-catalog.js --source=magic --bulkType=all_cards --limit=1000
  node scripts/import-card-catalog.js --source=sports --input=./data/sports.json
  node scripts/import-card-catalog.js --source=pokemon --dry-run

Options:
  --source=SOURCE       pokemon | magic | sports
  --set=SET             Pokemon set ID or Magic set code
  --limit=NUMBER        Max normalized cards to import
  --pageSize=NUMBER     Page size for paginated APIs (default 250)
  --bulkType=TYPE       Scryfall bulk type (default all_cards)
  --input=PATH_OR_URL   Sports JSON source file or URL
  --dry-run             Fetch + normalize only, do not write to Firestore
  --help                Show this help

Firebase Admin credentials required:
  FIREBASE_SERVICE_ACCOUNT
  FIREBASE_SERVICE_ACCOUNT_BASE64
  GOOGLE_APPLICATION_CREDENTIALS
`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function collectPokemonCards({ setId, limit, pageSize }) {
  const cards = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    let url = `https://api.pokemontcg.io/v2/cards?pageSize=${pageSize}&page=${page}`;
    if (setId) {
      url += `&q=${encodeURIComponent(`set.id:${setId}`)}`;
    }

    const headers = {};
    if (process.env.POKEMON_TCG_API_KEY) {
      headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
    }

    const payload = await fetchJson(url, { headers });
    const batch = Array.isArray(payload.data) ? payload.data : [];
    cards.push(...batch);

    if (batch.length < pageSize || (limit && cards.length >= limit)) {
      hasMore = false;
    } else {
      page += 1;
      await sleep(120);
    }
  }

  return limit ? cards.slice(0, limit) : cards;
}

async function collectMagicCards({ setCode, limit, bulkType }) {
  const metadata = await fetchJson("https://api.scryfall.com/bulk-data");
  const items = Array.isArray(metadata.data) ? metadata.data : [];
  const selectedBulk = items.find((item) => item.type === bulkType) || items.find((item) => item.type === "default_cards");

  if (!selectedBulk?.download_uri) {
    throw new Error(`Unable to find Scryfall bulk dataset: ${bulkType}`);
  }

  const payload = await fetchJson(selectedBulk.download_uri);
  const cards = Array.isArray(payload) ? payload : [];

  const filtered = cards.filter((card) => {
    const isPaper = !Array.isArray(card.games) || card.games.includes("paper");
    const matchesSet = setCode ? String(card.set || "").toLowerCase() === String(setCode).toLowerCase() : true;
    return isPaper && matchesSet;
  });

  return limit ? filtered.slice(0, limit) : filtered;
}

async function collectSportsCards({ input, limit }) {
  const source = input || process.env.SPORTS_CARDS_SOURCE_URL;
  if (!source) {
    throw new Error("Sports import requires --input=PATH_OR_URL or SPORTS_CARDS_SOURCE_URL");
  }

  let payload;
  if (/^https?:\/\//i.test(source)) {
    payload = await fetchJson(source);
  } else {
    const absolutePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
    payload = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  }

  const cards = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
  return limit ? cards.slice(0, limit) : cards;
}

function buildWriteOperations(normalizedRecords) {
  const operations = [];
  const seenGames = new Set();
  const seenSets = new Set();
  const seenMarket = new Set();
  const seenVariants = new Set();
  const seenGlobalIndex = new Set();

  for (const record of normalizedRecords) {
    if (!record?.cardDoc?.cardID) continue;

    if (record.gameDoc?.gameID && !seenGames.has(record.gameDoc.gameID)) {
      seenGames.add(record.gameDoc.gameID);
      operations.push({ type: "set", path: ["games", record.gameDoc.gameID], data: record.gameDoc });
    }

    if (record.setDoc?.setID && !seenSets.has(record.setDoc.setID)) {
      seenSets.add(record.setDoc.setID);
      operations.push({ type: "set", path: ["sets", record.setDoc.setID], data: record.setDoc });
    }

    operations.push({
      type: "set",
      path: ["cardCatalog", record.cardDoc.gameID, "cards", record.cardDoc.catalogId || record.cardDoc.cardID],
      data: record.cardDoc,
    });

    if (record.marketDataDoc?.cardID && !seenMarket.has(record.marketDataDoc.cardID)) {
      seenMarket.add(record.marketDataDoc.cardID);
      operations.push({ type: "set", path: ["cardMarketData", record.marketDataDoc.cardID], data: record.marketDataDoc });
    }

    if (record.globalIndexDoc?.cardID && !seenGlobalIndex.has(record.globalIndexDoc.cardID)) {
      seenGlobalIndex.add(record.globalIndexDoc.cardID);
      operations.push({ type: "set", path: ["globalCardIndex", record.globalIndexDoc.cardID], data: record.globalIndexDoc });
    }

    for (const variantDoc of record.variantDocs || []) {
      if (!variantDoc?.variantID || seenVariants.has(variantDoc.variantID)) continue;
      seenVariants.add(variantDoc.variantID);
      operations.push({ type: "set", path: ["variants", variantDoc.variantID], data: variantDoc });
    }
  }

  return operations;
}

async function commitOperations(db, operations, dryRun) {
  const chunkSize = 400;
  let committed = 0;

  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    if (dryRun) {
      committed += chunk.length;
      continue;
    }

    const batch = db.batch();
    chunk.forEach((operation) => {
      const ref = db.doc(operation.path.join("/"));
      batch.set(ref, operation.data, { merge: true });
    });
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${operations.length} Firestore writes`);
  }

  return committed;
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const source = String(getArg("source", "")).toLowerCase();
  const setId = getArg("set", "");
  const limit = Number(getArg("limit", "0")) || undefined;
  const pageSize = Number(getArg("pageSize", process.env.PAGE_SIZE || "250")) || 250;
  const bulkType = String(getArg("bulkType", process.env.SCRYFALL_BULK_TYPE || "all_cards"));
  const input = getArg("input", "");
  const dryRun = Boolean(getArg("dry-run", false));

  if (!source) {
    printHelp();
    throw new Error("Missing required --source option");
  }

  console.log(`\nStackTrack import starting: ${source}`);
  if (setId) console.log(`Set filter: ${setId}`);
  if (limit) console.log(`Limit: ${limit}`);
  if (dryRun) console.log("Dry run: ON");

  let rawCards = [];
  let normalizer = null;

  if (source === "pokemon") {
    rawCards = await collectPokemonCards({ setId, limit, pageSize });
    normalizer = normalizePokemonCard;
  } else if (source === "magic") {
    rawCards = await collectMagicCards({ setCode: setId, limit, bulkType });
    normalizer = normalizeMagicCard;
  } else if (source === "sports") {
    rawCards = await collectSportsCards({ input, limit });
    normalizer = normalizeSportsCard;
  } else {
    throw new Error(`Unsupported source: ${source}`);
  }

  console.log(`Fetched ${rawCards.length} raw records`);

  const normalizedRecords = rawCards.map((card) => normalizer(card)).filter(Boolean);
  const operations = buildWriteOperations(normalizedRecords);

  console.log(`Normalized ${normalizedRecords.length} cards into ${operations.length} Firestore operations`);

  const preview = normalizedRecords[0]?.cardDoc;
  if (preview) {
    console.log("Sample normalized card:");
    console.log(JSON.stringify({
      cardID: preview.cardID,
      name: preview.name,
      number: preview.cardNumber,
      setName: preview.setName,
      game: preview.game,
      rarity: preview.rarity,
      image: preview.image,
      lookup: preview.lookup,
      searchTokens: normalizedRecords[0]?.globalIndexDoc?.searchTokens?.slice(0, 6) || [],
    }, null, 2));
  }

  const db = getFirestore();
  const committed = await commitOperations(db, operations, dryRun);

  console.log(`\nImport complete.`);
  console.log(`Cards normalized: ${normalizedRecords.length}`);
  console.log(`Writes ${dryRun ? "prepared" : "committed"}: ${committed}`);
}

main()
  .then(async () => {
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map((app) => app.delete()));
    }
  })
  .catch(async (error) => {
    console.error("\nImport failed:", error.message || error);
    if (admin.apps.length > 0) {
      await Promise.allSettled(admin.apps.map((app) => app.delete()));
    }
    process.exit(1);
  });
