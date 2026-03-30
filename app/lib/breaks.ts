export type BreakType = "team" | "random" | "pyt" | "hit-draft";
export type BreakStatus = "filling" | "ready" | "live" | "completed" | "cancelled";

export type BreakSpot = {
  spotNumber: number;
  label: string;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  paid: boolean;
  paidAt?: string;
};

export type BreakHit = {
  id: string;
  createdAt: string;
  cardName: string;
  player: string;
  team: string;
  setName: string;
  imageUrl?: string;
  estimatedValue: number;
  assignedSpotNumber: number;
  assignedUserId: string;
  assignedUserName: string;
};

export type BreakRecord = {
  id: string;
  title: string;
  productName: string;
  breakType: BreakType;
  spotCount: number;
  spotPrice: number;
  sellerId: string;
  sellerName: string;
  scheduledAt: string;
  shippingRules?: string;
  minFillRequirement: number;
  status: BreakStatus;
  spots: BreakSpot[];
  hits: BreakHit[];
  createdAt?: string;
  updatedAt?: string;
};

const MLB_TEAMS = [
  "Arizona Diamondbacks",
  "Atlanta Braves",
  "Baltimore Orioles",
  "Boston Red Sox",
  "Chicago Cubs",
  "Chicago White Sox",
  "Cincinnati Reds",
  "Cleveland Guardians",
  "Colorado Rockies",
  "Detroit Tigers",
  "Houston Astros",
  "Kansas City Royals",
  "Los Angeles Angels",
  "Los Angeles Dodgers",
  "Miami Marlins",
  "Milwaukee Brewers",
  "Minnesota Twins",
  "New York Mets",
  "New York Yankees",
  "Oakland Athletics",
  "Philadelphia Phillies",
  "Pittsburgh Pirates",
  "San Diego Padres",
  "San Francisco Giants",
  "Seattle Mariners",
  "St. Louis Cardinals",
  "Tampa Bay Rays",
  "Texas Rangers",
  "Toronto Blue Jays",
  "Washington Nationals",
];

export function buildInitialSpots(spotCount: number, breakType: BreakType): BreakSpot[] {
  const safeSpotCount = Math.max(1, Math.min(100, Number(spotCount || 1)));

  return Array.from({ length: safeSpotCount }, (_, index) => {
    const spotNumber = index + 1;
    const teamLabel = MLB_TEAMS[index] || `Team ${spotNumber}`;

    let label = `Spot ${spotNumber}`;
    if (breakType === "team" || breakType === "pyt") label = teamLabel;

    return {
      spotNumber,
      label,
      ownerUserId: null,
      ownerDisplayName: null,
      paid: false,
    };
  });
}

export function getFillStats(spots: BreakSpot[]) {
  const filled = spots.filter((spot) => Boolean(spot.ownerUserId)).length;
  const total = spots.length;
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent, open: Math.max(0, total - filled) };
}

export function nextOpenSpot(spots: BreakSpot[]) {
  return spots.find((spot) => !spot.ownerUserId) || null;
}
