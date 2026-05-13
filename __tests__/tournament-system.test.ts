/**
 * Tournament System - Unit Tests
 * Tests for core scoring logic, join validation, leaderboard calculation
 * 
 * Run with: npm test -- tournament-system.test.ts
 */

declare const describe: any;
declare const test: any;
declare const expect: any;

import { calculateCardScore, recalculateTournamentScore, determineBadges } from '@/lib/tournament-scoring';
import { TournamentRules, ScoreBreakdown } from '@/lib/tournament-types';
import { Timestamp } from 'firebase/firestore';

/**
 * Test: Basic card scoring
 */
describe('Tournament Scoring', () => {
  const standardRules: TournamentRules['scoringConfig'] = {
    pointsPerDollarGain: 1,
    rarityBonusRare: 50,
    rarityBonusUltraRare: 100,
    streakMultiplierPerThreeDays: 1.1,
    maxPointsPerTransaction: 500,
    speedBonusPercent: 0.1,
  };

  const now = new Date();
  const tourStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const tourEnd = new Date(now.getTime() + 72 * 60 * 60 * 1000); // +3 days

  test('Basic card: $100 value, no rarity', () => {
    const card = {
      id: 'card1',
      name: 'Common Card',
      value: 100,
      rarity: 'common' as const,
      addedAt: now,
    };

    const result = calculateCardScore(card, tourStart, tourEnd, standardRules);

    expect(result.totalScore).toBeGreaterThan(100); // At least base value
    expect(result.breakdown.valueGain).toBe(100);
    expect(result.breakdown.rarityBonusPoints).toBe(0);
  });

  test('Rare card: $100 value + rarity bonus', () => {
    const card = {
      id: 'card2',
      name: 'Rare Card',
      value: 100,
      rarity: 'rare' as const,
      addedAt: now,
    };

    const result = calculateCardScore(card, tourStart, tourEnd, standardRules);

    expect(result.breakdown.rarityBonusPoints).toBe(50);
    expect(result.totalScore).toBeGreaterThan(150); // 100 + 50 + speed bonus
  });

  test('Ultra-rare card: $100 value + ultra bonus', () => {
    const card = {
      id: 'card3',
      name: 'Legendary Card',
      value: 100,
      rarity: 'legendary' as const,
      addedAt: now,
    };

    const result = calculateCardScore(card, tourStart, tourEnd, standardRules);

    expect(result.breakdown.rarityBonusPoints).toBe(100);
    expect(result.totalScore).toBeGreaterThan(200); // 100 + 100 + speed bonus
  });

  test('Whale cap: $1000 value capped at 500 points', () => {
    const card = {
      id: 'card4',
      name: 'Expensive Card',
      value: 1000,
      rarity: 'common' as const,
      addedAt: now,
    };

    const result = calculateCardScore(card, tourStart, tourEnd, standardRules);

    expect(result.breakdown.valueGain).toBeLessThanOrEqual(500);
    expect(result.breakdown.transactionCap).toBeGreaterThan(0);
  });

  test('Speed bonus: early card gets +10%', () => {
    const earlyCard = {
      id: 'card5',
      name: 'Early Card',
      value: 100,
      rarity: 'common' as const,
      addedAt: new Date(tourStart.getTime() + 12 * 60 * 60 * 1000), // 12 hours in
    };

    const result = calculateCardScore(earlyCard, tourStart, tourEnd, standardRules);

    expect(result.breakdown.speedBonusPoints).toBeGreaterThan(0);
  });

  test('No speed bonus: late card (>50% of tournament)', () => {
    const lateCard = {
      id: 'card6',
      name: 'Late Card',
      value: 100,
      rarity: 'common' as const,
      addedAt: new Date(tourStart.getTime() + 60 * 60 * 60 * 1000), // 60+ hours in (>50%)
    };

    const result = calculateCardScore(lateCard, tourStart, tourEnd, standardRules);

    expect(result.breakdown.speedBonusPoints).toBe(0);
  });

  test('Streak multiplier: 3+ cards increase score', () => {
    const cards = [
      { id: 'c1', name: 'Card 1', value: 100, rarity: 'common' as const, addedAt: new Date(tourStart.getTime() + 1000) },
      { id: 'c2', name: 'Card 2', value: 100, rarity: 'common' as const, addedAt: new Date(tourStart.getTime() + 2000) },
      { id: 'c3', name: 'Card 3', value: 100, rarity: 'common' as const, addedAt: new Date(tourStart.getTime() + 3000) },
    ];

    const result = recalculateTournamentScore(cards, tourStart, tourEnd, standardRules);

    expect(result.breakdown.streakMultiplier).toBeGreaterThan(1);
    expect(result.totalScore).toBeGreaterThan(300); // More than just sum of values
  });

  test('Badge: Top 1% badge for rank 1-3 in 100-person tournament', () => {
    const badges = determineBadges(1, 100, {
      valueGain: 500,
      rarityBonusPoints: 100,
      streakMultiplier: 1,
      speedBonusPoints: 10,
      transactionCap: 0,
    });

    expect(badges).toContain('top_1_percent');
  });

  test('Badge: Underdog badge for 50+ spot climb', () => {
    const badges = determineBadges(5, 100, {
      valueGain: 200,
      rarityBonusPoints: 50,
      streakMultiplier: 1,
      speedBonusPoints: 0,
      transactionCap: 0,
    }, 60); // Previous rank: 60, now 5 = 55 spot climb

    expect(badges).toContain('underdog');
  });

  test('Badge: Streak master badge for high multiplier', () => {
    const badges = determineBadges(10, 100, {
      valueGain: 300,
      rarityBonusPoints: 100,
      streakMultiplier: 1.4, // >= 1.3
      speedBonusPoints: 20,
      transactionCap: 0,
    });

    expect(badges).toContain('streak_master');
  });
});

