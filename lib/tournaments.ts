/**
 * Core Tournament Logic
 * Handles tournament join, entry management, leaderboard queries, and reward claims
 */

import {
  db,
} from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  Timestamp,
  serverTimestamp,
  writeBatch,
  runTransaction,
  FieldValue,
  deleteField,
} from 'firebase/firestore';
import {
  Tournament,
  TournamentEntry,
  TournamentScore,
  TournamentReward,
  JoinTournamentRequest,
  JoinTournamentResponse,
  LeaderboardResponse,
  LeaderboardEntry,
  ClaimRewardRequest,
  ClaimRewardResponse,
  TournamentListFilters,
} from './tournament-types';

/**
 * Get tournament by ID
 */
export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
  try {
    const tourRef = doc(db, 'tournaments', tournamentId);
    const tourSnap = await getDoc(tourRef);
    
    if (!tourSnap.exists()) {
      return null;
    }

    return {
      id: tourSnap.id,
      ...tourSnap.data(),
    } as Tournament;
  } catch (error) {
    console.error('Error fetching tournament:', error);
    throw error;
  }
}

/**
 * List tournaments with filters
 */
export async function listTournaments(filters?: TournamentListFilters): Promise<Tournament[]> {
  try {
    const tourRef = collection(db, 'tournaments');
    
    // Build query constraints
    const constraints: any[] = [];
    
    if (filters?.status) {
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      constraints.push(where('status', 'in', statusArray));
    }
    
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }

    // Add sorting
    const sortField = filters?.sortBy || 'startTime';
    const sortOrder = filters?.sortOrder || 'asc';
    constraints.push(orderBy(sortField, sortOrder as 'asc' | 'desc'));

    // Add limit
    const queryLimit = filters?.limit || 50;
    constraints.push(fbLimit(queryLimit));

    const q = query(tourRef, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Tournament[];
  } catch (error) {
    console.error('Error listing tournaments:', error);
    throw error;
  }
}

/**
 * Join a tournament
 * Charges entry fee and creates entry document
 */
