/**
 * POST /api/tournaments/[id]/claim-reward
 * User claims tournament reward
 */

import { NextRequest, NextResponse } from 'next/server';
import { claimReward } from '@/lib/tournaments';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id;
    const body = await request.json();

    const { userId, rewardId } = body;

    if (!userId || !rewardId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await claimReward({
      tournamentId,
      userId,
      rewardId,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error claiming reward:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
