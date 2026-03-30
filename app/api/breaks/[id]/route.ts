import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { BreakType, getFillStats } from "@/lib/breaks";

const toIso = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

function mapBreak(id: string, data: any) {
  const spots = Array.isArray(data?.spots) ? data.spots : [];
  return {
    id,
    title: String(data?.title || "Untitled Break"),
    productName: String(data?.productName || "Unknown Product"),
    breakType: (data?.breakType || "random") as BreakType,
    spotCount: Number(data?.spotCount || spots.length || 0),
    spotPrice: Number(data?.spotPrice || 0),
    sellerId: String(data?.sellerId || ""),
    sellerName: String(data?.sellerName || "Host"),
    scheduledAt: toIso(data?.scheduledAt) || new Date().toISOString(),
    shippingRules: String(data?.shippingRules || ""),
    minFillRequirement: Number(data?.minFillRequirement || 0),
    status: String(data?.status || "filling"),
    spots,
    hits: Array.isArray(data?.hits) ? data.hits : [],
    createdAt: toIso(data?.createdAt),
    updatedAt: toIso(data?.updatedAt),
    fill: getFillStats(spots),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "break id required" }, { status: 400 });
    }

    const snapshot = await adminDb.collection("breaks").doc(id).get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Break not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, break: mapBreak(snapshot.id, snapshot.data()) });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load break", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