export async function joinTournament(
  req: JoinTournamentRequest,
  userCurrentBalance: number
): Promise<JoinTournamentResponse> {
  try {
    const tournament = await getTournamentById(req.tournamentId);
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    // Validate tournament status
    if (tournament.status !== 'registration_open' && tournament.status !== 'active') {
      return { success: false, error: `Tournament is ${tournament.status}. Registration not open.` };
    }

    // Validate current entry count
    if (tournament.currentEntryCount && tournament.currentEntryCount >= tournament.maxEntries) {
      return { success: false, error: 'Tournament is at max capacity' };
    }

    // Validate balance
    if (userCurrentBalance < tournament.entryFeeCredits) {
      return {
        success: false,
        error: `Insufficient balance. Need ${tournament.entryFeeCredits} credits, you have ${userCurrentBalance}.`,
      };
    }

    // Check if user already entered
    const existingEntry = await getDoc(
      doc(db, `tournaments/${req.tournamentId}/entries/${req.userId}`)
    );
    if (existingEntry.exists()) {
      return { success: false, error: 'You are already entered in this tournament' };
    }

    // Get user's current collection value (baseline)
    const userRef = doc(db, 'users', req.userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const baselineCollectionValue = userData?.collectionValue || 0;
    const baselineCardCount = userData?.cardCount || 0;

    // Create entry (with transaction for atomicity)
    const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = serverTimestamp();

    const entry: TournamentEntry = {
      id: entryId,
      tournamentId: req.tournamentId,
      userId: req.userId,
      displayName: req.displayName,
      email: req.email,
      photoUrl: req.photoUrl,
      status: 'active',
      entryFeeCharged: tournament.entryFeeCredits,
      joinedAt: now as any,
      baselineCollectionValue,
      baselineCardCount,
      scannedCardIds: new Set(),
      lastScanTimestamp: undefined,
      scansInLastThreeDays: 0,
    };

    const entryRef = doc(db, `tournaments/${req.tournamentId}/entries/${entryId}`);
    const entryRef2 = doc(db, 'tournament_entries', `${req.tournamentId}_${req.userId}`);

    // Create initial score document
    const scoreId = `${req.tournamentId}_${req.userId}`;
    const scoreRef = doc(db, 'tournament_scores', scoreId);

    const score: TournamentScore = {
      id: scoreId,
      tournamentId: req.tournamentId,
      userId: req.userId,
      displayName: req.displayName,
      photoUrl: req.photoUrl,
      totalScore: 0,
      breakdown: {
        valueGain: 0,
        rarityBonusPoints: 0,
        streakMultiplier: 1,
        speedBonusPoints: 0,
        transactionCap: 0,
      },
      currentRank: undefined,
      lastScoreUpdateAt: now as any,
    };

    // Batch write: entry + score + update tournament count
    const batch = writeBatch(db);
    
    batch.set(entryRef, entry);
    batch.set(entryRef2, entry);
    batch.set(scoreRef, score);
    batch.update(doc(db, 'tournaments', req.tournamentId), {
      currentEntryCount: (tournament.currentEntryCount || 0) + 1,
      updatedAt: now,
    });

    // Deduct credits from user balance
    batch.update(userRef, {
      creditBalance: (userData?.creditBalance || 0) - tournament.entryFeeCredits,
      updatedAt: now,
    });

    await batch.commit();

    return {
      success: true,
      entryId,
      message: `Successfully joined ${tournament.name}!`,
    };
  } catch (error) {
    console.error('Error joining tournament:', error);
    return { success: false, error: `Failed to join: ${error}` };
  }
}

/**
 * Get leaderboard for a tournament
 * Paginated, returns top entries and user's rank
 */
export async function getLeaderboard(
  tournamentId: string,
  pageSize: number = 50,
  page: number = 0,
  userId?: string
): Promise<LeaderboardResponse> {
  try {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Query scores ordered by totalScore descending, then by userId (for tie-breaking)
    const scoreRef = collection(db, 'tournament_scores');
    const q = query(
      scoreRef,
      where('tournamentId', '==', tournamentId),
      orderBy('totalScore', 'desc'),
      orderBy('userId', 'asc'),
      fbLimit(pageSize * (page + 1)) // Get all up to current page
    );

    const snapshot = await getDocs(q);
    const allDocs = snapshot.docs;

    // Rank scores and extract page
    const allEntries: LeaderboardEntry[] = allDocs.map((doc, idx) => {
      const data = doc.data() as TournamentScore;
      return {
        rank: idx + 1,
        userId: data.userId,
        displayName: data.displayName,
        photoUrl: data.photoUrl,
        score: data.totalScore,
        scoreBreakdown: data.breakdown,
        rankChange: data.rankChange,
        badges: [],
      };
    });

    // Get page slice
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const pageEntries = allEntries.slice(startIdx, endIdx);

    // Find user's entry if provided
    let userEntry: LeaderboardEntry | undefined;
    if (userId) {
      userEntry = allEntries.find(e => e.userId === userId);
      if (userEntry && !pageEntries.find(e => e.userId === userId)) {
        // User not on current page, highlight separately
      }
    }

    return {
      tournamentId,
      totalEntries: allEntries.length,
      pageSize,
      currentPage: page,
      totalPages: Math.ceil(allEntries.length / pageSize),
      entries: pageEntries,
      userEntry,
      lastUpdated: Timestamp.now(),
    };
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
}

/**
 * Get user's current score in a tournament
 */
export async function getUserTournamentScore(
  tournamentId: string,
  userId: string
): Promise<TournamentScore | null> {
  try {
    const scoreId = `${tournamentId}_${userId}`;
    const scoreRef = doc(db, 'tournament_scores', scoreId);
    const scoreSnap = await getDoc(scoreRef);

    if (!scoreSnap.exists()) {
      return null;
    }

    return {
      id: scoreSnap.id,
      ...scoreSnap.data(),
    } as TournamentScore;
  } catch (error) {
    console.error('Error getting user score:', error);
    throw error;
  }
}

/**
 * Update score for a user in a tournament
 * Called by Cloud Function when card is scanned
 */
export async function updateTournamentScore(
  tournamentId: string,
  userId: string,
  scoreIncrement: number,
  breakdownUpdate: Partial<any>
): Promise<void> {
  try {
    const scoreId = `${tournamentId}_${userId}`;
    const scoreRef = doc(db, 'tournament_scores', scoreId);

    await updateDoc(scoreRef, {
      totalScore: (await getDoc(scoreRef)).data()?.totalScore + scoreIncrement || scoreIncrement,
      breakdown: breakdownUpdate,
      lastScoreUpdateAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating tournament score:', error);
    throw error;
  }
}

/**
 * Finalize tournament (lock scores, determine rankings and rewards)
 * Call this when tournament reaches endTime
 */
export async function finalizeTournament(tournamentId: string, adminId: string): Promise<void> {
  try {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Get final leaderboard
    const leaderboard = await getLeaderboard(tournamentId, 1000);

    // Create reward docs for each participant
    const batch = writeBatch(db);

    leaderboard.entries.forEach((entry) => {
      // Calculate prize from pool
      let prizeCredits = 0;
      if (entry.rank === 1) {
        prizeCredits = Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['1'] || 0)) / 100);
      } else if (entry.rank === 2) {
        prizeCredits = Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['2'] || 0)) / 100);
      } else if (entry.rank === 3) {
        prizeCredits = Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['3'] || 0)) / 100);
      } else if (entry.rank >= 4 && entry.rank <= 10) {
        const totalPercent = tournament.winnerPercents['4-10'] || 0;
        prizeCredits = Math.floor((tournament.prizePoolCredits * totalPercent) / (100 * 7));
      }

      const rewardId = `${tournamentId}_${entry.userId}`;
      const rewardRef = doc(db, 'tournament_rewards', rewardId);

      const reward: TournamentReward = {
        id: rewardId,
        tournamentId,
        userId: entry.userId,
        displayName: entry.displayName,
        finalRank: entry.rank,
        finalScore: entry.score,
        creditsWon: prizeCredits,
        badgesEarned: [],
        shareableLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://stacktrackpro.com'}/share/tournament/${tournamentId}/${entry.userId}`,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      batch.set(rewardRef, reward);
    });

    // Update tournament status
    batch.update(doc(db, 'tournaments', tournamentId), {
      status: 'completed',
      totalPaidOut: leaderboard.entries.reduce((sum, e) => {
        const rank = e.rank;
        let credits = 0;
        if (rank === 1) credits = Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['1'] || 0)) / 100);
        else if (rank === 2) credits = Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['2'] || 0)) / 100);
        else if (rank === 3) credits = Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['3'] || 0)) / 100);
        else if (rank >= 4 && rank <= 10) {
          const totalPercent = tournament.winnerPercents['4-10'] || 0;
          credits = Math.floor((tournament.prizePoolCredits * totalPercent) / (100 * 7));
        }
        return sum + credits;
      }, 0),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    console.error('Error finalizing tournament:', error);
    throw error;
  }
}

