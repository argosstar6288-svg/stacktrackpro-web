/**
 * Card DNA System - Fuzzy Matching for Card Identification
 * 
 * Handles OCR errors and variations by using normalized "DNA" fields
 * and scoring-based matching instead of exact string comparison.
 */

/**
 * DNA Profile - Normalized searchable fields
 */
export interface CardDNA {
  player?: string;       // "kobe bryant"
  team?: string;         // "lakers"
  year?: string;         // "1996"
  set?: string;          // "topps"
  number?: string;       // "138"
  brand?: string;        // "topps"
  sport?: string;        // "basketball"
  name?: string;         // Card name (Pokemon, Magic, etc.)
  type?: string;         // Card type
}

/**
 * Synonym/variation mappings for common OCR errors
 */
const SYNONYMS: { [key: string]: string } = {
  // Teams
  "la": "los angeles",
  "lakers": "los angeles lakers",
  "bulls": "chicago bulls",
  "heat": "miami heat",
  "warriors": "golden state warriors",
  "knicks": "new york knicks",
  "celtics": "boston celtics",
  
  // Sets/Brands
  "topps": "topps",
  "tops": "topps",
  "topp": "topps",
  "panini": "panini",
  "upper deck": "upperdeck",
  "upperdeck": "upperdeck",
  "fleer": "fleer",
  "donruss": "donruss",
  "select": "select",
  "prizm": "prizm",
  "chrome": "chrome",
  
  // Pokemon
  "base": "base set",
  "jungle": "jungle",
  "fossil": "fossil",
};

/**
 * Team name normalizations
 */
const TEAM_MAPPINGS: { [key: string]: string } = {
  "la lakers": "lakers",
  "los angeles lakers": "lakers",
  "l.a. lakers": "lakers",
  "chicago bulls": "bulls",
  "miami heat": "heat",
  "golden state warriors": "warriors",
  "gs warriors": "warriors",
  "new york knicks": "knicks",
  "ny knicks": "knicks",
  "boston celtics": "celtics",
};

/**
 * Always clean scanned/OCR text before searching.
 *
 * Example behavior:
 * cleanText("1996 TOPS #138") -> "1996 tops 138"
 */
