import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";

export type ScanLikeResult = {
  name?: string;
  player?: string;
  cardNumber?: string;
  setName?: string;
  year?: number;
  brand?: string;
  sport?: string;
  condition?: string;
  estimatedValue?: number;
  imageUrl?: string;
  photoUrl?: string;
};

export type ListingCardDetails = {
  cardId: string;
  cardName: string;
  cardNumber: string;
  player: string;
  year: number;
  brand: string;
  sport: string;
  condition: string;
  imageUrl: string | null;
  value: number;
};

type CreateMarketplaceListingInput = {
  userId: string;
  sellerName: string;
  price: number;
  card: ListingCardDetails;
  listingType?: "sell" | "trade" | "both";
  tradeFor?: string | null;
  description?: string;
  source?: string;
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectImageUrl(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized && !normalized.startsWith("data:")) {
      return normalized;
    }
  }

  return null;
}

function buildGeneratedCardId(scanResult: ScanLikeResult) {
  const seed = [
    scanResult.player,
    scanResult.year,
    scanResult.brand || scanResult.setName,
    scanResult.cardNumber,
    scanResult.name,
  ]
    .map((part) => normalizeText(part).toLowerCase())
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return seed || `scanned-card-${Date.now()}`;
}

export function buildQueryFromScanResult(scanResult: ScanLikeResult) {
  return [scanResult.player, scanResult.year, scanResult.brand || scanResult.setName, scanResult.cardNumber, scanResult.name]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCardFromScanResult(scanResult: ScanLikeResult, overrides: Partial<ListingCardDetails> = {}): ListingCardDetails {
  const cardName = normalizeText(overrides.cardName || scanResult.name || buildQueryFromScanResult(scanResult) || "Scanned Card");

  return {
    cardId: normalizeText(overrides.cardId || buildGeneratedCardId(scanResult)),
    cardName,
    cardNumber: normalizeText(overrides.cardNumber || scanResult.cardNumber),
    player: normalizeText(overrides.player || scanResult.player),
    year: normalizeNumber(overrides.year || scanResult.year, new Date().getFullYear()),
    brand: normalizeText(overrides.brand || scanResult.brand || scanResult.setName),
    sport: normalizeText(overrides.sport || scanResult.sport || "Other"),
    condition: normalizeText(overrides.condition || scanResult.condition || "Near Mint"),
    imageUrl: overrides.imageUrl ?? selectImageUrl(scanResult.imageUrl, scanResult.photoUrl),
    value: normalizeNumber(overrides.value ?? scanResult.estimatedValue, 0),
  };
}

export async function resolveSellerName(userId: string, fallbackEmail?: string | null) {
  const userSnapshot = await adminDb.collection(FLAT_COLLECTIONS.users).doc(userId).get();
  const userData = userSnapshot.data() || {};

  return normalizeText(
    userData.displayName ||
      [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
      normalizeText(fallbackEmail).split("@")[0] ||
      "Anonymous"
  );
}

export async function resolveUserCardForListing(userId: string, requestedCardId: string): Promise<ListingCardDetails | null> {
  const requestedId = normalizeText(requestedCardId);
  if (!requestedId) {
    return null;
  }

  let flatData: any = null;
  const flatDirect = await adminDb.collection(FLAT_COLLECTIONS.userCards).doc(requestedId).get();
  if (flatDirect.exists) {
    const directData = flatDirect.data() || {};
    if (normalizeText(directData.userID) !== userId) {
      return null;
    }
    flatData = directData;
  }

  if (!flatData) {
    const flatQuery = await adminDb
      .collection(FLAT_COLLECTIONS.userCards)
      .where("userID", "==", userId)
      .where("cardID", "==", requestedId)
      .limit(1)
      .get();

    if (!flatQuery.empty) {
      flatData = flatQuery.docs[0]?.data() || null;
    }
  }

  let legacyData: any = null;
  if (normalizeText(flatData?.legacyCardDocID)) {
    const legacyByReference = await adminDb.collection(FLAT_COLLECTIONS.cards).doc(String(flatData.legacyCardDocID)).get();
    if (legacyByReference.exists) {
      const directData = legacyByReference.data() || {};
      if (normalizeText(directData.userId) === userId) {
        legacyData = directData;
      }
    }
  }

  if (!legacyData) {
    const legacyDirect = await adminDb.collection(FLAT_COLLECTIONS.cards).doc(requestedId).get();
    if (legacyDirect.exists) {
      const directData = legacyDirect.data() || {};
      if (normalizeText(directData.userId) === userId) {
        legacyData = directData;
      }
    }
  }

  if (!legacyData) {
    const legacyCardId = normalizeText(flatData?.cardID) || requestedId;
    const legacyQuery = await adminDb
      .collection(FLAT_COLLECTIONS.cards)
      .where("userId", "==", userId)
      .where("cardID", "==", legacyCardId)
      .limit(1)
      .get();

    if (!legacyQuery.empty) {
      legacyData = legacyQuery.docs[0]?.data() || null;
    }
  }

  const merged = {
    ...(legacyData || {}),
    ...(flatData || {}),
  };

  if (!flatData && !legacyData) {
    return null;
  }

  return {
    cardId: normalizeText(merged.cardID || merged.cardId || requestedId),
    cardName: normalizeText(merged.cardName || merged.name || requestedId || "Card"),
    cardNumber: normalizeText(merged.cardNumber || merged.number),
    player: normalizeText(merged.player),
    year: normalizeNumber(merged.year, new Date().getFullYear()),
    brand: normalizeText(merged.brand || merged.set),
    sport: normalizeText(merged.sport || "Other"),
    condition: normalizeText(merged.condition || "Near Mint"),
    imageUrl: selectImageUrl(
      merged.imageUrl,
      merged.photoUrl,
      merged.image,
      merged.frontImageUrl,
      merged.thumbnailUrl
    ),
    value: normalizeNumber(merged.value ?? merged.marketPrice, 0),
  };
}

export async function createMarketplaceListing(input: CreateMarketplaceListingInput) {
  const price = normalizeNumber(input.price, 0);
  if (price <= 0) {
    throw new Error("Listing price must be greater than 0");
  }

  const listingType = input.listingType === "trade" || input.listingType === "both" ? input.listingType : "sell";
  const listingRef = adminDb.collection(FLAT_COLLECTIONS.marketListings).doc();
  const card = input.card;

  await listingRef.set({
    cards: [
      {
        cardId: card.cardId,
        cardID: card.cardId,
        cardName: card.cardName,
        cardNumber: card.cardNumber,
        player: card.player,
        year: card.year,
        brand: card.brand,
        sport: card.sport,
        condition: card.condition,
        imageUrl: card.imageUrl,
        value: card.value,
      },
    ],
    cardCount: 1,
    sellerID: input.userId,
    userId: input.userId,
    userID: input.userId,
    sellerName: input.sellerName,
    userName: input.sellerName,
    cardID: card.cardId,
    cardId: card.cardId,
    cardName: card.cardName,
    cardNumber: card.cardNumber,
    player: card.player,
    year: card.year,
    brand: card.brand,
    sport: card.sport,
    condition: card.condition,
    imageUrl: card.imageUrl,
    listingType,
    price,
    tradeFor: input.tradeFor || null,
    description: normalizeText(input.description),
    status: "active",
    views: 0,
    source: normalizeText(input.source || "manual-api"),
    created: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  return { listingId: listingRef.id, price };
}