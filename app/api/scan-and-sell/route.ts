import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  buildCardFromScanResult,
  buildQueryFromScanResult,
  createMarketplaceListing,
  resolveSellerName,
  resolveUserCardForListing,
  type ScanLikeResult,
} from "@/lib/marketplaceServer";

type ValueLookupResult = {
  price: number | null;
  valuation?: any;
  comparables?: any[];
};

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

async function runInternalScan(request: NextRequest, userId: string, image: string) {
  const response = await fetch(new URL("/api/scan-card-v2", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      image,
      userId,
      scanMode: "standard",
      useFastPath: true,
      aiVisionOnly: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || payload?.message || "Failed to scan card"));
  }

  return payload as ScanLikeResult;
}

async function lookupSuggestedValue(query: string): Promise<ValueLookupResult | null> {
  const endpoint =
    process.env.STACKTRACK_VALUE_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_STACKTRACK_VALUE_API_URL?.trim() ||
    "http://localhost:3000/api/value";

  try {
    const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
      method: "GET",
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return null;
    }

    return {
      price: typeof payload?.price === "number" ? payload.price : typeof payload?.value === "number" ? payload.value : null,
      valuation: payload?.valuation || null,
      comparables: Array.isArray(payload?.comparables) ? payload.comparables : [],
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const providedScanResult = body?.scanResult as ScanLikeResult | undefined;
    const image = typeof body?.image === "string" ? body.image : "";
    const requestedCardId = String(body?.cardId || body?.userCardId || "").trim();

    let scanResult = providedScanResult;
    if (!scanResult && image) {
      scanResult = await runInternalScan(request, user.uid, image);
    }

    if (!scanResult) {
      return NextResponse.json({ error: "image or scanResult is required" }, { status: 400 });
    }

    const query = String(body?.query || buildQueryFromScanResult(scanResult)).trim();
    const valueLookup = query ? await lookupSuggestedValue(query) : null;
    const suggestedPrice = Number(body?.price ?? valueLookup?.price ?? scanResult?.estimatedValue ?? 0);

    let card = requestedCardId ? await resolveUserCardForListing(user.uid, requestedCardId) : null;
    const scanCard = buildCardFromScanResult(scanResult, {
      condition: String(body?.condition || scanResult?.condition || "Near Mint"),
    });

    if (card) {
      card = {
        ...scanCard,
        ...card,
        condition: String(body?.condition || scanResult?.condition || card.condition || "Near Mint"),
        value: suggestedPrice || card.value,
      };
    } else {
      card = {
        ...scanCard,
        value: suggestedPrice || scanCard.value,
      };
    }

    const sellerName = await resolveSellerName(user.uid, user.email);
    const result = await createMarketplaceListing({
      userId: user.uid,
      sellerName,
      price: suggestedPrice || card.value,
      card,
      listingType: body?.listingType,
      tradeFor: body?.tradeFor,
      description: String(body?.description || "Auto-listed from scanner").trim(),
      source: "scan-and-sell",
    });

    return NextResponse.json({
      success: true,
      listingId: result.listingId,
      query,
      price: result.price,
      valuation: valueLookup?.valuation || null,
      comparables: valueLookup?.comparables || [],
      scanResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scan and sell";
    const status = message === "Authentication required" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}