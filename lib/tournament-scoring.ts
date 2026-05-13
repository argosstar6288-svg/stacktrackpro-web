/**
 * Tournament Scoring Engine
 * Calculates scores for Value Sprint tournaments
 */

import { TournamentRules, ScoreBreakdown } from './tournament-types';
import { Timestamp } from 'firebase/firestore';

/**
 * Card data for scoring
 */
export interface CardForScoring {
  id: string;
  name: string;
  value: number; // USD market price
  rarity?: 'common' | 'uncommon' | 'rare' | 'legendary' | 'ultra_rare';
  addedAt: Timestamp | Date;
}

/**
 * Score calculation result
 */
export interface ScoreCalculation {
  totalScore: number;
  breakdown: ScoreBreakdown;
}

/**
 * Determine rarity level from card data
 * Conservative: only 'ultra_rare' cards get ultra bonus
 */
function getRarityLevel(rarity?: string): 'ultra_rare' | 'rare' | 'none' {
  if (!rarity) return 'none';
  
  const normalized = rarity.toLowerCase().trim();
  
  // Ultra rare: Legendary, Ultra Rare, PSA 10, etc.
  if (normalized.includes('legendary') || normalized.includes('ultra') || normalized.includes('psa 10')) {
    return 'ultra_rare';
  }
  
  // Rare: Rare, Secret Rare, etc.
  if (normalized.includes('rare') && !normalized.includes('ultra')) {
    return 'rare';
  }
  
  return 'none';
}

/**
 * Calculate rarity bonus based on card properties
 */
function calculateRarityBonus(card: CardForScoring, rules: TournamentRules['scoringConfig']): number {
  const rarity = getRarityLevel(card.rarity);
  
  switch (rarity) {
    case 'ultra_rare':
      return rules.rarityBonusUltraRare || 100;
    case 'rare':
      return rules.rarityBonusRare || 50;
    case 'none':
    default:
      return 0;
  }
}

/**
 * Calculate streak multiplier based on recent scan history
 * Assumes `recentScans` is an ordered array of card additions in the past 3 days
 */
function calculateStreakMultiplier(
  recentScans: CardForScoring[],
  rules: TournamentRules['scoringConfig']
): number {
  if (recentScans.length < 3) {
    return 1; // No multiplier with <3 scans
  }

  // Check if scans are on consecutive days (simple version)
  // A real implementation might look at the actual gaps
  const consecutiveDays = Math.floor(recentScans.length / 3);
  const multiplier = 1 + consecutiveDays * (rules.streakMultiplierPerThreeDays - 1);
  
  return Math.max(1, multiplier); // Never below 1
}

/**
 * Apply whale cap to prevent single large transactions from dominating
 */
function applyWhaleCap(
  baseScore: number,
  singleTransactionValue: number,
  rules: TournamentRules['scoringConfig']
): number {
  const maxPointsPerTransaction = rules.maxPointsPerTransaction || 500;
  
  if (singleTransactionValue > (rules.maxPointsPerTransaction / rules.pointsPerDollarGain)) {
    // This transaction would exceed the cap
    const cappedValue = maxPointsPerTransaction / rules.pointsPerDollarGain;
    const cappedPoints = cappedValue * rules.pointsPerDollarGain;
    return Math.min(baseScore, cappedPoints);
  }
  
  return baseScore;
}

/**
 * Calculate speed bonus for users who gain value early in tournament
 * Bonus applies if card was scanned before 50% of tournament elapsed
 */
function calculateSpeedBonus(
  card: CardForScoring,
  tournamentStartTime: Timestamp | Date,
  tournamentEndTime: Timestamp | Date,
  baseScore: number,
  rules: TournamentRules['scoringConfig']
): number {
  const start = tournamentStartTime instanceof Timestamp ? tournamentStartTime.toDate() : tournamentStartTime;
  const end = tournamentEndTime instanceof Timestamp ? tournamentEndTime.toDate() : tournamentEndTime;
  const cardTime = card.addedAt instanceof Timestamp ? card.addedAt.toDate() : card.addedAt;

  const totalDuration = end.getTime() - start.getTime();
  const elapsedByCard = cardTime.getTime() - start.getTime();
  const progressPercent = elapsedByCard / totalDuration;

  // Speed bonus: +10% if scanned in first 50% of tournament
  if (progressPercent < 0.5) {
    const bonusPercent = rules.speedBonusPercent || 0.1;
    return baseScore * bonusPercent;
  }

  return 0;
}

/**
 * Calculate score for a single new card
 * Called when a card is added to the user's collection during a tournament
 */