export function cleanText(text: string | undefined | null): string {
  if (!text) return "";

  return text
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean card number while preserving numeric fidelity.
 */
function cleanCardNumber(text: string | undefined | null): string {
  if (!text) return "";

  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Normalize text for DNA matching
 */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return "";

  let normalized = cleanText(text);
  
  // Apply synonyms
  for (const [original, replacement] of Object.entries(SYNONYMS)) {
    const regex = new RegExp(`\\b${original}\\b`, "gi");
    normalized = normalized.replace(regex, replacement);
  }
  
  // Apply team mappings
  for (const [original, shorthand] of Object.entries(TEAM_MAPPINGS)) {
    if (normalized.includes(original)) {
      normalized = shorthand;
      break;
    }
  }
  
  return normalized;
}

/**
 * Generate DNA profile from card data
 */
export function generateCardDNA(cardData: {
  player?: string;
  team?: string;
  year?: number | string;
  set?: string | { id?: string; name?: string; code?: string };
  cardNumber?: string;
  number?: string;
  brand?: string;
  sport?: string;
  name?: string;
  type?: string;
}): CardDNA {
  // Extract set name from object or string
  let setName: string | undefined;
  if (typeof cardData.set === "object" && cardData.set) {
    setName = cardData.set.name || cardData.set.id || cardData.set.code;
  } else if (typeof cardData.set === "string") {
    setName = cardData.set;
  }
  
  return {
    player: normalizeText(cardData.player),
    team: normalizeText(cardData.team),
    year: String(cardData.year || "").slice(0, 4),
    set: normalizeText(setName),
    number: cleanCardNumber(cardData.cardNumber || cardData.number),
    brand: normalizeText(cardData.brand),
    sport: normalizeText(cardData.sport),
    name: normalizeText(cardData.name),
    type: normalizeText(cardData.type),
  };
}

/**
 * Clean scan payload before any catalog search/matching.
 */
export function cleanScanInputForSearch(scanData: {
  player?: string;
  team?: string;
  year?: number | string;
  set?: string;
  cardNumber?: string;
  brand?: string;
  sport?: string;
  name?: string;
  type?: string;
}) {
  return {
    player: normalizeText(scanData.player),
    team: normalizeText(scanData.team),
    year: scanData.year ? parseInt(String(scanData.year).slice(0, 4), 10) : undefined,
    set: normalizeText(scanData.set),
    cardNumber: cleanCardNumber(scanData.cardNumber),
    brand: normalizeText(scanData.brand),
    sport: normalizeText(scanData.sport),
    name: normalizeText(scanData.name),
    type: normalizeText(scanData.type),
  };
}

/**
 * Score weights for different attributes
 */
const SCORE_WEIGHTS = {
  player: 40,
  name: 40,       // For non-sports cards
  year: 25,
  set: 20,
  number: 10,
  team: 5,
  brand: 5,
  sport: 3,
  type: 2,
};

/**
 * Calculate match score between scanned DNA and catalog DNA
 */
export function calculateDNAScore(
  scanDNA: CardDNA,
  catalogDNA: CardDNA
): {
  score: number;
  maxScore: number;
  breakdown: { [key: string]: number };
} {
  let score = 0;
  let maxScore = 0;
  const breakdown: { [key: string]: number } = {};
  
  // Player/Name matching (use whichever exists)
  const primaryField = scanDNA.player ? "player" : "name";
  if (scanDNA[primaryField] && catalogDNA[primaryField]) {
    maxScore += SCORE_WEIGHTS[primaryField];
    
    if (scanDNA[primaryField] === catalogDNA[primaryField]) {
      // Exact match
      score += SCORE_WEIGHTS[primaryField];
      breakdown[primaryField] = SCORE_WEIGHTS[primaryField];
    } else if (
      scanDNA[primaryField]!.includes(catalogDNA[primaryField]!) ||
      catalogDNA[primaryField]!.includes(scanDNA[primaryField]!)
    ) {
      // Partial match
      const partialScore = Math.floor(SCORE_WEIGHTS[primaryField] * 0.7);
      score += partialScore;
      breakdown[primaryField] = partialScore;
    }
  }
  
  // Year matching
  if (scanDNA.year && catalogDNA.year) {
    maxScore += SCORE_WEIGHTS.year;
    
    if (scanDNA.year === catalogDNA.year) {
      score += SCORE_WEIGHTS.year;
      breakdown.year = SCORE_WEIGHTS.year;
    }
  }
  
  // Set matching
  if (scanDNA.set && catalogDNA.set) {
    maxScore += SCORE_WEIGHTS.set;
    
    if (scanDNA.set === catalogDNA.set) {
      score += SCORE_WEIGHTS.set;
      breakdown.set = SCORE_WEIGHTS.set;
    } else if (
      scanDNA.set.includes(catalogDNA.set) ||
      catalogDNA.set.includes(scanDNA.set)
    ) {
      // Partial match (e.g., "topps chrome" contains "topps")
      const partialScore = Math.floor(SCORE_WEIGHTS.set * 0.75);
      score += partialScore;
      breakdown.set = partialScore;
    }
  }
  
  // Card number matching
  if (scanDNA.number && catalogDNA.number) {
    maxScore += SCORE_WEIGHTS.number;
    
    // Normalize numbers (remove leading zeros, handle suffixes)
    const scanNum = scanDNA.number.replace(/^0+/, "");
    const catalogNum = catalogDNA.number.replace(/^0+/, "");
    
    if (scanNum === catalogNum) {
      score += SCORE_WEIGHTS.number;
      breakdown.number = SCORE_WEIGHTS.number;
    } else if (scanNum.startsWith(catalogNum) || catalogNum.startsWith(scanNum)) {
      // Partial match (e.g., "138A" matches "138")
      score += Math.floor(SCORE_WEIGHTS.number * 0.5);
      breakdown.number = Math.floor(SCORE_WEIGHTS.number * 0.5);
    }
  }
  
  // Team matching
  if (scanDNA.team && catalogDNA.team) {
    maxScore += SCORE_WEIGHTS.team;
    
    if (scanDNA.team === catalogDNA.team) {
      score += SCORE_WEIGHTS.team;
      breakdown.team = SCORE_WEIGHTS.team;
    }
  }
  
  // Brand matching
  if (scanDNA.brand && catalogDNA.brand) {
    maxScore += SCORE_WEIGHTS.brand;
    
    if (scanDNA.brand === catalogDNA.brand) {
      score += SCORE_WEIGHTS.brand;
      breakdown.brand = SCORE_WEIGHTS.brand;
    }
  }
  
  // Sport matching
  if (scanDNA.sport && catalogDNA.sport) {
    maxScore += SCORE_WEIGHTS.sport;
    
    if (scanDNA.sport === catalogDNA.sport) {
      score += SCORE_WEIGHTS.sport;
      breakdown.sport = SCORE_WEIGHTS.sport;
    }
  }
  
  // Type matching (for TCG cards)
  if (scanDNA.type && catalogDNA.type) {
    maxScore += SCORE_WEIGHTS.type;
    
    if (scanDNA.type === catalogDNA.type) {
      score += SCORE_WEIGHTS.type;
      breakdown.type = SCORE_WEIGHTS.type;
    }
  }
  
  return {
    score,
    maxScore,
    breakdown,
  };
}

/**
 * Match scanned data against catalog
 * Returns top matches sorted by score
 */
export interface DNAMatch {
  stacktrackId: string;
  catalogId: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  confidence: "high" | "medium" | "low";
  breakdown: { [key: string]: number };
  cardData: any;
}

export function matchCardDNA(
  scanData: {
    player?: string;
    team?: string;
    year?: number | string;
    set?: string;
    cardNumber?: string;
    brand?: string;
    sport?: string;
    name?: string;
    type?: string;
  },
  catalogCards: any[]
): DNAMatch[] {
  // Generate scan DNA
  const scanDNA = generateCardDNA(scanData);
  
  // Score each catalog card
  const matches: DNAMatch[] = [];
  
  for (const card of catalogCards) {
    // Generate catalog DNA
    const catalogDNA: CardDNA = card.dna || generateCardDNA({
      player: card.player,
      team: card.team,
      year: card.year,
      set: card.set,
      cardNumber: card.cardNumber || card.number,
      brand: card.brand,
      sport: card.sport,
      name: card.name,
      type: card.type,
    });
    
    // Calculate score
    const { score, maxScore, breakdown } = calculateDNAScore(scanDNA, catalogDNA);
    
    if (score > 0) {
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      
      // Determine confidence level
      let confidence: "high" | "medium" | "low";
      if (percentage >= 80) confidence = "high";
      else if (percentage >= 60) confidence = "medium";
      else confidence = "low";
      
      matches.push({
        stacktrackId: card.stacktrackId || card.cardId || "",
        catalogId: card.catalogId || card.id,
        name: card.name,
        score,
        maxScore,
        percentage,
        confidence,
        breakdown,
        cardData: card,
      });
    }
  }
  
  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);
  
  return matches;
}

