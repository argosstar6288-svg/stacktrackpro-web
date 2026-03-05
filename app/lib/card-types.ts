/**
 * Card data types for Pokemon TCG cards
 */

export interface CardImage {
  small: string | null;
  large: string | null;
}

export interface CardPrice {
  normal?: number;
  holofoil?: number;
  reverseHolofoil?: number;
}

export interface CardSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities?: Record<string, string>;
  ptcgoCode?: string;
  releaseDate: string;
  updatedAt: string;
  images: {
    symbol: string;
    logo: string;
  };
}

export interface PokemonCardData {
  id: string; // Pokemon TCG Card ID (e.g., "base1-4")
  name: string; // Card name
  supertype: string; // "Pokémon", "Trainer", "Energy"
  subtypes?: string[]; // e.g., ["Stage 2", "Dragon"]
  hp?: number; // Hit points
  types?: string[]; // e.g., ["Fire", "Water"]
  evolvesFrom?: string;
  evolvesTo?: string[];
  
  // Image data
  images: CardImage;
  
  // Card details
  cardNumber: string; // Number in set (e.g., "4")
  rarity?: string; // "Common", "Uncommon", "Rare", etc.
  flavorText?: string;
  
  // Set information
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal?: number;
    total?: number;
  };
  
  // Search metadata
  releaseDate: string;
  updatedAt: string;
  legalities?: Record<string, string>;
  
  // TCGPlayer pricing (if available)
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      normal?: CardPrice;
      holofoil?: CardPrice;
      reverseHolofoil?: CardPrice;
    };
  };
}

/**
 * Firestore Document structure for storing cards
 */
export interface FirestoreCardDocument extends Omit<PokemonCardData, 'set'> {
  // Flatten set data for easier querying
  setId: string;
  setName: string;
  seriesName: string;
  
  // Search fields
  searchName: string; // Lowercase name for search
  searchTerms: string[]; // Array of searchable terms
  
  // Timestamps
  createdAt?: Date;
  lastUpdated?: Date;
}

/**
 * Response format from Pokemon TCG API v2
 */
export interface PokemonTCGApiResponse {
  data: PokemonCardData[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

/**
 * Batch import status
 */
export interface ImportStats {
  totalCards: number;
  imported: number;
  failed: number;
  skipped: number;
  errors: Array<{
    cardId: string;
    error: string;
  }>;
  duration: number; // milliseconds
}
