export const FLAT_COLLECTIONS = {
  users: "users",
  games: "games",
  sets: "sets",
  cards: "cards",
  globalCardIndex: "globalCardIndex",
  variants: "variants",
  cardMarketData: "cardMarketData",
  collections: "collections",
  userCards: "userCards",
  scans: "scans",
  marketListings: "marketListings",
  auctions: "auctions",
  auctionBids: "auctionBids",
  watchlists: "watchlists",
  priceHistory: "priceHistory",
  priceUpdateJobs: "priceUpdateJobs",
  cardAlerts: "cardAlerts",
} as const;

export interface FlatUserCard {
  id?: string;
  userID: string;
  cardID: string;
  condition?: string;
  grading?: string;
  value?: number;
  added?: any;
  folder?: string;
}

export interface FlatMasterCard {
  id?: string;
  cardID?: string;
  gameID?: string;
  setID?: string;
  lookup?: string;
  name?: string;
  set?: string;
  year?: number;
  number?: string;
  image?: string;
  avgPrice?: number;
  psa10Price?: number;
}
