import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return null;
  return adminAuth.verifyIdToken(token).catch(() => null);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.uid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const cardName = String(body?.cardName || "").trim();
    const player = String(body?.player || "").trim();
    const team = String(body?.team || "").trim();
    const setName = String(body?.setName || "").trim();
    const imageUrl = String(body?.imageUrl || "").trim();
    const assignedSpotNumber = Number(body?.assignedSpotNumber || 0);
    const estimatedValue = Math.max(0, Number(body?.estimatedValue || 0));

    if (!cardName || !team || !assignedSpotNumber) {
      return NextResponse.json(
        { error: "cardName, team, and assignedSpotNumber are required" },
        { status: 400 }
      );
    }

    const breakRef = adminDb.collection("breaks").doc(id);
    const breakSnap = await breakRef.get();
    if (!breakSnap.exists) {
      return NextResponse.json({ error: "Break not found" }, { status: 404 });
    }

    const breakData = breakSnap.data() || {};
    const isOwner = String(breakData.sellerId || "") === user.uid;
    if (!isOwner) {
      return NextResponse.json({ error: "Only the break host can record hits" }, { status: 403 });
    }

    const spots = Array.isArray(breakData.spots) ? breakData.spots : [];
    const targetSpot = spots.find((spot: any) => Number(spot.spotNumber) === assignedSpotNumber);
    if (!targetSpot?.ownerUserId) {
      return NextResponse.json({ error: "Selected spot is not assigned" }, { status: 400 });
    }

    const hit = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      createdAt: new Date().toISOString(),
      cardName,
      player,
      team,
      setName,
      imageUrl,
      estimatedValue,
      assignedSpotNumber,
      assignedUserId: String(targetSpot.ownerUserId),
      assignedUserName: String(targetSpot.ownerDisplayName || "Breaker"),
    };

    const existingHits = Array.isArray(breakData.hits) ? breakData.hits : [];
    const nextHits = [hit, ...existingHits].slice(0, 120);

    await breakRef.update({
      hits: nextHits,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("cards").add({
      userId: String(targetSpot.ownerUserId),
      name: cardName,
      player,
      sport: "Other",
      brand: setName || "Break Pull",
      year: new Date().getFullYear(),
      rarity: "Uncommon",
      condition: "Mint",
      value: estimatedValue || 0,
      marketPrice: estimatedValue || 0,
      priceSource: "break-assignment",
      imageUrl: imageUrl || "",
      breakId: id,
      breakSpotNumber: assignedSpotNumber,
      team,
      addedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: String(targetSpot.ownerUserId),
      type: "break-hit",
      title: "Your team just hit",
      message: `${cardName} was assigned to your break spot`,
      breakId: id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, hit });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to record hit", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
