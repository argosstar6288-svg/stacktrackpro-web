import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { buildPriceIntelligence } from "@/lib/priceIntelligence";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const PRICECHARTING_API_KEY = process.env.PRICECHARTING_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

let db: any;
if (getApps().length === 0) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else {
  db = getFirestore(getApps()[0]);
}

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
  if (!idToken || !FIREBASE_WEB_API_KEY) return null;

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

  const name = String(card?.name || "").trim();
  if (!name) return { found: false, error: "Card missing name" };

  let searchQuery = name;
  if (card?.player) searchQuery = `${card.player} ${searchQuery}`;
  if (card?.year) searchQuery = `${card.year} ${searchQuery}`;
  if (card?.brand) searchQuery = `${card.brand} ${searchQuery}`;

  const consoleName = card?.sport ? `${card.sport} Cards` : "Baseball Cards";

  const url = new URL("https://www.pricecharting.com/api/product");
  url.searchParams.append("t", PRICECHARTING_API_KEY);
  url.searchParams.append("q", searchQuery);
  url.searchParams.append("console", consoleName);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "User-Agent": "StackTrackPro/1.0" },
    });

    if (!response.ok) {
      return { found: false, error: `PriceCharting error ${response.status}` };
    }

    const data = await response.json();
    if (data?.status === "error") {
      return { found: false, error: data?.["error-message"] || "not found" };
    }

    const loose = data?.["loose-price"] ? data["loose-price"] / 100 : null;
    const complete = data?.["cib-price"] ? data["cib-price"] / 100 : null;
    const mint = data?.["new-price"] ? data["new-price"] / 100 : null;

    let suggestedPrice = loose;
    const cardCondition = String(card?.condition || "").toLowerCase();
    if (cardCondition === "mint" && mint != null) {
      suggestedPrice = mint;
    } else if (complete != null) {
      suggestedPrice = complete;
    }

    if (suggestedPrice == null) {
      return { found: false, error: "No usable price returned" };
    }

    return {
      found: true,
      suggestedPrice: Number(suggestedPrice),
      source: "pricecharting",
    };
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : "Unknown lookup error",
    };
  }
}

async function processQueuedJobs(maxJobs = 1) {
  const jobsSnapshot = await getDocs(query(collection(db, "priceUpdateJobs"), limit(25)));

  const queuedJobs = jobsSnapshot.docs
    .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }) as UpdateJob)
    .filter((job) => job.status === "queued")
    .sort((a, b) => toMillis(a.requestedAt) - toMillis(b.requestedAt))
    .slice(0, Math.max(1, Math.min(maxJobs, 10)));

  let processedJobs = 0;
  let totalCardsUpdated = 0;

  for (const job of queuedJobs) {
    processedJobs += 1;

    const jobRef = doc(db, "priceUpdateJobs", job.id);
    await updateDoc(jobRef, {
      status: "processing",
      startedAt: serverTimestamp(),
    });

    try {
      const cardsSnapshot = await getDocs(
        query(collection(db, "cards"), where("userId", "==", job.userId))
      );

      const cards = cardsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...(snapshot.data() as any),
      }));

      const targetCards = Array.isArray(job.cardIds) && job.cardIds.length > 0
        ? cards.filter((card) => job.cardIds?.includes(card.id))
        : cards;

      const alertsSnapshot = await getDocs(
        query(collection(db, "cardAlerts"), where("userId", "==", job.userId))
      );

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

        await updateDoc(doc(db, "cards", card.id), {
          marketPrice: currentPrice,
          priceLastUpdated: new Date().toISOString(),
          predicted30DayValue: intelligence.predicted30DayValue,
          rarityTier: intelligence.rarityTier,
          rarity: card.rarity || toLegacyRarity(intelligence.rarityTier),
          priceSource: lookup.source || "pricecharting",
          updatedAt: serverTimestamp(),
        });

        updatedCards += 1;

        const cardAlerts = activeAlerts.filter((alert) => alert.cardId === card.id);
        for (const alert of cardAlerts) {
          const operator = String(alert.operator || "below").toLowerCase();
          const targetPrice = Number(alert.targetPrice || 0);
          const shouldTrigger = operator === "below"
            ? currentPrice <= targetPrice
            : currentPrice >= targetPrice;

          if (!shouldTrigger) continue;

          await updateDoc(doc(db, "cardAlerts", alert.id), {
            status: "triggered",
            triggeredAt: serverTimestamp(),
            triggeredPrice: currentPrice,
          });
          triggeredAlerts += 1;
        }

        await wait(400);
      }

      totalCardsUpdated += updatedCards;

      await updateDoc(jobRef, {
        status: "completed",
        totalCards: targetCards.length,
        updatedCards,
        failedCards,
        triggeredAlerts,
        completedAt: serverTimestamp(),
      });
    } catch (error) {
      await updateDoc(jobRef, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown processing error",
        completedAt: serverTimestamp(),
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

    const jobRef = await addDoc(collection(db, "priceUpdateJobs"), {
      userId,
      cardIds,
      status: "queued",
      source: "user",
      requestedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      mode: "enqueue",
      jobId: jobRef.id,
      queuedCards: cardIds.length || "all",
      message: "Background price update queued",
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

    const jobsSnapshot = await getDocs(
      query(collection(db, "priceUpdateJobs"), where("userId", "==", userId), limit(20))
    );

    const jobs = jobsSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }))
      .sort((a, b) => toMillis(b.requestedAt) - toMillis(a.requestedAt));

    const latestJob = jobs[0] || null;

    const cardsSnapshot = await getDocs(query(collection(db, "cards"), where("userId", "==", userId)));
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
