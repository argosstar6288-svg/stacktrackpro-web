/**
 * GET /api/tournaments/[id]/leaderboard
 * Get tournament leaderboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/tournaments';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const page = parseInt(searchParams.get('page') || '0', 10);
    const userId = searchParams.get('userId') || undefined;

    // Validate
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 500) {
      return NextResponse.json(
        { error: 'Invalid pageSize' },
        { status: 400 }
      );
    }

    if (isNaN(page) || page < 0) {
      return NextResponse.json(
        { error: 'Invalid page' },
        { status: 400 }
      );
    }

    const leaderboard = await getLeaderboard(tournamentId, pageSize, page, userId);

    return NextResponse.json(leaderboard, { status: 200 });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
