import { NextRequest, NextResponse } from "next/server";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { adminDb, adminServerTimestamp } from "@/lib/firebase-admin";
import { buildPriceIntelligence } from "@/lib/priceIntelligence";
import { isAdminEmail } from "@/lib/adminAccess";

const PRICECHARTING_API_KEY = process.env.PRICECHARTING_API_KEY || "";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function verifyAdminToken(authHeader: string): Promise<string | null> {
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded?.uid && isAdminEmail(decoded.email)) return decoded.uid;
    return null;
  } catch {
    return null;
  }
}

async function fetchPriceChartingForCard(card: any): Promise<{
  found: boolean;
  price?: number;
  source?: string;
  error?: string;
}> {
  if (!PRICECHARTING_API_KEY) {
    return { found: false, error: "PRICECHARTING_API_KEY not configured" };
  }

  const name = String(card?.name || "").trim();
  if (!name) return { found: false, error: "Card missing name" };

  let searchQuery = name;
  if (card?.player && card.player !== "Unknown Player") {
    searchQuery = `${card.player} ${searchQuery}`;
  }
  if (card?.year) searchQuery = `${card.year} ${searchQuery}`;
  if (card?.brand && card.brand !== "Unknown") {
    searchQuery = `${card.brand} ${searchQuery}`;
  }

  const consoleName = card?.sport ? `${card.sport} Cards` : "Baseball Cards";
  const url = new URL("https://www.pricecharting.com/api/product");
  url.searchParams.append("t", PRICECHARTING_API_KEY);
  url.searchParams.append("q", searchQuery);
  url.searchParams.append("console", consoleName);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "User-Agent": "StackTrackPro/1.0" },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return { found: false, error: `PriceCharting HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data?.status === "error") {
      return { found: false, error: data?.["error-message"] || "Not found" };
    }

    const loose = data?.["loose-price"] ? data["loose-price"] / 100 : null;
    const complete = data?.["cib-price"] ? data["cib-price"] / 100 : null;
    const mint = data?.["new-price"] ? data["new-price"] / 100 : null;

    const cardCondition = String(card?.condition || "").toLowerCase();
    let price = loose;
    if (cardCondition === "mint" && mint != null) {
      price = mint;
    } else if (complete != null) {
      price = complete;
    }

    if (price == null) {
      return { found: false, error: "No usable price in response" };
    }

    return { found: true, price, source: "pricecharting" };
  } catch (err) {
    return {
      found: false,
      error: err instanceof Error ? err.message : "Fetch error",
    };
  }
}

function toLegacyRarity(rarityTier: "Ultra Rare" | "Rare" | "Common") {
  if (rarityTier === "Ultra Rare") return "Legendary";
  if (rarityTier === "Rare") return "Rare";
  return "Common";
}

/**
 * Update all cards for a single user with PriceCharting values.
 * Returns counts of updated / failed / skipped cards.
 */
async function updateUserCards(
  userId: string,
  options: { staleOnly?: boolean; batchId?: string } = {}
): Promise<{ updated: number; failed: number; skipped: number }> {
  const cardsSnapshot = await adminDb
    .collection("cards")
    .where("userId", "==", userId)
    .get();

  const cards = cardsSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() as any }));

  const now = Date.now();
  const staleCutoffMs = 24 * 60 * 60 * 1000; // 24 hours

  // Build userCards lookup for syncing
  const userCardsSnapshot = await adminDb
    .collection("userCards")
    .where("userID", "==", userId)
    .get();

  const userCardsByLegacyId = new Map<string, string[]>();
  const userCardsByCardId = new Map<string, string[]>();
  for (const snap of userCardsSnapshot.docs) {
    const data = snap.data() as any;
    const legacyId = String(data?.legacyCardDocID || "").trim();
    const cardId = String(data?.cardID || "").trim();
    if (legacyId) {
      const list = userCardsByLegacyId.get(legacyId) || [];
      list.push(snap.id);
      userCardsByLegacyId.set(legacyId, list);
    }
    if (cardId) {
      const list = userCardsByCardId.get(cardId) || [];
      list.push(snap.id);
      userCardsByCardId.set(cardId, list);
    }
  }

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const card of cards) {
    // Skip if recently updated and staleOnly mode is on
    if (options.staleOnly) {
      const lastUpdated = card?.priceLastUpdated ? Date.parse(card.priceLastUpdated) : 0;
      if (!Number.isNaN(lastUpdated) && lastUpdated > 0 && now - lastUpdated < staleCutoffMs) {
        skipped += 1;
        continue;
      }
    }

    const lookup = await fetchPriceChartingForCard(card);

    if (!lookup.found || typeof lookup.price !== "number") {
      failed += 1;
      await wait(200);
      continue;
    }

    const currentPrice = lookup.price;
    const intelligence = buildPriceIntelligence({
      currentPrice,
      populationCount: Number(card.populationCount || card.population || 0) || undefined,
      supplyCount: Number(card.supplyCount || card.supply || 0) || undefined,
      rarityHint: card.rarity,
    });

    await adminDb.collection("cards").doc(card.id).update({
      marketPrice: currentPrice,
      value: currentPrice,
      priceLastUpdated: new Date().toISOString(),
      predicted30DayValue: intelligence.predicted30DayValue,
      rarityTier: intelligence.rarityTier,
      rarity: card.rarity || toLegacyRarity(intelligence.rarityTier),
      priceSource: "pricecharting",
      updatedAt: adminServerTimestamp(),
      ...(options.batchId ? { lastBulkUpdateBatchId: options.batchId } : {}),
    });

    // Sync to userCards
    const relatedUserCardDocIds = new Set<string>([
      ...(userCardsByLegacyId.get(card.id) || []),
      ...(userCardsByCardId.get(String(card.cardID || "").trim()) || []),
    ]);

    if (relatedUserCardDocIds.size > 0) {
      await Promise.all(
        Array.from(relatedUserCardDocIds).map((ucId) =>
          adminDb.collection("userCards").doc(ucId).update({
            value: currentPrice,
            marketPrice: currentPrice,
            priceLastUpdated: new Date().toISOString(),
            updatedAt: adminServerTimestamp(),
          })
        )
      );
    }

    updated += 1;
    await wait(300); // respect PriceCharting rate limits
  }

  return { updated, failed, skipped };
}

// ─── GET: stats ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminToken(
    request.headers.get("authorization") || ""
  );
  if (!adminUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cardsSnapshot = await adminDb.collection("cards").get();
    const cards = cardsSnapshot.docs.map((snap) => snap.data() as any);

    const now = Date.now();
    const staleCutoffMs = 24 * 60 * 60 * 1000;

    const totalCards = cards.length;
    const staleCards = cards.filter((card) => {
      const lastUpdated = card?.priceLastUpdated ? Date.parse(card.priceLastUpdated) : 0;
      return !lastUpdated || Number.isNaN(lastUpdated) || now - lastUpdated > staleCutoffMs;
    }).length;

    const uniqueUserIds = new Set(cards.map((c) => String(c.userId || "")).filter(Boolean));

    // Fetch recent bulk update records
    const bulkLogsSnapshot = await adminDb
      .collection("adminBulkPriceUpdates")
      .orderBy("startedAt", "desc")
      .limit(5)
      .get();

    const recentRuns = bulkLogsSnapshot.docs.map((snap) => {
      const data = snap.data() as any;
      const startMs =
        data?.startedAt?.toMillis?.() ||
        (data?.startedAt?.seconds ? data.startedAt.seconds * 1000 : 0);
      const endMs =
        data?.completedAt?.toMillis?.() ||
        (data?.completedAt?.seconds ? data.completedAt.seconds * 1000 : 0);
      return {
        id: snap.id,
        status: data.status,
        totalUsers: data.totalUsers || 0,
        processedUsers: data.processedUsers || 0,
        totalUpdated: data.totalUpdated || 0,
        totalFailed: data.totalFailed || 0,
        totalSkipped: data.totalSkipped || 0,
        startedAt: startMs ? new Date(startMs).toISOString() : null,
        completedAt: endMs ? new Date(endMs).toISOString() : null,
        triggeredBy: data.triggeredBy || "unknown",
        staleOnly: Boolean(data.staleOnly),
        batchId: data.batchId || snap.id,
      };
    });

    return NextResponse.json({
      success: true,
      totalCards,
      staleCards,
      freshCards: totalCards - staleCards,
      totalUsers: uniqueUserIds.size,
      pricechartingConfigured: Boolean(PRICECHARTING_API_KEY),
      recentRuns,
    });
  } catch (err) {
    console.error("[BulkPriceUpdate] GET error:", err);
    return NextResponse.json(
      { error: "Failed to load stats", details: String(err) },
      { status: 500 }
    );
  }
}

// ─── POST: trigger bulk update ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminToken(
    request.headers.get("authorization") || ""
  );
  if (!adminUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const staleOnly = body?.staleOnly !== false; // default true — skip fresh cards
  const targetUserId = typeof body?.userId === "string" ? body.userId.trim() : null;

  const batchId = `bulk-${Date.now()}`;

  // Record the run as started
  const logRef = adminDb.collection("adminBulkPriceUpdates").doc(batchId);
  await logRef.set({
    batchId,
    status: "processing",
    staleOnly,
    targetUserId: targetUserId || null,
    startedAt: adminServerTimestamp(),
    triggeredBy: adminUid,
    totalUsers: 0,
    processedUsers: 0,
    totalUpdated: 0,
    totalFailed: 0,
    totalSkipped: 0,
  });

  try {
    // Collect distinct userIds from the cards collection
    let userIds: string[];
    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      const cardsSnapshot = await adminDb.collection("cards").get();
      const idSet = new Set<string>();
      cardsSnapshot.docs.forEach((snap) => {
        const uid = String((snap.data() as any)?.userId || "").trim();
        if (uid) idSet.add(uid);
      });
      userIds = Array.from(idSet);
    }

    await logRef.update({ totalUsers: userIds.length });

    let processedUsers = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const userId of userIds) {
      try {
        const result = await updateUserCards(userId, { staleOnly, batchId });
        totalUpdated += result.updated;
        totalFailed += result.failed;
        totalSkipped += result.skipped;
      } catch (err) {
        console.error(`[BulkPriceUpdate] Failed for user ${userId}:`, err);
        totalFailed += 1;
      }

      processedUsers += 1;

      // Update progress every 5 users so admin dashboard can poll
      if (processedUsers % 5 === 0) {
        await logRef.update({ processedUsers, totalUpdated, totalFailed, totalSkipped });
      }

      await wait(200);
    }

    await logRef.update({
      status: "completed",
      processedUsers,
      totalUpdated,
      totalFailed,
      totalSkipped,
      completedAt: adminServerTimestamp(),
    });

    return NextResponse.json({
      success: true,
      batchId,
      totalUsers: userIds.length,
      processedUsers,
      totalUpdated,
      totalFailed,
      totalSkipped,
    });
  } catch (err) {
    console.error("[BulkPriceUpdate] Fatal error:", err);
    await logRef.update({
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      completedAt: adminServerTimestamp(),
    });
    return NextResponse.json(
      { error: "Bulk update failed", details: String(err) },
      { status: 500 }
    );
  }
}
