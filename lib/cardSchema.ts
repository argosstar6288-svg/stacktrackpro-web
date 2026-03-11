export type StackTrackGameID = "pokemon" | "magic" | "yugioh" | "sports" | "marvel" | "other";

export interface GameDocument {
  gameID: StackTrackGameID;
  name: string;
  publisher?: string;
  logo?: string;
  totalCards?: number;
}

export interface SetDocument {
  setID: string;
  gameID: StackTrackGameID;
  name: string;
  year?: number;
  totalCards?: number;
  symbol?: string;
}

export interface MasterCardDocument {
  cardID: string;
  name: string;
  number?: string;
  setID: string;
  gameID: StackTrackGameID;
  rarity?: string;
  artist?: string;
  year?: number;
  image?: string;
  lookup: string;
  variants?: string[];
}

export interface CardVariantDocument {
  variantID: string;
  cardID: string;
  variantType: string;
  image?: string;
}

export interface CardMarketDataDocument {
  cardID: string;
  marketPrice?: number;
  lowPrice?: number;
  highPrice?: number;
  trend?: number;
  demandScore?: number;
  lastUpdated?: unknown;
}

export interface PriceHistoryDocument {
  cardID: string;
  price: number;
  date: string;
}

export interface UserCardDocument {
  userCardID?: string;
  userID: string;
  cardID: string;
  gameID?: StackTrackGameID;
  setID?: string;
  lookup?: string;
  condition?: string;
  grading?: string;
  value?: number;
  added?: unknown;
  folder?: string;
}

export interface CollectionDocument {
  collectionID?: string;
  userID: string;
  name: string;
  created?: unknown;
}

export interface MarketListingDocument {
  listingID?: string;
  sellerID: string;
  cardID: string;
  condition?: string;
  price: number;
  status: string;
  created?: unknown;
}

export interface AuctionDocument {
  auctionID?: string;
  cardID: string;
  sellerID: string;
  startPrice: number;
  currentBid?: number;
  endTime?: unknown;
  status: string;
}

export interface WatchlistDocument {
  userID: string;
  cardID: string;
}

export interface ScanDocument {
  scanID?: string;
  userID: string;
  cardID: string;
  gameID?: StackTrackGameID;
  setID?: string;
  lookup?: string;
  confidence?: number;
  timestamp?: unknown;
}

export function normalizeSchemaKey(value?: string | number | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function inferGameID(input: {
  game?: string;
  sport?: string;
  name?: string;
  brand?: string;
}): StackTrackGameID {
  const game = normalizeSchemaKey(input.game);
  const sport = normalizeSchemaKey(input.sport);
  const name = normalizeSchemaKey(input.name);
  const brand = normalizeSchemaKey(input.brand);
  const combined = [game, sport, name, brand].join(" ");

  if (combined.includes("pokemon") || combined.includes("pikachu") || combined.includes("charizard")) {
    return "pokemon";
  }

  if (combined.includes("magic") || combined.includes("black_lotus") || combined.includes("mtg")) {
    return "magic";
  }

  if (combined.includes("yugioh") || combined.includes("yu_gi_oh") || combined.includes("dark_magician")) {
    return "yugioh";
  }

  if (combined.includes("marvel")) {
    return "marvel";
  }

  if (sport) {
    return "sports";
  }

  if (game === "pokemon" || game === "magic" || game === "yugioh" || game === "sports" || game === "marvel") {
    return game;
  }

  return "other";
}

export function buildSetID(setName?: string, fallback = "unknown_set"): string {
  return normalizeSchemaKey(setName) || fallback;
}

export function buildCardLookup(input: {
  name?: string;
  cardNumber?: string;
  setName?: string;
}): string {
  const parts = [
    normalizeSchemaKey(input.name),
    normalizeSchemaKey(input.cardNumber),
    normalizeSchemaKey(input.setName),
  ].filter(Boolean);

  return parts.join("_") || "unknown_card";
}

export function buildMasterCardID(input: {
  gameID: StackTrackGameID;
  setID: string;
  number?: string;
  name?: string;
}): string {
  const parts = [
    normalizeSchemaKey(input.gameID),
    normalizeSchemaKey(input.setID),
    normalizeSchemaKey(input.number),
    normalizeSchemaKey(input.name),
  ].filter(Boolean);

  return parts.join("_") || "unknown_card";
}

export function buildCardImageStoragePath(input: {
  gameID: StackTrackGameID;
  setID: string;
  fileName: string;
}): string {
  return [
    "cards",
    normalizeSchemaKey(input.gameID),
    normalizeSchemaKey(input.setID),
    normalizeSchemaKey(input.fileName),
  ].join("/");
}