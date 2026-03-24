#!/usr/bin/env node

const { getFirestore, admin } = require("./lib/firebase-admin");

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  if (args.includes(`--${name}`)) return true;
  return fallback;
}

function printHelp() {
  console.log(`
StackTrack Collection Deduper

Usage:
  node scripts/dedupe-collection.js --dry-run
  node scripts/dedupe-collection.js --apply
  node scripts/dedupe-collection.js --apply --collection=cards
  node scripts/dedupe-collection.js --dry-run --userId=USER_ID

Options:
  --dry-run              Preview duplicates without deleting (default)
  --apply                Delete duplicate docs, keeping the best copy
  --collection=NAME      cards | userCards | both (default both)
  --userId=USER_ID       Limit cleanup to one user
  --limit=NUMBER         Limit documents scanned per collection
  --help                 Show this help

Notes:
  - Duplicate identity is based on cardID, then lookup, then a composite key.
  - The script keeps the richest/newest record and deletes the rest.
  - Firebase Admin credentials are required.
`);
}

function normalizeKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildDedupKey(record) {
  if (record.cardID) return `cardid:${normalizeKeyPart(record.cardID)}`;
  if (record.lookup) return `lookup:${normalizeKeyPart(record.lookup)}`;

  return [
    normalizeKeyPart(record.name),
    normalizeKeyPart(record.cardNumber),
    normalizeKeyPart(record.brand || record.setName),
    normalizeKeyPart(record.year),
    normalizeKeyPart(record.condition),
    normalizeKeyPart(record.variant),
  ].join("|");
}

function getTimestampValue(record) {
  const candidates = [record.updatedAt, record.addedAt, record.added, record.createdAt, record.created];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
    if (typeof candidate._seconds === "number") return candidate._seconds * 1000;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  return 0;
}

function scoreRecord(record) {
  let score = 0;
  if (record.imageUrl || record.photoUrl || record.frontImageUrl || record.thumbnailUrl) score += 4;
  if (record.marketPrice != null || record.estimatedValue != null) score += 2;
  if (record.value != null) score += 2;
  if (record.cardNumber) score += 1;
  if (record.brand || record.setName) score += 1;
  if (record.year) score += 1;
  if (Array.isArray(record.folderIds) && record.folderIds.length > 0) score += 1;
  if (record.folder || record.folderID) score += 1;
  return score;
}

function chooseWinner(existing, candidate) {
  const existingScore = scoreRecord(existing.data);
  const candidateScore = scoreRecord(candidate.data);

  if (candidateScore > existingScore) return candidate;
  if (candidateScore < existingScore) return existing;

  return getTimestampValue(candidate.data) > getTimestampValue(existing.data) ? candidate : existing;
}

async function loadCollectionDocs(db, collectionName, userId, limit) {
  let query = db.collection(collectionName);

  if (userId) {
    const userField = collectionName === "userCards" ? "userID" : "userId";
    query = query.where(userField, "==", userId);
  }

  if (limit) {
    query = query.limit(Number(limit));
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));
}

function findDuplicates(records) {
  const byOwnerAndKey = new Map();

  for (const record of records) {
    const owner = normalizeKeyPart(record.data.userId || record.data.userID);
    const dedupKey = buildDedupKey(record.data);
    const groupKey = `${owner}::${dedupKey}`;

    if (!byOwnerAndKey.has(groupKey)) {
      byOwnerAndKey.set(groupKey, []);
    }

    byOwnerAndKey.get(groupKey).push(record);
  }

  const groups = [];
  for (const [groupKey, items] of byOwnerAndKey.entries()) {
    if (items.length < 2) continue;

    let winner = items[0];
    for (let index = 1; index < items.length; index += 1) {
      winner = chooseWinner(winner, items[index]);
    }

    const losers = items.filter((item) => item.id !== winner.id);
    groups.push({ groupKey, winner, losers, size: items.length });
  }

  return groups;
}

async function deleteDuplicates(groups) {
  let deleted = 0;

  for (const group of groups) {
    for (const loser of group.losers) {
      await loser.ref.delete();
      deleted += 1;
    }
  }

  return deleted;
}

async function main() {
  if (args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const dryRun = !args.includes("--apply");
  const collectionOption = String(getArg("collection", "both"));
  const userId = getArg("userId", "");
  const limit = getArg("limit", "");
  const collections = collectionOption === "both" ? ["cards", "userCards"] : [collectionOption];

  const validCollections = new Set(["cards", "userCards"]);
  for (const collectionName of collections) {
    if (!validCollections.has(collectionName)) {
      throw new Error(`Unsupported collection: ${collectionName}`);
    }
  }

  const db = getFirestore();
  let totalGroups = 0;
  let totalLosers = 0;

  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`Collections: ${collections.join(", ")}`);
  if (userId) console.log(`User: ${userId}`);
  if (limit) console.log(`Limit per collection: ${limit}`);

  for (const collectionName of collections) {
    const records = await loadCollectionDocs(db, collectionName, userId, limit);
    const groups = findDuplicates(records);
    const duplicatesToDelete = groups.reduce((sum, group) => sum + group.losers.length, 0);

    totalGroups += groups.length;
    totalLosers += duplicatesToDelete;

    console.log(`\n[${collectionName}] scanned ${records.length} docs`);
    console.log(`[${collectionName}] duplicate groups: ${groups.length}`);
    console.log(`[${collectionName}] duplicate docs to delete: ${duplicatesToDelete}`);

    groups.slice(0, 20).forEach((group, index) => {
      console.log(
        `  ${index + 1}. keep=${group.winner.id} delete=${group.losers.map((item) => item.id).join(", ")} key=${group.groupKey}`
      );
    });

    if (!dryRun && groups.length > 0) {
      const deleted = await deleteDuplicates(groups);
      console.log(`[${collectionName}] deleted ${deleted} duplicate docs`);
    }
  }

  console.log(`\nSummary: ${totalGroups} duplicate groups, ${totalLosers} duplicate docs ${dryRun ? "would be deleted" : "deleted"}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
