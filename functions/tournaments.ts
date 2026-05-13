/**
 * Cloud Function: Score Tournament Entry on Card Scan
 * Triggered when a card is added to user's collection during an active tournament
 * 
 * Deploy with: firebase deploy --only functions:scoreTournamentEntry
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Main scoring function
 * Triggered when a card is created/updated in the cards collection
 */
export const scoreTournamentEntry = functions
  .region('us-east1')
  .firestore.document('cards/{cardId}')
  .onCreate(async (snapshot, context) => {
    const card = snapshot.data();
    const userId = card.userId;
    const cardId = snapshot.id;
    const cardAddedAt = card.addedAt || admin.firestore.FieldValue.serverTimestamp();

    console.log(`[Tournament Scorer] Card scanned: ${cardId} by user ${userId}`);

    try {
      // Find all active tournaments this user is enrolled in
      const entriesSnapshot = await db
        .collection('tournament_entries')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();

      if (entriesSnapshot.empty) {
        console.log(`[Tournament Scorer] User ${userId} is not in any active tournament`);
        return null;
      }

      // Process each tournament entry
      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();
        const tournamentId = entry.tournamentId;

        // Get tournament details
        const tournamentRef = db.collection('tournaments').doc(tournamentId);
        const tourSnapshot = await tournamentRef.get();

        if (!tourSnapshot.exists) {
          console.warn(`[Tournament Scorer] Tournament ${tournamentId} not found`);
          continue;
        }

        const tournament = tourSnapshot.data();

        // Check if tournament is active and card is within tournament timeframe
        const now = new Date();
        const tourStartTime = tournament.startTime?.toDate?.() || new Date();
        const tourEndTime = tournament.endTime?.toDate?.() || new Date();
        const cardTime = cardAddedAt instanceof admin.firestore.Timestamp
          ? cardAddedAt.toDate()
          : new Date(cardAddedAt);

        if (cardTime < tourStartTime || cardTime > tourEndTime) {
          console.log(
            `[Tournament Scorer] Card ${cardId} outside tournament timeframe for ${tournamentId}`
          );
          continue;
        }

        // Anti-cheat: Check for duplicate scans
        if (entry.scannedCardIds && entry.scannedCardIds.includes(cardId)) {
          console.log(
            `[Tournament Scorer] Duplicate scan detected for card ${cardId} in tournament ${tournamentId}`
          );
          continue;
        }

        // Calculate score
        const cardValue = card.marketPrice || card.value || 0;
        const rules = tournament.rules.scoringConfig;

        // Base score: $1 = 1 point
        const baseValueScore = cardValue * rules.pointsPerDollarGain;

        // Rarity bonus
        let rarityBonus = 0;
        const rarity = (card.rarity || '').toLowerCase();
        if (rarity.includes('ultra') || rarity.includes('legendary')) {
          rarityBonus = rules.rarityBonusUltraRare || 100;
        } else if (rarity.includes('rare')) {
          rarityBonus = rules.rarityBonusRare || 50;
        }

        // Whale cap
        const cappedValueScore = cardValue > (rules.maxPointsPerTransaction / rules.pointsPerDollarGain)
          ? rules.maxPointsPerTransaction
          : baseValueScore;

        // Speed bonus: +10% if in first 50% of tournament
        const tourDuration = tourEndTime.getTime() - tourStartTime.getTime();
        const elapsedByCard = cardTime.getTime() - tourStartTime.getTime();
        const progressPercent = elapsedByCard / tourDuration;
        const speedBonus = progressPercent < 0.5 ? Math.floor((cappedValueScore + rarityBonus) * 0.1) : 0;

        // Streak multiplier (simplified: count scans in last 3 days)
        const scansInLastThreeDays = (entry.scansInLastThreeDays || 0) + 1;
        const streakDays = Math.floor(scansInLastThreeDays / 3);
        const streakMultiplier = 1 + streakDays * (rules.streakMultiplierPerThreeDays - 1 || 0.1);

        // Final score
        const cardScore = (cappedValueScore + rarityBonus) * streakMultiplier + speedBonus;

        console.log(
          `[Tournament Scorer] Score breakdown for card ${cardId} in tournament ${tournamentId}:`,
          {
            baseValueScore,
            rarityBonus,
            cappedValueScore,
            streakMultiplier,
            speedBonus,
            cardScore: Math.round(cardScore),
          }
        );

        // Update tournament score document
        const scoreId = `${tournamentId}_${userId}`;
        const scoreRef = db.collection('tournament_scores').doc(scoreId);
        const scoreSnap = await scoreRef.get();

        if (!scoreSnap.exists) {
          console.warn(
            `[Tournament Scorer] Score document ${scoreId} does not exist. Creating it.`
          );
          await scoreRef.set({
            id: scoreId,
            tournamentId,
            userId,
            displayName: entry.displayName,
            photoUrl: entry.photoUrl,
            totalScore: Math.round(cardScore),
            breakdown: {
              valueGain: Math.round(cappedValueScore),
              rarityBonusPoints: rarityBonus,
              streakMultiplier: Number(streakMultiplier.toFixed(2)),
              speedBonusPoints: speedBonus,
              transactionCap: cappedValueScore === baseValueScore ? 0 : Math.round(baseValueScore - cappedValueScore),
            },
            lastScoreUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // Update existing score
          const currentScore = scoreSnap.data().totalScore || 0;
          const newScore = currentScore + Math.round(cardScore);

          await scoreRef.update({
            totalScore: newScore,
            breakdown: {
              valueGain: (scoreSnap.data().breakdown?.valueGain || 0) + Math.round(cappedValueScore),
              rarityBonusPoints: (scoreSnap.data().breakdown?.rarityBonusPoints || 0) + rarityBonus,
              streakMultiplier: Number(streakMultiplier.toFixed(2)),
              speedBonusPoints: (scoreSnap.data().breakdown?.speedBonusPoints || 0) + speedBonus,
              transactionCap: (scoreSnap.data().breakdown?.transactionCap || 0),
            },
            lastScoreUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Update entry to track scanned card and streak
        await entryDoc.ref.update({
          scannedCardIds: admin.firestore.FieldValue.arrayUnion(cardId),
          scansInLastThreeDays: scansInLastThreeDays,
          lastScanTimestamp: cardTime,
        });

        console.log(
          `[Tournament Scorer] Updated score for tournament ${tournamentId}. New total: ${
            (scoreSnap.data()?.totalScore || 0) + Math.round(cardScore)
          }`
        );
      }

      return null;
    } catch (error) {
      console.error('[Tournament Scorer] Error scoring card:', error);
      throw error;
    }
  });

/**
 * Scheduled function: Finalize completed tournaments
 * Runs every hour to check if any tournaments have ended
 */
export const finalizeTournaments = functions
  .region('us-east1')
  .pubsub.schedule('0 * * * *') // Every hour
  .onRun(async context => {
    console.log('[Tournament Finalizer] Running tournament finalization check');

    try {
      const now = new Date();

      // Find all active tournaments that have ended
      const activeTourneys = await db
        .collection('tournaments')
        .where('status', '==', 'active')
        .where('endTime', '<=', now)
        .limit(10)
        .get();

      console.log(
        `[Tournament Finalizer] Found ${activeTourneys.docs.length} tournaments to finalize`
      );

      for (const tourDoc of activeTourneys.docs) {
        const tournament = tourDoc.data();
        const tournamentId = tourDoc.id;

        console.log(`[Tournament Finalizer] Finalizing tournament ${tournamentId}`);

        // Get final leaderboard
        const scoresSnapshot = await db
          .collection('tournament_scores')
          .where('tournamentId', '==', tournamentId)
          .orderBy('totalScore', 'desc')
          .orderBy('userId', 'asc')
          .get();

        // Create reward docs
        const batch = db.batch();
        let totalPaidOut = 0;

        scoresSnapshot.docs.forEach((scoreDoc, idx) => {
          const score = scoreDoc.data();
          const rank = idx + 1;

          // Calculate prize
          let prizeCredits = 0;
          if (rank === 1) {
            prizeCredits = Math.floor(
              (tournament.prizePoolCredits * (tournament.winnerPercents['1'] || 0)) / 100
            );
          } else if (rank === 2) {
            prizeCredits = Math.floor(
              (tournament.prizePoolCredits * (tournament.winnerPercents['2'] || 0)) / 100
            );
          } else if (rank === 3) {
            prizeCredits = Math.floor(
              (tournament.prizePoolCredits * (tournament.winnerPercents['3'] || 0)) / 100
            );
          } else if (rank >= 4 && rank <= 10) {
            const totalPercent = tournament.winnerPercents['4-10'] || 0;
            prizeCredits = Math.floor((tournament.prizePoolCredits * totalPercent) / (100 * 7));
          }

          totalPaidOut += prizeCredits;

          const rewardId = `${tournamentId}_${score.userId}`;
          const rewardRef = db.collection('tournament_rewards').doc(rewardId);

          const reward = {
            id: rewardId,
            tournamentId,
            userId: score.userId,
            displayName: score.displayName,
            finalRank: rank,
            finalScore: score.totalScore,
            creditsWon: prizeCredits,
            badgesEarned: [],
            shareableLink: `${process.env.WEBSITE_URL || 'https://stacktrackpro.com'}/share/tournament/${tournamentId}/${score.userId}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          batch.set(rewardRef, reward);
        });

        // Update tournament status
        batch.update(tourDoc.ref, {
          status: 'completed',
          totalPaidOut,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        console.log(
          `[Tournament Finalizer] Finalized tournament ${tournamentId}. Paid out ${totalPaidOut} credits.`
        );
      }

      return null;
    } catch (error) {
      console.error('[Tournament Finalizer] Error finalizing tournaments:', error);
      throw error;
    }
  });
