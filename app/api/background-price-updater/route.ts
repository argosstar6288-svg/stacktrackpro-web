import { NextRequest, NextResponse } from "next/server";
import {
  limit,
  query,
  where,
} from "firebase/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { buildPriceIntelligence } from "@/lib/priceIntelligence";
import { adminDb, adminServerTimestamp } from "@/lib/firebase-admin";
import { fetchPriceChartingValue } from "@/lib/pricecharting";

const FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const PRICECHARTING_API_KEY = process.env.PRICECHARTING_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

type UpdateJob = {
  id: string;
  userId: string;
  status: "queued" | "processing" | "completed" | "failed";
  cardIds?: string[];
  requestedAt?: any;
  completedAt?: any;
  error?: string;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toISODate = (value: any): string | null => {
  const ms = toMillis(value);
  if (!ms) return null;
  return new Date(ms).toISOString();
};

async function getUidFromIdToken(idToken: string): Promise<string | null> {
  if (!idToken) return null;

  // Prefer Admin SDK verification so this route works even when web API key
  // is not available in the server runtime.
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded?.uid) return decoded.uid;
  } catch {
    // Fallback to Identity Toolkit lookup below.
  }

  if (!FIREBASE_WEB_API_KEY) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data?.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

function toLegacyRarity(rarityTier: "Ultra Rare" | "Rare" | "Common") {
  if (rarityTier === "Ultra Rare") return "Legendary";
  if (rarityTier === "Rare") return "Rare";
  return "Common";
}

async function lookupPriceFromPriceCharting(card: any): Promise<{
  found: boolean;
  suggestedPrice?: number;
  source?: string;
  error?: string;
}> {
  if (!PRICECHARTING_API_KEY) {
    return { found: false, error: "PRICECHARTING_API_KEY missing" };
  }

  const suggestedPrice = await fetchPriceChartingValue({
    name: String(card?.name || "").trim(),
    player: card?.player,
    year: card?.year,
    brand: card?.brand,
    sport: card?.sport,
    game: card?.gameID || card?.game,
    condition: card?.condition,
  });

  if (suggestedPrice == null) {
    return { found: false, error: "No usable price returned" };
  }

  return {
    found: true,
    suggestedPrice: Number(suggestedPrice),
    source: "pricecharting",
  };
}

