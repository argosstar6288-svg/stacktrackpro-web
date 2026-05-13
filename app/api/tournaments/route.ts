/**
 * GET /api/tournaments
 * List tournaments with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { listTournaments } from '@/lib/tournaments';
import { TournamentListFilters, TournamentStatus, TournamentType } from '@/lib/tournament-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');
    const sortByParam = searchParams.get('sortBy') || 'startTime';
    const sortOrderParam = searchParams.get('sortOrder') || 'asc';
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);

    const filters: TournamentListFilters = {
      status: statusParam ? (statusParam.split(',') as TournamentStatus[]) : undefined,
      type: typeParam as TournamentType || undefined,
      sortBy: sortByParam as any || 'startTime',
      sortOrder: sortOrderParam as 'asc' | 'desc' || 'asc',
      limit: Math.min(limitParam, 100), // Cap at 100
    };

    const tournaments = await listTournaments(filters);

    return NextResponse.json(
      {
        success: true,
        count: tournaments.length,
        tournaments,
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