export function calculateCardScore(
  card: CardForScoring,
  tournamentStartTime: Timestamp | Date,
  tournamentEndTime: Timestamp | Date,
  rules: TournamentRules['scoringConfig'],
  previousCards?: CardForScoring[]
): ScoreCalculation {
  // Base score: $1 = 1 point
  const valueGain = card.value * rules.pointsPerDollarGain;

  // Rarity bonus
  const rarityBonus = calculateRarityBonus(card, rules);

  // Whale cap (if this single card's value is too high)
  const cappedValueScore = applyWhaleCap(valueGain, card.value, rules);

  // Base score before streak and speed
  const baseScore = cappedValueScore + rarityBonus;

  // Speed bonus
  const speedBonus = calculateSpeedBonus(card, tournamentStartTime, tournamentEndTime, baseScore, rules);

  // Streak multiplier (simplified: if adding many cards, apply multiplier)
  const streakMultiplier = previousCards
    ? calculateStreakMultiplier([...(previousCards || []), card], rules)
    : 1;

  // Final score
  const totalScore = (baseScore * streakMultiplier) + speedBonus;

  return {
    totalScore: Math.round(totalScore),
    breakdown: {
      valueGain: Math.round(cappedValueScore),
      rarityBonusPoints: rarityBonus,
      streakMultiplier: streakMultiplier,
      speedBonusPoints: Math.round(speedBonus),
      transactionCap: cappedValueScore === valueGain ? 0 : Math.round(valueGain - cappedValueScore),
    },
  };
}

/**
 * Recalculate total tournament score from all cards added during tournament
 * Used for score validation / rebuilding
 */
export function recalculateTournamentScore(
  cardsAddedDuringTournament: CardForScoring[],
  tournamentStartTime: Timestamp | Date,
  tournamentEndTime: Timestamp | Date,
  rules: TournamentRules['scoringConfig']
): ScoreCalculation {
  if (cardsAddedDuringTournament.length === 0) {
    return {
      totalScore: 0,
      breakdown: {
        valueGain: 0,
        rarityBonusPoints: 0,
        streakMultiplier: 1,
        speedBonusPoints: 0,
        transactionCap: 0,
      },
    };
  }

  // Sort cards by added time (oldest first) to process in order
  const sortedCards = [...cardsAddedDuringTournament].sort(
    (a, b) => {
      const aTime = a.addedAt instanceof Timestamp ? a.addedAt.toDate() : a.addedAt;
      const bTime = b.addedAt instanceof Timestamp ? b.addedAt.toDate() : b.addedAt;
      return aTime.getTime() - bTime.getTime();
    }
  );

  let totalScore = 0;
  let totalValueGain = 0;
  let totalRarityBonus = 0;
  let totalSpeedBonus = 0;
  let totalCapApplied = 0;

  // Process each card
  for (let i = 0; i < sortedCards.length; i++) {
    const card = sortedCards[i];
    const previousCards = sortedCards.slice(0, i);

    const cardScore = calculateCardScore(card, tournamentStartTime, tournamentEndTime, rules, previousCards);

    totalScore += cardScore.totalScore;
    totalValueGain += cardScore.breakdown.valueGain;
    totalRarityBonus += cardScore.breakdown.rarityBonusPoints;
    totalSpeedBonus += cardScore.breakdown.speedBonusPoints;
    totalCapApplied += cardScore.breakdown.transactionCap;
  }

  // Calculate average streak multiplier (approximation)
  const avgStreakMultiplier = sortedCards.length > 0
    ? 1 + Math.floor(sortedCards.length / 3) * 0.1
    : 1;

  return {
    totalScore: Math.round(totalScore),
    breakdown: {
      valueGain: Math.round(totalValueGain),
      rarityBonusPoints: totalRarityBonus,
      streakMultiplier: Number(avgStreakMultiplier.toFixed(2)),
      speedBonusPoints: Math.round(totalSpeedBonus),
      transactionCap: Math.round(totalCapApplied),
    },
  };
}

/**
 * Determine badges earned based on final tournament performance
 */
export function determineBadges(
  finalRank: number,
  totalEntries: number,
  scoreBreakdown: ScoreBreakdown,
  previousRankAtDay2?: number
): string[] {
  const badges: string[] = [];

  // Top 1% badge
  const topOnePercent = Math.max(1, Math.ceil(totalEntries * 0.01));
  if (finalRank <= topOnePercent) {
    badges.push('top_1_percent');
  }

  // Underdog badge: climbed 50+ spots in last 24h
  if (previousRankAtDay2 && finalRank < previousRankAtDay2 - 50) {
    badges.push('underdog');
  }

  // Streak master badge: high streak multiplier (>= 1.3)
  if (scoreBreakdown.streakMultiplier >= 1.3) {
    badges.push('streak_master');
  }

  return badges;
}

/**
 * Calculate prize distribution for a tournament
 */
export function calculatePrizeDistribution(
  totalPrizePoolCredits: number,
  winnerPercentages: { [rank: string]: number },
  finalScores: Array<{ userId: string; rank: number; score: number }>
) {
  const distribution: { [userId: string]: number } = {};

  finalScores.forEach(({ userId, rank }) => {
    // Find the applicable percentage bracket
    let percentAllocated = 0;

    for (const [rankRange, percent] of Object.entries(winnerPercentages)) {
      if (rankRange === '1' && rank === 1) {
        percentAllocated = percent;
        break;
      } else if (rankRange === '2' && rank === 2) {
        percentAllocated = percent;
        break;
      } else if (rankRange === '3' && rank === 3) {
        percentAllocated = percent;
        break;
      } else if (rankRange === '4-10' && rank >= 4 && rank <= 10) {
        percentAllocated = percent / 7; // Divided among 7 ranks
        break;
      }
    }

    distribution[userId] = Math.floor((totalPrizePoolCredits * percentAllocated) / 100);
  });

  return distribution;
}
