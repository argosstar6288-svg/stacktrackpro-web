import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { nextOpenSpot } from "@/lib/breaks";

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
    const requestedSpotNumber = Number(body?.spotNumber || 0);

    const breakRef = adminDb.collection("breaks").doc(id);
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(breakRef);
      if (!snap.exists) throw new Error("Break not found");

      const data = snap.data() || {};
      const spots = Array.isArray(data.spots) ? [...data.spots] : [];
      const breakStatus = String(data.status || "filling");

      if (!["filling", "ready", "live"].includes(breakStatus)) {
        throw new Error("This break is not open for new spots");
      }

      const alreadyJoined = spots.find((spot: any) => spot.ownerUserId === user.uid);
      if (alreadyJoined) {
        return { spotNumber: Number(alreadyJoined.spotNumber), status: "already_joined" };
      }

      let target = null as any;
      if (requestedSpotNumber > 0) {
        target = spots.find((spot: any) => Number(spot.spotNumber) === requestedSpotNumber);
        if (!target) throw new Error("Spot not found");
        if (target.ownerUserId) throw new Error("Spot already taken");
      } else {
        target = nextOpenSpot(spots as any);
        if (!target) throw new Error("No spots available");
      }

      const nextSpots = spots.map((spot: any) =>
        Number(spot.spotNumber) === Number(target.spotNumber)
          ? {
              ...spot,
              ownerUserId: user.uid,
              ownerDisplayName: user.name || user.email?.split("@")[0] || "Breaker",
              paid: true,
              paidAt: new Date().toISOString(),
            }
          : spot
      );

      const filled = nextSpots.filter((spot: any) => Boolean(spot.ownerUserId)).length;
      const minFill = Number(data.minFillRequirement || nextSpots.length);
      const nextStatus = filled >= minFill && breakStatus === "filling" ? "ready" : breakStatus;

      tx.update(breakRef, {
        spots: nextSpots,
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { spotNumber: Number(target.spotNumber), status: "joined" };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to join break" },
      { status: 400 }
    );
  }
}