export function estimateRewardForRank(tournament: Tournament, rank: number): number {
  if (rank === 1) {
    return Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['1'] || 0)) / 100);
  }
  if (rank === 2) {
    return Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['2'] || 0)) / 100);
  }
  if (rank === 3) {
    return Math.floor((tournament.prizePoolCredits * (tournament.winnerPercents['3'] || 0)) / 100);
  }
  if (rank >= 4 && rank <= 10) {
    const totalPercent = tournament.winnerPercents['4-10'] || 0;
    return Math.floor((tournament.prizePoolCredits * totalPercent) / (100 * 7));
  }
  return 0;
}

export function getRewardDistribution(tournament: Tournament) {
  return [
    {
      label: '1st place',
      credits: estimateRewardForRank(tournament, 1),
    },
    {
      label: '2nd place',
      credits: estimateRewardForRank(tournament, 2),
    },
    {
      label: '3rd place',
      credits: estimateRewardForRank(tournament, 3),
    },
    {
      label: '4th–10th place',
      credits: estimateRewardForRank(tournament, 4),
    },
  ];
}

/**
 * Claim tournament reward (one-time, adds credits to user balance)
 */
export async function claimReward(req: ClaimRewardRequest): Promise<ClaimRewardResponse> {
  try {
    const rewardRef = doc(db, 'tournament_rewards', req.rewardId);
    const rewardSnap = await getDoc(rewardRef);

    if (!rewardSnap.exists()) {
      return { success: false, error: 'Reward not found' };
    }

    const reward = rewardSnap.data() as TournamentReward;

    if (reward.userId !== req.userId) {
      return { success: false, error: 'Reward does not belong to this user' };
    }

    if (reward.claimedAt) {
      return { success: false, error: 'Reward already claimed' };
    }

    // Update user balance in transaction
    const userRef = doc(db, 'users', req.userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const newBalance = (userData?.creditBalance || 0) + reward.creditsWon;

    const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = serverTimestamp();

    // Batch: update reward + user balance
    const batch = writeBatch(db);
    batch.update(rewardRef, {
      claimedAt: now,
      creditsTxId: txnId,
    });
    batch.update(userRef, {
      creditBalance: newBalance,
      updatedAt: now,
    });

    await batch.commit();

    return {
      success: true,
      creditsAdded: reward.creditsWon,
      newBalance,
      badges: reward.badgesEarned,
    };
  } catch (error) {
    console.error('Error claiming reward:', error);
    return { success: false, error: `Failed to claim reward: ${error}` };
  }
}

/**
 * Get user's tournament reward if it exists
 */
export async function getUserReward(
  tournamentId: string,
  userId: string
): Promise<TournamentReward | null> {
  try {
    const rewardId = `${tournamentId}_${userId}`;
    const rewardRef = doc(db, 'tournament_rewards', rewardId);
    const rewardSnap = await getDoc(rewardRef);

    if (!rewardSnap.exists()) {
      return null;
    }

    return {
      id: rewardSnap.id,
      ...rewardSnap.data(),
    } as TournamentReward;
  } catch (error) {
    console.error('Error getting user reward:', error);
    throw error;
  }
}
