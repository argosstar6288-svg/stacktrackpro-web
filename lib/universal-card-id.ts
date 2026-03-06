/**
 * Universal Card ID Generator for StackTrackPro
 * 
 * Generates standardized IDs in format:
 * STK-{GAME}-{YEAR}-{SET}-{NUMBER}-{NAME}
 * 
 * Examples:
 * - STK-NBA-1996-TOPPS-138-KOBE
 * - STK-POKEMON-1999-BASE-004-CHARIZARD
 * - STK-MAGIC-2023-MOM-125-WRENN
 */

/**
 * Sanitize a string for use in a card ID
 */
function sanitizeForId(str: string | undefined | null): string {
  if (!str) return "UNKNOWN";
  
  return str
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "-") // Replace non-alphanumeric with dash
    .replace(/-+/g, "-")         // Replace multiple dashes with single
    .replace(/^-|-$/g, "")       // Remove leading/trailing dashes
    .slice(0, 20);               // Limit length
}

/**
 * Pad card number for consistent sorting
 */
function padCardNumber(cardNumber: string | undefined): string {
  if (!cardNumber) return "000";
  
  // Extract numeric part if exists
  const numMatch = cardNumber.match(/\d+/);
  if (numMatch) {
    const num = numMatch[0].padStart(3, "0");
    const suffix = cardNumber.replace(numMatch[0], "");
    return (num + sanitizeForId(suffix)).slice(0, 10);
  }
  
  return sanitizeForId(cardNumber).slice(0, 10);
}

/**
 * Generate Universal StackTrack Card ID
 */
export function generateStackTrackId(cardData: {
  game: string;
  name: string;
  year?: number | string;
  set?: string | { id?: string; name?: string; code?: string };
  cardNumber?: string;
  player?: string;
  sport?: string;
}): string {
  // Determine game category
  let gameCategory = sanitizeForId(cardData.game);
  
  // For sports cards, use sport as category
  if (cardData.sport && cardData.game === "sports") {
    gameCategory = sanitizeForId(cardData.sport);
  }
  
  // Extract year
  const year = cardData.year 
    ? String(cardData.year).slice(0, 4)
    : "0000";
  
  // Extract set identifier
  let setId = "UNKNOWN";
  if (typeof cardData.set === "object" && cardData.set) {
    setId = cardData.set.id || cardData.set.code || cardData.set.name || "UNKNOWN";
  } else if (typeof cardData.set === "string") {
    setId = cardData.set;
  }
  setId = sanitizeForId(setId);
  
  // Get card number
  const number = padCardNumber(cardData.cardNumber);
  
  // Get primary name (player for sports, card name otherwise)
  const primaryName = cardData.player || cardData.name || "CARD";
  const namePart = sanitizeForId(primaryName).split("-")[0]; // First word only
  
  // Construct ID
  const stacktrackId = `STK-${gameCategory}-${year}-${setId}-${number}-${namePart}`;
  
  return stacktrackId.slice(0, 80); // Ensure max length
}

/**
 * Parse a StackTrack ID back into components
 */
export function parseStackTrackId(stacktrackId: string): {
  game: string;
  year: string;
  set: string;
  number: string;
  name: string;
} | null {
  if (!stacktrackId.startsWith("STK-")) {
    return null;
  }
  
  const parts = stacktrackId.split("-");
  if (parts.length < 6) {
    return null;
  }
  
  return {
    game: parts[1],
    year: parts[2],
    set: parts[3],
    number: parts[4],
    name: parts.slice(5).join("-"),
  };
}

/**
 * Generate batch of IDs for multiple cards
 */
export function generateStackTrackIds(cards: any[]): Map<string, string> {
  const idMap = new Map<string, string>();
  const usedIds = new Set<string>();
  
  for (const card of cards) {
    let stacktrackId = generateStackTrackId(card);
    
    // Handle duplicates by adding suffix
    let suffix = 0;
    let finalId = stacktrackId;
    while (usedIds.has(finalId)) {
      suffix++;
      finalId = `${stacktrackId}-${suffix}`;
    }
    
    usedIds.add(finalId);
    idMap.set(card.catalogId || card.id, finalId);
  }
  
  return idMap;
}

/**
 * Validate a StackTrack ID format
 */
export function isValidStackTrackId(id: string): boolean {
  if (!id.startsWith("STK-")) return false;
  
  const parts = id.split("-");
  if (parts.length < 6) return false;
  
  // Check year is valid
  const year = parseInt(parts[2]);
  if (isNaN(year) || year < 1800 || year > 2100) return false;
  
  return true;
}

/**
 * Generate ID from scanner results
 */
export function generateIdFromScanResults(scanResult: {
  name: string;
  player?: string;
  year?: number;
  brand?: string;
  sport?: string;
  cardNumber?: string;
}): string {
  return generateStackTrackId({
    game: scanResult.sport || "other",
    name: scanResult.name,
    year: scanResult.year,
    set: scanResult.brand || "unknown",
    cardNumber: scanResult.cardNumber,
    player: scanResult.player,
    sport: scanResult.sport,
  });
}

/**
 * Search for existing StackTrack ID by card attributes
 * Useful for deduplication
 */
export function findSimilarStackTrackId(
  searchName: string,
  year?: number | string,
  set?: string,
  existingIds: string[] = []
): string | null {
  const searchTerms = [
    sanitizeForId(searchName),
    year ? String(year) : null,
    set ? sanitizeForId(set) : null,
  ].filter(Boolean);
  
  for (const id of existingIds) {
    const includesAllTerms = searchTerms.every(term => 
      id.toUpperCase().includes(term!)
    );
    
    if (includesAllTerms) {
      return id;
    }
  }
  
  return null;
}

/**
 * Example IDs for different card types
 */
export const EXAMPLE_IDS = {
  sports: {
    kobe: "STK-BASKETBALL-1996-TOPPS-138-KOBE",
    jordanRookie: "STK-BASKETBALL-1986-FLEER-057-JORDAN",
    mahomes: "STK-FOOTBALL-2017-PRIZM-050-MAHOMES",
    trout: "STK-BASEBALL-2011-TOPPS-175-TROUT",
  },
  pokemon: {
    charizard: "STK-POKEMON-1999-BASE-004-CHARIZARD",
    pikachu: "STK-POKEMON-1999-BASE-058-PIKACHU",
    mewtwo: "STK-POKEMON-1999-BASE-010-MEWTWO",
  },
  magic: {
    blackLotus: "STK-MAGIC-1993-ALPHA-001-BLACK",
    moxPearl: "STK-MAGIC-1993-ALPHA-002-MOX",
  },
  yugioh: {
    blueEyes: "STK-YUGIOH-2002-LOB-001-BLUE",
    darkMagician: "STK-YUGIOH-2002-LOB-005-DARK",
  },
};
