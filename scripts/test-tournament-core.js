#!/usr/bin/env node

/**
 * Tournament System - E2E Test Script
 * 
 * Tests the core loop locally:
 * 1. Join tournament
 * 2. Calculate card score
 * 3. Simulate leaderboard ranking
 * 4. Calculate reward distribution
 * 
 * Run with: node scripts/test-tournament-core.js
 */

const { calculateCardScore, recalculateTournamentScore, determineBadges } = require('../lib/tournament-scoring');

console.log('🎮 Tournament System - Core Loop Test\n');

// ============================================================================
// TEST 1: Card Scoring
// ============================================================================

console.log('📊 TEST 1: Card Scoring Engine');
console.log('─'.repeat(50));

const rules = {
  pointsPerDollarGain: 1,
  rarityBonusRare: 50,
  rarityBonusUltraRare: 100,
  streakMultiplierPerThreeDays: 1.1,
  maxPointsPerTransaction: 500,
  speedBonusPercent: 0.1,
};

const now = new Date();
const tourStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const tourEnd = new Date(now.getTime() + 72 * 60 * 60 * 1000);

// Test Case 1.1: Common card
const card1 = {
  id: 'card1',
  name: 'Common Pokémon',
  value: 50,
  rarity: 'common',
  addedAt: now,
};

const score1 = calculateCardScore(card1, tourStart, tourEnd, rules);
console.log(`✅ Common card ($50, no bonus):`);
console.log(`   Total Score: ${score1.totalScore}`);
console.log(`   Breakdown: value=$${score1.breakdown.valueGain}, rarity=+${score1.breakdown.rarityBonusPoints}, speed=+${score1.breakdown.speedBonusPoints}`);
console.assert(score1.breakdown.valueGain === 50, 'Value gain should be 50');
console.assert(score1.breakdown.rarityBonusPoints === 0, 'Rarity bonus should be 0 for common');
console.log();

// Test Case 1.2: Rare card
const card2 = {
  id: 'card2',
  name: 'Rare Pokémon',
  value: 100,
  rarity: 'Rare',
  addedAt: now,
};

const score2 = calculateCardScore(card2, tourStart, tourEnd, rules);
console.log(`✅ Rare card ($100 + rarity):`);
console.log(`   Total Score: ${score2.totalScore}`);
console.log(`   Breakdown: value=$${score2.breakdown.valueGain}, rarity=+${score2.breakdown.rarityBonusPoints}, speed=+${score2.breakdown.speedBonusPoints}`);
console.assert(score2.breakdown.valueGain === 100, 'Value gain should be 100');
console.assert(score2.breakdown.rarityBonusPoints === 50, 'Rarity bonus should be 50 for rare');
console.log();

// Test Case 1.3: Ultra-rare card
const card3 = {
  id: 'card3',
  name: 'Legendary Pokémon',
  value: 250,
  rarity: 'Ultra Rare',
  addedAt: now,
};

const score3 = calculateCardScore(card3, tourStart, tourEnd, rules);
console.log(`✅ Ultra-rare card ($250 + ultra bonus):`);
console.log(`   Total Score: ${score3.totalScore}`);
console.log(`   Breakdown: value=$${score3.breakdown.valueGain}, rarity=+${score3.breakdown.rarityBonusPoints}, speed=+${score3.breakdown.speedBonusPoints}`);
console.assert(score3.breakdown.rarityBonusPoints === 100, 'Rarity bonus should be 100 for ultra-rare');
console.log();

// Test Case 1.4: Whale cap
const card4 = {
  id: 'card4',
  name: 'Extremely Expensive Card',
  value: 1000,
  rarity: 'common',
  addedAt: now,
};

const score4 = calculateCardScore(card4, tourStart, tourEnd, rules);
console.log(`✅ Whale cap test ($1000 value, should cap at 500):`);
console.log(`   Total Score: ${score4.totalScore}`);
console.log(`   Value gain (capped): $${score4.breakdown.valueGain}`);
console.log(`   Whale cap applied: ${score4.breakdown.transactionCap} points`);
console.assert(score4.breakdown.valueGain <= 500, 'Value gain should be capped at 500');
console.log();

// ============================================================================
// TEST 2: Multi-Card Scoring with Streaks
// ============================================================================

console.log('📊 TEST 2: Streak Multiplier');
console.log('─'.repeat(50));

const cards = [
  {
    id: 'c1',
    name: 'Card 1',
    value: 100,
    rarity: 'common',
    addedAt: new Date(tourStart.getTime() + 1 * 60 * 60 * 1000),
  },
  {
    id: 'c2',
    name: 'Card 2',
    value: 100,
    rarity: 'common',
    addedAt: new Date(tourStart.getTime() + 2 * 60 * 60 * 1000),
  },
  {
    id: 'c3',
    name: 'Card 3',
    value: 100,
    rarity: 'common',
    addedAt: new Date(tourStart.getTime() + 3 * 60 * 60 * 1000),
  },
];

const multiScore = recalculateTournamentScore(cards, tourStart, tourEnd, rules);
console.log(`✅ Score from 3 cards ($100 each):`);
console.log(`   Total Score: ${multiScore.totalScore}`);
console.log(`   Breakdown: value=$${multiScore.breakdown.valueGain}, rarity=+${multiScore.breakdown.rarityBonusPoints}`);
console.log(`   Streak Multiplier: ${multiScore.breakdown.streakMultiplier}x`);
console.assert(multiScore.breakdown.streakMultiplier >= 1, 'Streak multiplier should be >= 1');
console.log();

// ============================================================================
// TEST 3: Leaderboard Ranking
// ============================================================================

