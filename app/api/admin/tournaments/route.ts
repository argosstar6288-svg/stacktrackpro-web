/**
 * POST /api/admin/tournaments
 * Admin endpoint to create tournaments
 * 
 * Protected: Admin-only (checks user role in Firestore)
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tournament, TournamentRules, TournamentType } from '@/lib/tournament-types';

/**
 * Check if user is admin
 */
async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();
    return userData.role === 'admin' || userData.email === 'argos.star6288@gmail.com';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get admin ID from request (you'd normally get this from auth headers)
    const body = await request.json();
    const { adminId, ...tournamentData } = body;

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // Check if user is admin
    const isAdmin = await isAdminUser(adminId);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only admins can create tournaments' },
        { status: 403 }
      );
    }

    // Validate required fields
    const { name, type, entryFeeCredits, prizePoolCredits, startTime, endTime } = tournamentData;

    if (!name || !type || entryFeeCredits === undefined || !prizePoolCredits || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate tournament ID
    const tournamentId = `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Default rules for Value Sprint
    const defaultRules: TournamentRules = {
      scoringConfig: {
        pointsPerDollarGain: 1,
        rarityBonusRare: 50,
        rarityBonusUltraRare: 100,
        streakMultiplierPerThreeDays: 1.1,
        maxPointsPerTransaction: 500,
        speedBonusPercent: 0.1,
      },
      antiCheatRules: {
        ignoreDuplicateScans: true,
        requireMinimumValueChange: 1,
        enforceAccountAgeMinDays: 0,
      },
    };

    // Build tournament document
    const registrationOpensAt = Timestamp.fromDate(new Date(startTime));
    const startTimestamp = Timestamp.fromDate(new Date(startTime));
    const endTimestamp = Timestamp.fromDate(new Date(endTime));
    const defaultDeadline = Timestamp.fromDate(new Date(new Date(startTime).getTime() - 24 * 60 * 60 * 1000));

    const tournament: Tournament = {
      id: tournamentId,
      type: type || 'value_sprint',
      name,
      description: tournamentData.description || '',
      status: 'registration_open',
      registrationOpensAt: registrationOpensAt,
      registrationDeadline: endTimestamp || defaultDeadline,
      startTime: startTimestamp,
      endTime: endTimestamp,
      entryFeeCredits,
      minEntries: tournamentData.minEntries || 2,
      maxEntries: tournamentData.maxEntries || 500,
      currentEntryCount: 0,
      prizePoolCredits,
      platformCutPercent: tournamentData.platformCutPercent || 30,
      winnerPercents: tournamentData.winnerPercents || {
        '1': 40,
        '2': 30,
        '3': 20,
        '4-10': 10,
      },
      rules: tournamentData.rules || defaultRules,
      createdBy: adminId,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    // Save to Firestore
    const tourRef = doc(db, 'tournaments', tournamentId);
    await setDoc(tourRef, tournament);

    return NextResponse.json(
      {
        success: true,
        tournamentId,
        tournament,
        message: `Tournament "${name}" created successfully!`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { success: false, error: `Failed to create tournament: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/tournaments
 * List all tournaments (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // Check if user is admin
    const isAdmin = await isAdminUser(adminId);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only admins can list tournaments' },
        { status: 403 }
      );
    }

    // In a real app, you'd query all tournaments
    // For now, return empty list as placeholder
    return NextResponse.json(
      {
        success: true,
        tournaments: [],
        message: 'Admin tournament list endpoint ready',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing tournaments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list tournaments' },
      { status: 500 }
    );
  }
}
