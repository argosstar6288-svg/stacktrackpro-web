import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  buildCardFromScanResult,
  createMarketplaceListing,
  resolveSellerName,
  resolveUserCardForListing,
} from "@/lib/marketplaceServer";

async function getAuthenticatedUser(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    throw new Error("Authentication required");
  }

  return adminAuth.verifyIdToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const requestedCardId = String(body?.cardId || body?.userCardId || "").trim();
    const rawPrice = Number(body?.price ?? body?.suggestedValue ?? 0);

    let card = null;
    if (requestedCardId) {
      card = await resolveUserCardForListing(user.uid, requestedCardId);
    }

    if (!card && body?.scanResult) {
      card = buildCardFromScanResult(body.scanResult, {
        condition: String(body?.condition || body?.scanResult?.condition || "Near Mint"),
      });
    }

    if (!card) {
      return NextResponse.json({ error: "Card not found for this user" }, { status: 404 });
    }

    const sellerName = await resolveSellerName(user.uid, user.email);
    const result = await createMarketplaceListing({
      userId: user.uid,
      sellerName,
      price: rawPrice || card.value,
      card: {
        ...card,
        condition: String(body?.condition || card.condition || "Near Mint"),
      },
      listingType: body?.listingType,
      tradeFor: body?.tradeFor,
      description: String(body?.description || "").trim(),
      source: String(body?.source || "manual-api"),
    });

    return NextResponse.json({
      success: true,
      listingId: result.listingId,
      price: result.price,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create listing";
    const status = message === "Authentication required" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}