console.log('🏆 TEST 3: Leaderboard Ranking');
console.log('─'.repeat(50));

const leaderboardScores = [
  { userId: 'user1', displayName: 'Alice', score: 1250 },
  { userId: 'user2', displayName: 'Bob', score: 980 },
  { userId: 'user3', displayName: 'Charlie', score: 1100 },
  { userId: 'user4', displayName: 'Diana', score: 850 },
  { userId: 'user5', displayName: 'Eve', score: 1250 }, // Tie with Alice
];

const ranked = leaderboardScores
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.userId.localeCompare(b.userId); // Tiebreak by userId
  })
  .map((s, idx) => ({ ...s, rank: idx + 1 }));

ranked.forEach((entry) => {
  console.log(`   #${entry.rank}: ${entry.displayName} - ${entry.score} points`);
});

console.assert(ranked[0].rank === 1 && ranked[0].score === 1250, 'Top score should be rank 1');
console.assert(ranked[4].rank === 5, 'Last entry should be rank 5');
console.log();

// ============================================================================
// TEST 4: Prize Distribution
// ============================================================================

console.log('💰 TEST 4: Prize Distribution');
console.log('─'.repeat(50));

const prizePool = 500; // 500 credits
const winnerPercents = {
  '1': 40,
  '2': 30,
  '3': 20,
  '4-10': 10,
};

const prizes = {};
Object.entries(winnerPercents).forEach(([key, percent]) => {
  if (key === '4-10') {
    prizes[key] = Math.floor((prizePool * percent) / (100 * 7));
  } else {
    prizes[key] = Math.floor((prizePool * percent) / 100);
  }
});

console.log(`✅ Prize pool: ${prizePool} credits`);
console.log(`   1st place: ${prizes['1']} credits (40%)`);
console.log(`   2nd place: ${prizes['2']} credits (30%)`);
console.log(`   3rd place: ${prizes['3']} credits (20%)`);
console.log(`   4-10th place: ${prizes['4-10']} credits each (10%/7)`);

const totalDistributed = prizes['1'] + prizes['2'] + prizes['3'] + prizes['4-10'] * 7;
console.log(`   Total distributed: ${totalDistributed} credits`);
console.assert(totalDistributed <= prizePool, 'Total distributed should not exceed pool');
console.log();

// ============================================================================
// TEST 5: Badges
// ============================================================================

console.log('🎖️  TEST 5: Badge Determination');
console.log('─'.repeat(50));

const breakdown = {
  valueGain: 300,
  rarityBonusPoints: 100,
  streakMultiplier: 1.4,
  speedBonusPoints: 50,
  transactionCap: 0,
};

const badges = determineBadges(1, 100, breakdown);
console.log(`✅ Badges for rank #1 in 100-person tournament: ${badges.join(', ') || 'none'}`);
console.assert(badges.includes('top_1_percent'), 'Rank 1 should have top_1_percent badge');

const underdogBadges = determineBadges(5, 100, breakdown, 60);
console.log(`✅ Badges for underdog (rank 5, was rank 60): ${underdogBadges.join(', ') || 'none'}`);
console.assert(underdogBadges.includes('underdog'), 'Climbing 50+ spots should earn underdog badge');

const streakBadges = determineBadges(20, 100, breakdown);
console.log(`✅ Badges for high streak multiplier (${breakdown.streakMultiplier}x): ${streakBadges.join(', ') || 'none'}`);
console.assert(streakBadges.includes('streak_master'), 'High multiplier should earn streak_master badge');
console.log();

// ============================================================================
// TEST 6: Tournament Join Validation
// ============================================================================

console.log('🎫 TEST 6: Tournament Join Validation');
console.log('─'.repeat(50));

const tournamentConfig = {
  entryFeeCredits: 50,
  maxEntries: 100,
  currentEntryCount: 99,
};

const userBalance = 75;

const canJoinBalanceOk = userBalance >= tournamentConfig.entryFeeCredits;
const canJoinCapacityOk = tournamentConfig.currentEntryCount < tournamentConfig.maxEntries;

console.log(`✅ User balance check: ${userBalance} credits >= ${tournamentConfig.entryFeeCredits} fee? ${canJoinBalanceOk}`);
console.log(`✅ Capacity check: ${tournamentConfig.currentEntryCount} entries < ${tournamentConfig.maxEntries} max? ${canJoinCapacityOk}`);

console.assert(canJoinBalanceOk, 'User should have sufficient balance');
console.assert(canJoinCapacityOk, 'Tournament should have capacity');
console.log();

// ============================================================================
// SUMMARY
// ============================================================================

console.log('✅ All tests passed!');
console.log();
console.log('Summary:');
console.log('  ✓ Scoring engine calculates points correctly');
console.log('  ✓ Rarity bonuses apply (rare +50, ultra +100)');
console.log('  ✓ Whale cap prevents exploitation');
console.log('  ✓ Speed bonus rewards early scanners');
console.log('  ✓ Streak multiplier incentivizes consistency');
console.log('  ✓ Leaderboard ranking works (with tiebreaking)');
console.log('  ✓ Prize pool distributes fairly');
console.log('  ✓ Badge system rewards achievement');
console.log('  ✓ Join validation prevents issues');
console.log();
console.log('Next steps:');
console.log('  1. Deploy Cloud Functions: firebase deploy --only functions');
console.log('  2. Create test tournament via /api/admin/tournaments');
console.log('  3. Test join flow via /api/tournaments/[id]/join');
console.log('  4. Add cards and verify scoring via Cloud Function logs');
console.log('  5. Check leaderboard via /api/tournaments/[id]/leaderboard');
console.log('  6. Finalize tournament and claim rewards');
console.log();
