import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

let db: any;
if (getApps().length === 0) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else {
  db = getFirestore(getApps()[0]);
}

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

async function requireUserMatch(request: NextRequest, userId: string) {
  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  const authenticatedUid = await getUidFromIdToken(idToken);
  if (!authenticatedUid) {
    return { ok: false, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  if (authenticatedUid !== userId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden: user mismatch" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const cardId = String(body?.cardId || "").trim();
    const cardName = String(body?.cardName || "").trim();
    const operator = String(body?.operator || "below").toLowerCase() === "above" ? "above" : "below";
    const targetPrice = Number(body?.targetPrice || 0);

    if (!userId || !cardId || !cardName || !targetPrice || targetPrice <= 0) {
      return NextResponse.json({ error: "userId, cardId, cardName, and targetPrice are required" }, { status: 400 });
    }

    const authCheck = await requireUserMatch(request, userId);
    if (!authCheck.ok) return authCheck.response;

    const alertsSnapshot = await getDocs(
      query(collection(db, "cardAlerts"), where("userId", "==", userId))
    );

    const existing = alertsSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }))
      .find((alert) => alert.cardId === cardId && alert.operator === operator && alert.status !== "triggered");

    if (existing) {
      await updateDoc(doc(db, "cardAlerts", existing.id), {
        targetPrice,
        cardName,
        status: "active",
        updatedAt: serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        action: "updated",
        alertId: existing.id,
        message: `Updated alert for ${cardName}`,
      });
    }

    const alertRef = await addDoc(collection(db, "cardAlerts"), {
      userId,
      cardId,
      cardName,
      operator,
      targetPrice,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      action: "created",
      alertId: alertRef.id,
      message: `Alert saved for ${cardName}`,
    });
  } catch (error) {
    console.error("[Card Alerts] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to save card alert",
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
    const authCheck = await requireUserMatch(request, userId);
    if (!authCheck.ok) return authCheck.response;

    const alertsSnapshot = await getDocs(
      query(collection(db, "cardAlerts"), where("userId", "==", userId))
    );

    const alerts = alertsSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as any) }))
      .sort((a, b) => {
        const aMs = typeof a?.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;
        const bMs = typeof b?.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;
        return bMs - aMs;
      });

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error("[Card Alerts] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to load card alerts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const alertId = String(body?.alertId || "").trim();

    if (!userId || !alertId) {
      return NextResponse.json({ error: "userId and alertId are required" }, { status: 400 });
    }

    const authCheck = await requireUserMatch(request, userId);
    if (!authCheck.ok) return authCheck.response;

    await deleteDoc(doc(db, "cardAlerts", alertId));
    return NextResponse.json({ success: true, message: "Alert removed" });
  } catch (error) {
    console.error("[Card Alerts] DELETE error:", error);
    return NextResponse.json(
      {
        error: "Failed to remove card alert",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
