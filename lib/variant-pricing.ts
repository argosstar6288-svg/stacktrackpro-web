/**
 * Variant-specific pricing utilities
 * Helps get accurate market prices based on card variants (holo, reverse holo, etc.)
 */

import type { CatalogCard } from "./catalog";

/**
 * Get the most accurate price for a card based on its variant
 */
export function getPriceForVariant(
  card: CatalogCard,
  variant?: "normal" | "holofoil" | "reverse-holo" | "first-edition" | "shadowless"
): number {
  // If no pricing data, return 0
  if (!card.pricing) return 0;

  // If variant-specific pricing exists, use it
  if (card.pricing.variants) {
    switch (variant) {
      case "holofoil":
        return card.pricing.variants.holofoil || card.pricing.market;
      case "reverse-holo":
        return card.pricing.variants.reverseHolofoil || card.pricing.market;
      case "first-edition":
        // First edition typically commands 2-5x premium
        return card.pricing.variants.firstEdition || card.pricing.market * 3;
      case "shadowless":
        // Shadowless typically commands 3-10x premium for Pokemon Base Set
        return card.pricing.variants.shadowless || card.pricing.market * 5;
      case "normal":
      default:
        return card.pricing.variants.normal || card.pricing.market;
    }
  }

  // Fallback to base market price
  return card.pricing.market;
}

/**
 * Get all available variant prices for a card
 */
export function getAllVariantPrices(card: CatalogCard): {
  variant: string;
  price: number;
  available: boolean;
}[] {
  if (!card.pricing) {
    return [];
  }

  const variants: { variant: string; price: number; available: boolean }[] = [];

  // Normal variant
  variants.push({
    variant: "Normal",
    price: card.pricing.variants?.normal || card.pricing.market,
    available: !!card.pricing.variants?.normal,
  });

  // Holofoil variant
  if (card.pricing.variants?.holofoil) {
    variants.push({
      variant: "Holofoil",
      price: card.pricing.variants.holofoil,
      available: true,
    });
  }

  // Reverse Holo variant
  if (card.pricing.variants?.reverseHolofoil) {
    variants.push({
      variant: "Reverse Holo",
      price: card.pricing.variants.reverseHolofoil,
      available: true,
    });
  }

  // First Edition variant
  if (card.pricing.variants?.firstEdition) {
    variants.push({
      variant: "First Edition",
      price: card.pricing.variants.firstEdition,
      available: true,
    });
  }

  // Shadowless variant
  if (card.pricing.variants?.shadowless) {
    variants.push({
      variant: "Shadowless",
      price: card.pricing.variants.shadowless,
      available: true,
    });
  }

  return variants;
}

/**
 * Calculate price multiplier for variant vs normal
 */
export function getVariantPriceMultiplier(
  card: CatalogCard,
  variant?: "normal" | "holofoil" | "reverse-holo" | "first-edition" | "shadowless"
): number {
  const normalPrice = card.pricing?.variants?.normal || card.pricing?.market || 0;
  if (normalPrice === 0) return 1;

  const variantPrice = getPriceForVariant(card, variant);
  return variantPrice / normalPrice;
}

/**
 * Format variant for display
 */
export function formatVariant(variant?: string): string {
  if (!variant) return "Normal";
  
  switch (variant.toLowerCase()) {
    case "holofoil":
    case "holo":
      return "Holofoil";
    case "reverse-holo":
    case "reverseholofoil":
      return "Reverse Holo";
    case "first-edition":
    case "1st-edition":
      return "1st Edition";
    case "shadowless":
      return "Shadowless";
    case "normal":
    default:
      return "Normal";
  }
}

/**
 * Estimate price adjustment for different variants
 * Used when variant-specific pricing is not available
 */
export function estimateVariantPriceAdjustment(
  basePrice: number,
  variant?: "normal" | "holofoil" | "reverse-holo" | "first-edition" | "shadowless",
  rarity?: string
): number {
  if (!variant || variant === "normal") {
    return basePrice;
  }

  // Rarity affects the multiplier
  const isRare = rarity?.toLowerCase().includes("rare") || 
                 rarity?.toLowerCase().includes("ultra") ||
                 rarity?.toLowerCase().includes("secret");

  switch (variant) {
    case "holofoil":
      // Holo variants typically 1.5-3x more valuable
      return basePrice * (isRare ? 2.5 : 1.8);
    
    case "reverse-holo":
      // Reverse holo typically 1.2-2x more valuable
      return basePrice * (isRare ? 1.8 : 1.4);
    
    case "first-edition":
      // First edition typically 3-5x more valuable
      return basePrice * (isRare ? 5 : 3);
    
    case "shadowless":
      // Shadowless (Pokemon Base Set) typically 5-10x more valuable
      return basePrice * (isRare ? 8 : 5);
    
    default:
      return basePrice;
  }
}
