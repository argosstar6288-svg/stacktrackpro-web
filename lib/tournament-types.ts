/**
 * Tournament Types & Interfaces
 * Comprehensive type definitions for the tournament system
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Tournament type enum
 */
export type TournamentType = 'value_sprint' | 'rarity_hunt' | 'bracket';
export type TournamentStatus = 'draft' | 'registration_open' | 'active' | 'completed' | 'cancelled';
export type EntryStatus = 'active' | 'completed' | 'disqualified';

/**
 * Main Tournament document
 * /tournaments/{tournamentId}
 */
export interface Tournament {
  id: string;
  type: TournamentType;
  name: string;
  description: string;
  status: TournamentStatus;

  // Schedule
  registrationOpensAt: Timestamp;
  registrationDeadline: Timestamp;
  startTime: Timestamp;
  endTime: Timestamp;

  // Entry & Participation
  entryFeeCredits: number;
  minEntries: number;
  maxEntries: number;
  currentEntryCount?: number;

  // Prize Pool
  prizePoolCredits: number; // Total credits to distribute
  platformCutPercent: number; // Typically 30%
  winnerPercents: {
    // e.g., { "1": 40, "2": 30, "3": 20, "4-10": 10 }
    [rank: string]: number;
  };

  // Rules (specific to tournament type)
  rules: TournamentRules;

  // Metadata
  createdBy: string; // Admin user ID
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Stats (optional, cached)
  totalEntriesReceived?: number;
  totalFeesCollected?: number;
  totalPaidOut?: number;
}

/**
 * Tournament-specific rules
 */
export interface TournamentRules {
  scoringConfig: {
    // Value Sprint rules
    pointsPerDollarGain: number; // Usually 1
    rarityBonusRare: number; // Usually 50
    rarityBonusUltraRare: number; // Usually 100
    streakMultiplierPerThreeDays: number; // Usually 1.1
    maxPointsPerTransaction: number; // Whale cap, e.g., 500
    speedBonusPercent: number; // % bonus for top gainers before day 2, e.g., 10
  };
  antiCheatRules: {
    ignoreDuplicateScans: boolean; // Prevent same card scored twice
    requireMinimumValueChange: number; // Min USD change to count, e.g., $1
    enforceAccountAgeMinDays: number; // New accounts can't participate, e.g., 7
  };
}

/**
 * Tournament Entry document
 * /tournaments/{tournamentId}/entries/{entryId}
 * Also stored at: /tournament_entries/{tournamentId}/{entryId}
 */
export interface TournamentEntry {
  id: string;
  tournamentId: string;
  userId: string;
  displayName: string;
  email?: string;
  photoUrl?: string;

  // Status
  status: EntryStatus;

  // Entry verification
  entryFeeCharged: number;
  entryChargeTransactionId?: string;
  joinedAt: Timestamp;

  // Baseline snapshot (for % growth calculation)
  baselineCollectionValue: number; // Total collection value at entry time
  baselineCardCount: number;

  // Anti-cheat tracking
  scannedCardIds: Set<string>; // Track duplicates
  lastScanTimestamp?: Timestamp;
  scansInLastThreeDays?: number; // For streak calculation

  // Metadata
  disqualifiedAt?: Timestamp;
  disqualificationReason?: string;
}

/**
 * Tournament Score document
 * /tournament_scores/{tournamentId}/{userId}
 * Real-time scoring, updated on card scan
 */
export interface TournamentScore {
  id: string; // Composite: `${tournamentId}_${userId}`
  tournamentId: string;
  userId: string;
  displayName: string;
  photoUrl?: string;

  // Score breakdown
  totalScore: number;
  breakdown: ScoreBreakdown;

  // Ranking (cached, updated on leaderboard query)
  currentRank?: number;
  previousRank?: number;
  rankChange?: number; // For UI animation

  // Metadata
  lastScoreUpdateAt: Timestamp;
  scoreSnapshots?: ScoreSnapshot[]; // Keep last 5 for history
}

export interface ScoreBreakdown {
  valueGain: number; // $ increase in collection value
  rarityBonusPoints: number; // From rare/ultra-rare cards
  streakMultiplier: number; // 1 + (0.1 * floor(streakDays / 3))
  speedBonusPoints: number; // Bonus for early movers
  transactionCap: number; // Applied whale cap
}

export interface ScoreSnapshot {
  score: number;
  rank: number;
  timestamp: Timestamp;
}

/**
 * Tournament Reward document
 * /tournament_rewards/{tournamentId}/{userId}
 * Created after tournament ends, tracks payout
 */
export interface TournamentReward {
  id: string; // Composite: `${tournamentId}_${userId}`
  tournamentId: string;
  userId: string;
  displayName: string;

  // Final placement
  finalRank: number;
  finalScore: number;

  // Reward details
  creditsWon: number;
  badgesEarned: TournamentBadge[];
  shareableLink: string;

  // Claim status
  claimedAt?: Timestamp;
  claimTransactionId?: string;
  creditsTxId?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TournamentBadge = 'top_1_percent' | 'underdog' | 'streak_master' | 'first_tournament';

/**
 * Leaderboard entry (for API response)
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  photoUrl?: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  rankChange?: number; // For animation
  badges?: TournamentBadge[];
  isCurrentUser?: boolean;
}

/**
 * Leaderboard response
 */
export interface LeaderboardResponse {
  tournamentId: string;
  totalEntries: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  entries: LeaderboardEntry[];
  userEntry?: LeaderboardEntry; // Current user's entry if not in top page
  lastUpdated: Timestamp;
}

/**
 * Tournament join request payload
 */
export interface JoinTournamentRequest {
  tournamentId: string;
  userId: string;
  displayName: string;
  email: string;
  photoUrl?: string;
}

/**
 * Tournament join response
 */
export interface JoinTournamentResponse {
  success: boolean;
  entryId?: string;
  error?: string;
  message?: string;
}

/**
 * Claim reward request
 */
export interface ClaimRewardRequest {
  tournamentId: string;
  userId: string;
  rewardId: string;
}

/**
 * Claim reward response
 */
export interface ClaimRewardResponse {
  success: boolean;
  creditsAdded?: number;
  newBalance?: number;
  badges?: TournamentBadge[];
  error?: string;
}

/**
 * Tournament list filters
 */
export interface TournamentListFilters {
  status?: TournamentStatus | TournamentStatus[];
  type?: TournamentType;
  sortBy?: 'startTime' | 'entryDeadline' | 'prizePool';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Score update event (fired by Cloud Function on card scan)
 */
export interface ScoreUpdateEvent {
  tournamentId: string;
  userId: string;
  displayName: string;
  cardId: string;
  cardName: string;
  cardValue: number; // USD
  cardRarity?: 'common' | 'uncommon' | 'rare' | 'legendary' | 'ultra_rare';
  timestamp: Timestamp;
  action: 'card_scanned';
}