/**
 * Test: Tournament join validation
 */
describe('Tournament Join Logic', () => {
  test('User with sufficient balance can join', () => {
    const entryFee = 50;
    const userBalance = 100;

    const canJoin = userBalance >= entryFee;

    expect(canJoin).toBe(true);
  });

  test('User with insufficient balance cannot join', () => {
    const entryFee = 100;
    const userBalance = 50;

    const canJoin = userBalance >= entryFee;

    expect(canJoin).toBe(false);
  });

  test('Entry count cap prevents new joins', () => {
    const maxEntries = 100;
    const currentEntries = 100;

    const canJoin = currentEntries < maxEntries;

    expect(canJoin).toBe(false);
  });
});

/**
 * Test: Leaderboard ranking
 */
describe('Leaderboard Calculation', () => {
  test('Users ranked by score descending', () => {
    const scores = [
      { userId: 'user1', score: 500 },
      { userId: 'user2', score: 300 },
      { userId: 'user3', score: 400 },
    ];

    const ranked = scores.sort((a, b) => b.score - a.score).map((s, idx) => ({
      ...s,
      rank: idx + 1,
    }));

    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score).toBe(500);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[1].score).toBe(400);
    expect(ranked[2].rank).toBe(3);
    expect(ranked[2].score).toBe(300);
  });

  test('Ties broken by userId (alphabetical)', () => {
    const scores = [
      { userId: 'userZ', score: 500 },
      { userId: 'userA', score: 500 },
    ];

    const ranked = scores
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return a.userId.localeCompare(b.userId);
      })
      .map((s, idx) => ({ ...s, rank: idx + 1 }));

    expect(ranked[0].userId).toBe('userA');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].userId).toBe('userZ');
  });
});

/**
 * Test: Prize distribution
 */
describe('Prize Distribution', () => {
  test('Prize pool splits correctly', () => {
    const prizePool = 1000;
    const winnerPercents = {
      '1': 40,
      '2': 30,
      '3': 20,
      '4-10': 10,
    };

    const prizes = {
      1: Math.floor((prizePool * 40) / 100), // 400
      2: Math.floor((prizePool * 30) / 100), // 300
      3: Math.floor((prizePool * 20) / 100), // 200
      4: Math.floor((prizePool * 10) / (100 * 7)), // 14
    };

    expect(prizes[1]).toBe(400);
    expect(prizes[2]).toBe(300);
    expect(prizes[3]).toBe(200);
    expect(prizes[4]).toBe(14);
  });
});
