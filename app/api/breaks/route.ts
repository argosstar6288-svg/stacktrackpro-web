import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { BreakRecord, BreakType, buildInitialSpots, getFillStats } from "@/lib/breaks";

const toIso = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

function mapBreak(id: string, data: any): BreakRecord {
  return {
    id,
    title: String(data?.title || "Untitled Break"),
    productName: String(data?.productName || "Unknown Product"),
    breakType: (data?.breakType || "random") as BreakType,
    spotCount: Number(data?.spotCount || 0),
    spotPrice: Number(data?.spotPrice || 0),
    sellerId: String(data?.sellerId || ""),
    sellerName: String(data?.sellerName || "Host"),
    scheduledAt: toIso(data?.scheduledAt) || new Date().toISOString(),
    shippingRules: String(data?.shippingRules || ""),
    minFillRequirement: Number(data?.minFillRequirement || 0),
    status: data?.status || "filling",
    spots: Array.isArray(data?.spots) ? data.spots : [],
    hits: Array.isArray(data?.hits) ? data.hits : [],
    createdAt: toIso(data?.createdAt) || undefined,
    updatedAt: toIso(data?.updatedAt) || undefined,
  };
}

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return null;
  return adminAuth.verifyIdToken(token).catch(() => null);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = String(searchParams.get("status") || "all").trim();
    const max = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 20)));

    const snapshot = await adminDb
      .collection("breaks")
      .orderBy("scheduledAt", "asc")
      .limit(max)
      .get();

    let breaks = snapshot.docs.map((doc) => mapBreak(doc.id, doc.data()));
    if (statusFilter !== "all") {
      breaks = breaks.filter((item) => item.status === statusFilter);
    }

    const enriched = breaks.map((item) => ({
      ...item,
      fill: getFillStats(item.spots || []),
    }));

    return NextResponse.json({ success: true, breaks: enriched });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load breaks", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.uid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const breakType = String(body?.breakType || "random") as BreakType;
    const title = String(body?.title || "").trim();
    const productName = String(body?.productName || "").trim();
    const spotCount = Math.max(2, Math.min(100, Number(body?.spotCount || 0)));
    const spotPrice = Math.max(1, Number(body?.spotPrice || 0));
    const minFillRequirement = Math.max(1, Math.min(spotCount, Number(body?.minFillRequirement || spotCount)));

    if (!title || !productName || !spotCount || !spotPrice) {
      return NextResponse.json(
        { error: "title, productName, spotCount, and spotPrice are required" },
        { status: 400 }
      );
    }

    const sellerSnapshot = await adminDb.collection("users").doc(user.uid).get();
    const sellerData = sellerSnapshot.data() || {};
    const sellerName =
      String(sellerData?.displayName || "") ||
      String(sellerData?.firstName || "") ||
      String(user.email || "").split("@")[0] ||
      "Host";

    const scheduledAt = body?.scheduledAt ? new Date(String(body.scheduledAt)) : new Date(Date.now() + 60 * 60 * 1000);

    const record = {
      title,
      productName,
      breakType,
      spotCount,
      spotPrice,
      sellerId: user.uid,
      sellerName,
      scheduledAt,
      shippingRules: String(body?.shippingRules || "Standard shipping").trim(),
      minFillRequirement,
      status: "filling",
      spots: buildInitialSpots(spotCount, breakType),
      hits: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("breaks").add(record);
    return NextResponse.json({ success: true, breakId: docRef.id });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create break", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
