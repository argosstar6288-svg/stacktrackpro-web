#!/usr/bin/env node
/**
 * Bulk PriceCharting price update
 * Updates marketPrice + value on every card in Firestore using the PriceCharting API.
 *
 * Usage:
 *   node scripts/bulk-price-update.js            # update all stale cards (>24 h)
 *   node scripts/bulk-price-update.js --all       # force-update every card
 *   node scripts/bulk-price-update.js --dry-run   # preview only, no writes
 *   node scripts/bulk-price-update.js --user=UID  # limit to one user
 */

// Load env files — prefer .env.vercel.live (has Firebase Admin creds) then .env.local
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

const root = path.resolve(__dirname, "..");
loadEnvFile(path.join(root, ".env.vercel.live"));
loadEnvFile(path.join(root, ".env.local"));

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE_ALL = args.includes("--all");
const userArg = args.find((a) => a.startsWith("--user="));
const TARGET_USER = userArg ? userArg.split("=")[1] : null;
const STALE_MS = 24 * 60 * 60 * 1000;

// ─── Validate credentials ──────────────────────────────────────────────────
const PRICECHARTING_API_KEY = process.env.PRICECHARTING_API_KEY;
if (!PRICECHARTING_API_KEY) {
  console.error("\n❌  PRICECHARTING_API_KEY is not set in any env file.");
  console.error(
    "    Add it to .env.local:\n      PRICECHARTING_API_KEY=your_key_here\n"
  );
  process.exit(1);
}

// ─── Firebase ──────────────────────────────────────────────────────────────
const { getFirestore, admin } = require("./lib/firebase-admin");
const db = getFirestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Helpers ───────────────────────────────────────────────────────────────
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchPriceCharting(card) {
  const name = String(card.name || "").trim();
  if (!name) return null;

  let q = name;
  if (card.player && card.player !== "Unknown Player") q = `${card.player} ${q}`;
  if (card.year) q = `${card.year} ${q}`;
  if (card.brand && card.brand !== "Unknown") q = `${card.brand} ${q}`;

  const consoleName = card.sport ? `${card.sport} Cards` : "Baseball Cards";
  const url = new URL("https://www.pricecharting.com/api/product");
  url.searchParams.set("t", PRICECHARTING_API_KEY);
  url.searchParams.set("q", q);
  url.searchParams.set("console", consoleName);

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "StackTrackPro/1.0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status === "error") return null;

    const loose = data["loose-price"] ? data["loose-price"] / 100 : null;
    const complete = data["cib-price"] ? data["cib-price"] / 100 : null;
    const mint = data["new-price"] ? data["new-price"] / 100 : null;

    const cond = String(card.condition || "").toLowerCase();
    let price = loose;
    if (cond === "mint" && mint != null) price = mint;
    else if (complete != null) price = complete;

    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

function isStale(card) {
  if (FORCE_ALL) return true;
  const last = card.priceLastUpdated ? Date.parse(card.priceLastUpdated) : 0;
  return !last || Number.isNaN(last) || Date.now() - last > STALE_MS;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔄  StackTrack Bulk PriceCharting Update");
  console.log(`    Mode : ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`    Scope: ${TARGET_USER ? `user ${TARGET_USER}` : "all users"}`);
  console.log(`    Stale: ${FORCE_ALL ? "all cards" : "cards older than 24 h"}\n`);

  // Fetch cards
  let cardsQuery = db.collection("cards");
  if (TARGET_USER) cardsQuery = cardsQuery.where("userId", "==", TARGET_USER);
  const cardsSnap = await cardsQuery.get();
  const allCards = cardsSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));

  const toProcess = allCards.filter(isStale);
  const skipped = allCards.length - toProcess.length;

  console.log(`📦  Total cards found : ${allCards.length}`);
  console.log(`⏩  Already fresh     : ${skipped} (skipped)`);
  console.log(`🎯  Cards to update   : ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log("✅  Nothing to do.\n");
    return;
  }

  if (DRY_RUN) {
    console.log("📋  Dry-run sample (first 10):");
    toProcess.slice(0, 10).forEach((c) =>
      console.log(`    • [${c._id}] ${c.name || "?"} — last updated: ${c.priceLastUpdated || "never"}`)
    );
    console.log("\n    Re-run without --dry-run to apply changes.\n");
    return;
  }

  // Build userCards lookup for syncing
  let userCardsQuery = db.collection("userCards");
  if (TARGET_USER) userCardsQuery = userCardsQuery.where("userID", "==", TARGET_USER);
  const userCardsSnap = await userCardsQuery.get();

  const ucByLegacy = new Map(); // legacyCardDocID → [ucDocId, ...]
  const ucByCardId = new Map(); // cardID → [ucDocId, ...]
  for (const snap of userCardsSnap.docs) {
    const d = snap.data();
    const legId = String(d?.legacyCardDocID || "").trim();
    const cardId = String(d?.cardID || "").trim();
    if (legId) { const l = ucByLegacy.get(legId) || []; l.push(snap.id); ucByLegacy.set(legId, l); }
    if (cardId) { const l = ucByCardId.get(cardId) || []; l.push(snap.id); ucByCardId.set(cardId, l); }
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const card = toProcess[i];
    const idx = String(i + 1).padStart(String(toProcess.length).length);
    process.stdout.write(`\r  [${idx}/${toProcess.length}] ${(card.name || "?").slice(0, 40).padEnd(40)}  updated=${updated} failed=${failed}`);

    const price = await fetchPriceCharting(card);

    if (price == null) {
      failed++;
      await wait(200);
      continue;
    }

    const now = new Date().toISOString();
    await db.collection("cards").doc(card._id).update({
      marketPrice: price,
      value: price,
      priceLastUpdated: now,
      priceSource: "pricecharting",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Sync linked userCards
    const ucIds = new Set([
      ...(ucByLegacy.get(card._id) || []),
      ...(ucByCardId.get(String(card.cardID || "").trim()) || []),
    ]);
    if (ucIds.size > 0) {
      await Promise.all([...ucIds].map((ucId) =>
        db.collection("userCards").doc(ucId).update({
          value: price,
          marketPrice: price,
          priceLastUpdated: now,
          updatedAt: FieldValue.serverTimestamp(),
        })
      ));
    }

    updated++;
    await wait(300); // stay within PriceCharting rate limits
  }

  process.stdout.write("\n");
  console.log(`\n✅  Done.`);
  console.log(`    Updated : ${updated}`);
  console.log(`    Failed  : ${failed} (card not found on PriceCharting or API error)`);
  console.log(`    Skipped : ${skipped} (already fresh)\n`);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message || err);
  process.exit(1);
});
