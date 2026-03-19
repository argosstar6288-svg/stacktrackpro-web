import { NextRequest, NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query, where } from "firebase/firestore";
import { isAdminEmail } from "@/lib/adminAccess";
import { processQueuedJobs } from "@/app/api/background-price-updater/route";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

const app = getApps()[0] ?? initializeApp(firebaseConfig);
const db = getFirestore(app);

type AuthenticatedUser = {
  uid: string;
  email: string | null;
};

async function getUserFromIdToken(idToken: string): Promise<AuthenticatedUser | null> {
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
    const user = data?.users?.[0];
    if (!user?.localId) return null;

    return {
      uid: String(user.localId),
      email: user?.email ? String(user.email) : null,
    };
  } catch {
    return null;
  }
}

async function isAdminUser(uid: string, email: string | null): Promise<boolean> {
  if (email && isAdminEmail(email)) return true;

  try {
    const usersRef = collection(db, "users");
    const snap = await getDocs(query(usersRef, where("uid", "==", uid)));
    const userData = snap.docs[0]?.data();
    return userData?.role === "admin" || userData?.isAdmin === true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    const user = await getUserFromIdToken(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const admin = await isAdminUser(user.uid, user.email);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const maxJobs = Math.max(1, Math.min(10, Number(body?.maxJobs || 5)));

    const result = await processQueuedJobs(maxJobs);

    return NextResponse.json({
      success: true,
      message: "Background updater executed",
      ...result,
    });
  } catch (error) {
    console.error("[Admin Background Updater] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to run background updater",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}