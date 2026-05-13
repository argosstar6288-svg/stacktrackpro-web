/**
 * POST /api/tournaments/[id]/join
 * User joins a tournament
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { joinTournament } from '@/lib/tournaments';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id;
    const body = await request.json();

    const { userId, displayName, email, photoUrl } = body;

    // Validate required fields
    if (!userId || !displayName || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user's current credit balance
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userSnap.data();
    const currentBalance = userData.creditBalance || 0;

    // Join tournament
    const result = await joinTournament(
      { tournamentId, userId, displayName, email, photoUrl },
      currentBalance
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in join tournament endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