export async function processQueuedJobs(maxJobs = 1, filterUserId?: string) {
  const jobsSnapshot = await adminDb.collection("priceUpdateJobs").limit(25).get();

  const queuedJobs = jobsSnapshot.docs
    .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }) as UpdateJob)
    .filter((job) => job.status === "queued" && (!filterUserId || job.userId === filterUserId))
    .sort((a, b) => toMillis(a.requestedAt) - toMillis(b.requestedAt))
    .slice(0, Math.max(1, Math.min(maxJobs, 10)));

  let processedJobs = 0;
  let totalCardsUpdated = 0;

  for (const job of queuedJobs) {
    processedJobs += 1;

    const jobRef = adminDb.collection("priceUpdateJobs").doc(job.id);
    await jobRef.update({
      status: "processing",
      startedAt: adminServerTimestamp(),
    });

    try {
      const cardsSnapshot = await adminDb.collection("cards").where("userId", "==", job.userId).get();

      const cards = cardsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...(snapshot.data() as any),
      }));

      const userCardsSnapshot = await adminDb
        .collection("userCards")
        .where("userID", "==", job.userId)
        .get();

      const userCardsByLegacyId = new Map<string, string[]>();
      const userCardsByCardId = new Map<string, string[]>();

      for (const snapshot of userCardsSnapshot.docs) {
        const data = snapshot.data() as any;
        const legacyCardDocID = String(data?.legacyCardDocID || "").trim();
        const cardID = String(data?.cardID || "").trim();

        if (legacyCardDocID) {
          const list = userCardsByLegacyId.get(legacyCardDocID) || [];
          list.push(snapshot.id);
          userCardsByLegacyId.set(legacyCardDocID, list);
        }

        if (cardID) {
          const list = userCardsByCardId.get(cardID) || [];
          list.push(snapshot.id);
          userCardsByCardId.set(cardID, list);
        }
      }

      const targetCards = Array.isArray(job.cardIds) && job.cardIds.length > 0
        ? cards.filter((card) => job.cardIds?.includes(card.id))
        : cards;

      const alertsSnapshot = await adminDb.collection("cardAlerts").where("userId", "==", job.userId).get();

      const activeAlerts = alertsSnapshot.docs
        .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }))
        .filter((alert) => alert.status !== "triggered");

      let updatedCards = 0;
      let failedCards = 0;
      let triggeredAlerts = 0;

      for (const card of targetCards) {
        const lookup = await lookupPriceFromPriceCharting(card);

        if (!lookup.found || typeof lookup.suggestedPrice !== "number") {
          failedCards += 1;
          continue;
        }

        const currentPrice = Number(lookup.suggestedPrice);
        const populationCount = Number(card.populationCount || card.population || 0) || undefined;
        const supplyCount = Number(card.supplyCount || card.supply || 0) || undefined;

        const intelligence = buildPriceIntelligence({
          currentPrice,
          populationCount,
          supplyCount,
          rarityHint: card.rarity,
        });

        await adminDb.collection("cards").doc(card.id).update({
          marketPrice: currentPrice,
          priceLastUpdated: new Date().toISOString(),
          predicted30DayValue: intelligence.predicted30DayValue,
          rarityTier: intelligence.rarityTier,
          rarity: card.rarity || toLegacyRarity(intelligence.rarityTier),
          priceSource: lookup.source || "pricecharting",
          updatedAt: adminServerTimestamp(),
        });

        const relatedUserCardDocIds = new Set<string>([
          ...(userCardsByLegacyId.get(card.id) || []),
          ...(userCardsByCardId.get(String(card.cardID || "").trim()) || []),
        ]);

        if (relatedUserCardDocIds.size > 0) {
          await Promise.all(
            Array.from(relatedUserCardDocIds).map((userCardDocId) =>
              adminDb.collection("userCards").doc(userCardDocId).update({
                value: currentPrice,
                marketPrice: currentPrice,
                priceLastUpdated: new Date().toISOString(),
                updatedAt: adminServerTimestamp(),
              })
            )
          );
        }

        updatedCards += 1;

        const cardAlerts = activeAlerts.filter((alert) => alert.cardId === card.id);
        for (const alert of cardAlerts) {
          const operator = String(alert.operator || "below").toLowerCase();
          const targetPrice = Number(alert.targetPrice || 0);
          const shouldTrigger = operator === "below"
            ? currentPrice <= targetPrice
            : currentPrice >= targetPrice;

          if (!shouldTrigger) continue;

          await adminDb.collection("cardAlerts").doc(alert.id).update({
            status: "triggered",
            triggeredAt: adminServerTimestamp(),
            triggeredPrice: currentPrice,
          });
          triggeredAlerts += 1;
        }

        await wait(400);
      }

      totalCardsUpdated += updatedCards;

      await jobRef.update({
        status: "completed",
        totalCards: targetCards.length,
        updatedCards,
        failedCards,
        triggeredAlerts,
        completedAt: adminServerTimestamp(),
      });
    } catch (error) {
      await jobRef.update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown processing error",
        completedAt: adminServerTimestamp(),
      });
    }
  }

  return {
    processedJobs,
    totalCardsUpdated,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === "process" ? "process" : "enqueue";

    if (mode === "process") {
      const authHeader = request.headers.get("authorization") || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : "";

      if (!CRON_SECRET || token !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const maxJobs = Number(body?.maxJobs || 1);
      const result = await processQueuedJobs(maxJobs);
      return NextResponse.json({ success: true, mode: "process", ...result });
    }

    const userId = String(body?.userId || "").trim();
    const cardIds = Array.isArray(body?.cardIds)
      ? body.cardIds.filter((id: unknown) => typeof id === "string" && id.trim().length > 0)
      : [];

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    const authenticatedUid = await getUidFromIdToken(idToken);
    if (!authenticatedUid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (authenticatedUid !== userId) {
      return NextResponse.json({ error: "Forbidden: user mismatch" }, { status: 403 });
    }

    const jobRef = await adminDb.collection("priceUpdateJobs").add({
      userId,
      cardIds,
      status: "queued",
      source: "user",
      requestedAt: adminServerTimestamp(),
    });

    // Process the queued job immediately (inline) rather than waiting for a cron
    let processResult = { processedJobs: 0, totalCardsUpdated: 0 };
    try {
      processResult = await processQueuedJobs(1, userId);
    } catch (processErr) {
      console.error("[Background Updater] Inline processing error:", processErr);
      // Job stays in 'queued' state — cron will pick it up
    }

    return NextResponse.json({
      success: true,
      mode: "enqueue",
      jobId: jobRef.id,
      queuedCards: cardIds.length || "all",
      processedImmediately: processResult.processedJobs > 0,
      updatedCards: processResult.totalCardsUpdated,
      message: processResult.processedJobs > 0
        ? `Updated ${processResult.totalCardsUpdated} card price(s)`
        : "Background price update queued",
    });
  } catch (error) {
    console.error("[Background Updater] Error:", error);
    return NextResponse.json(
      {
        error: "Background updater failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get("userId") || "").trim();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const authHeader = request.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    const authenticatedUid = await getUidFromIdToken(idToken);
    if (!authenticatedUid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (authenticatedUid !== userId) {
      return NextResponse.json({ error: "Forbidden: user mismatch" }, { status: 403 });
    }

    const jobsSnapshot = await adminDb
      .collection("priceUpdateJobs")
      .where("userId", "==", userId)
      .limit(20)
      .get();

    const jobs = jobsSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }))
      .sort((a, b) => toMillis(b.requestedAt) - toMillis(a.requestedAt));

    const latestJob = jobs[0] || null;

    const cardsSnapshot = await adminDb.collection("cards").where("userId", "==", userId).get();
    const cards = cardsSnapshot.docs.map((snapshot) => snapshot.data() as any);

    const now = Date.now();
    const needsUpdateCount = cards.filter((card) => {
      const updatedAt = card?.priceLastUpdated ? Date.parse(card.priceLastUpdated) : 0;
      if (!updatedAt || Number.isNaN(updatedAt)) return true;
      return now - updatedAt > 24 * 60 * 60 * 1000;
    }).length;

    return NextResponse.json({
      success: true,
      latestJob: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            requestedAt: toISODate(latestJob.requestedAt),
            completedAt: toISODate(latestJob.completedAt),
            updatedCards: Number(latestJob.updatedCards || 0),
            failedCards: Number(latestJob.failedCards || 0),
          }
        : null,
      cardsNeedingUpdate: needsUpdateCount,
      totalCards: cards.length,
    });
  } catch (error) {
    console.error("[Background Updater] Status error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch updater status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