/**
 * Extract potential year from text
 */
export function extractYear(text: string): number | null {
  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

/**
 * Extract potential card number from text
 */
export function extractCardNumber(text: string): string | null {
  // Look for patterns like #138, 138/250, 138
  const patterns = [
    /#(\w+)/,           // #138
    /(\d+)\/\d+/,       // 138/250
    /\b(\d{1,4}[A-Z]?)\b/, // 138 or 138A
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Pre-filter catalog for faster DNA matching
 */
export function buildDNASearchQuery(scanData: {
  player?: string;
  year?: number | string;
  sport?: string;
  name?: string;
}): {
  searchTerms: string[];
  filters: { [key: string]: any };
} {
  const searchTerms: string[] = [];
  const filters: { [key: string]: any } = {};
  
  // Add normalized search terms
  if (scanData.player) {
    const normalized = normalizeText(scanData.player);
    searchTerms.push(...normalized.split(" ").filter(w => w.length > 2));
  }
  
  if (scanData.name) {
    const normalized = normalizeText(scanData.name);
    searchTerms.push(...normalized.split(" ").filter(w => w.length > 2));
  }
  
  // Add filters
  if (scanData.year) {
    filters.year = parseInt(String(scanData.year));
  }
  
  if (scanData.sport) {
    filters.sport = normalizeText(scanData.sport);
  }
  
  return {
    searchTerms: [...new Set(searchTerms)], // Remove duplicates
    filters,
  };
}

/**
 * Confidence thresholds for auto-matching
 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_MATCH: 95,   // Automatically use this match
  HIGH: 80,         // High confidence, show as top result
  MEDIUM: 60,       // Medium confidence, show as possible match
  LOW: 40,          // Low confidence, show in "other possibilities"
};

/**
 * Determine if a match should be automatically selected
 */
export function shouldAutoMatch(match: DNAMatch): boolean {
  return match.percentage >= CONFIDENCE_THRESHOLDS.AUTO_MATCH;
}

/**
 * Format DNA breakdown for display
 */
export function formatDNABreakdown(breakdown: { [key: string]: number }): string {
  return Object.entries(breakdown)
    .map(([field, score]) => `${field}: +${score}`)
    .join(", ");
}
