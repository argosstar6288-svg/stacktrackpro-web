/**
 * Premium AI Card Scan Logic
 * 
 * Handles both free and premium scans with credit deduction
 */

'use server';

import { deductCredits, CREDIT_COSTS } from './credits';

/**
 * Basic card scan data (free tier)
 */
export interface BasicScanData {
  cardName: string;
  cardSet: string;
  cardYear: number;
  cardNumber?: string;
  playerName?: string;
}

/**
 * Premium scan data (paid tier - 1 credit)
 */
export interface PremiumScanData extends BasicScanData {
  estimatedRawValue: number;
  psaGradeEstimate: {
    low: number;
    high: number;
  };
  recentSaleAverages: {
    psa8: number;
    psa9: number;
    psa10: number;
  };
  rarityLevel: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'extremely_rare';
  populationInsight?: {
    totalGraded: number;
    psa10Count: number;
  };
  conditionGuidance: string;
}

/**
 * Run premium AI scan on a card
 * ALWAYS deducts credit BEFORE running to prevent abuse
 * 
 * @param userId - User's UID
 * @param cardImageUrl - URL of the card image
 * @param cardId - Optional card ID for logging
 * @returns Premium scan data or error
 */
export async function runPremiumScan(
  userId: string,
  cardImageUrl: string,
  cardId?: string
): Promise<{
  success: boolean;
  data?: PremiumScanData;
  error?: string;
  remainingCredits?: number;
}> {
  try {
    // DEDUCT CREDIT FIRST (before running any AI)
    const deductResult = await deductCredits(
      userId,
      CREDIT_COSTS.PREMIUM_SCAN,
      'premium_scan',
      {
        cardId,
        cardImageUrl,
      }
    );

    if (!deductResult.success) {
      return {
        success: false,
        error: deductResult.error,
        remainingCredits: deductResult.remainingCredits,
      };
    }

    // Now run the premium scan
    // TODO: Replace with actual AI scan implementation
    const premiumData = await callPremiumAIScan(cardImageUrl);

    return {
      success: true,
      data: premiumData,
      remainingCredits: deductResult.remainingCredits,
    };
  } catch (error) {
    console.error('Error running premium scan:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Premium scan failed',
    };
  }
}

/**
 * Run free basic scan on a card
 * No credit deduction
 * 
 * @param cardImageUrl - URL of the card image
 * @returns Basic scan data or error
 */
export async function runBasicScan(
  cardImageUrl: string
): Promise<{
  success: boolean;
  data?: BasicScanData;
  error?: string;
}> {
  try {
    // TODO: Replace with actual AI scan implementation
    const basicData = await callBasicAIScan(cardImageUrl);

    return {
      success: true,
      data: basicData,
    };
  } catch (error) {
    console.error('Error running basic scan:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Basic scan failed',
    };
  }
}

/**
 * PLACEHOLDER: Call actual Premium AI scan endpoint
 * Replace with your actual AI/ML implementation
 */
async function callPremiumAIScan(cardImageUrl: string): Promise<PremiumScanData> {
  // TODO: Replace with actual API call to AI service
  // Example using Claude vision or similar

  // Simulated response for development
  return {
    cardName: 'Charizard ex',
    cardSet: 'Scarlet & Violet',
    cardYear: 2023,
    cardNumber: '384/367',
    playerName: 'Charizard',
    estimatedRawValue: 45.0,
    psaGradeEstimate: {
      low: 7,
      high: 9,
    },
    recentSaleAverages: {
      psa8: 35.0,
      psa9: 85.0,
      psa10: 285.0,
    },
    rarityLevel: 'very_rare',
    populationInsight: {
      totalGraded: 1250,
      psa10Count: 45,
    },
    conditionGuidance:
      'Light wear on edges. Minor centering issues visible but not severe. Could potentially grade PSA 8-9 depending on back condition.',
  };
}

/**
 * PLACEHOLDER: Call actual Basic AI scan endpoint
 * Replace with your actual AI/ML implementation
 */
async function callBasicAIScan(cardImageUrl: string): Promise<BasicScanData> {
  // TODO: Replace with actual API call to AI service

  // Simulated response for development
  return {
    cardName: 'Charizard ex',
    cardSet: 'Scarlet & Violet',
    cardYear: 2023,
    cardNumber: '384/367',
    playerName: 'Charizard',
  };
}

/**
 * Validate image before processing
 * Prevents abuse of scan feature
 * 
 * @param imageUrl - URL to validate
 * @returns { valid: boolean; error?: string }
 */
export async function validateCardImage(imageUrl: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    // Check if URL is valid format
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return { valid: false, error: 'Invalid image URL' };
    }

    // Could add additional checks like:
    // - Image size
    // - File type
    // - Duplicate detection
    // - NSFW filtering

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Image validation failed',
    };
  }
}

/**
 * Daily scan rate limiting
 * Prevent abuse with rapid-fire scans
 */
export const SCAN_RATE_LIMITS = {
  FREE_SCANS_PER_DAY: 5, // Free users get 5 basic scans/day
  PREMIUM_SCANS_PER_DAY: 50, // Paying users can do 50/day
} as const;

/**
 * Check if user has exceeded daily scan limit
 * 
 * @param userId - User's UID
 * @param isPremium - Whether this is a premium scan attempt
 * @returns { withinLimit: boolean; scansUsedToday: number; limit: number; error?: string }
 */
export async function checkScanRateLimit(
  userId: string,
  isPremium: boolean
): Promise<{
  withinLimit: boolean;
  scansUsedToday: number;
  limit: number;
  error?: string;
}> {
  try {
    // TODO: Implement actual rate limiting logic
    // Query creditTransactions/scanTransactions for today's count
    // Return withinLimit based on SCAN_RATE_LIMITS

    // Placeholder implementation
    return {
      withinLimit: true,
      scansUsedToday: 0,
      limit: isPremium
        ? SCAN_RATE_LIMITS.PREMIUM_SCANS_PER_DAY
        : SCAN_RATE_LIMITS.FREE_SCANS_PER_DAY,
    };
  } catch (error) {
    console.error('Error checking scan rate limit:', error);
    return {
      withinLimit: false,
      scansUsedToday: 0,
      limit: isPremium
        ? SCAN_RATE_LIMITS.PREMIUM_SCANS_PER_DAY
        : SCAN_RATE_LIMITS.FREE_SCANS_PER_DAY,
      error: error instanceof Error ? error.message : 'Rate limit check failed',
    };
  }
}
