export type RarityTier = "Ultra Rare" | "Rare" | "Common";

export interface PriceIntelligenceInput {
  currentPrice: number;
  populationCount?: number;
  supplyCount?: number;
  rarityHint?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function detectRarityTier(
  populationCount?: number,
  supplyCount?: number,
  rarityHint?: string
): RarityTier {
  const normalizedHint = String(rarityHint || "").toLowerCase();

  if (
    normalizedHint.includes("legendary") ||
    normalizedHint.includes("ultra") ||
    normalizedHint.includes("secret")
  ) {
    return "Ultra Rare";
  }

  if (typeof populationCount === "number" && populationCount > 0) {
    if (populationCount <= 100) return "Ultra Rare";
    if (populationCount <= 1500) return "Rare";
    return "Common";
  }

  if (typeof supplyCount === "number" && supplyCount > 0) {
    if (supplyCount <= 1000) return "Ultra Rare";
    if (supplyCount <= 15000) return "Rare";
    return "Common";
  }

  if (normalizedHint.includes("rare")) {
    return "Rare";
  }

  return "Common";
}

export function predict30DayValue(input: PriceIntelligenceInput): number {
  const safePrice = Number.isFinite(input.currentPrice) && input.currentPrice > 0
    ? input.currentPrice
    : 0;

  if (safePrice <= 0) return 0;

  const rarityTier = detectRarityTier(
    input.populationCount,
    input.supplyCount,
    input.rarityHint
  );

  const rarityGrowthByTier: Record<RarityTier, number> = {
    "Ultra Rare": 0.12,
    Rare: 0.07,
    Common: 0.02,
  };

  const baseMonthlyGrowth = rarityGrowthByTier[rarityTier] / 12;

  let scarcityBoost = 0;
  if (typeof input.populationCount === "number" && input.populationCount > 0) {
    scarcityBoost += clamp((500 - input.populationCount) / 5000, -0.01, 0.03);
  }
  if (typeof input.supplyCount === "number" && input.supplyCount > 0) {
    scarcityBoost += clamp((10000 - input.supplyCount) / 100000, -0.01, 0.03);
  }

  const projected = safePrice * (1 + baseMonthlyGrowth + scarcityBoost);
  return Math.max(0, Math.round(projected * 100) / 100);
}

export function buildPriceIntelligence(input: PriceIntelligenceInput) {
  const rarityTier = detectRarityTier(
    input.populationCount,
    input.supplyCount,
    input.rarityHint
  );

  return {
    rarityTier,
    predicted30DayValue: predict30DayValue(input),
  };
}
