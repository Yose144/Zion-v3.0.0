/**
 * ZION Explorer — Miners Leaderboard API
 *
 * Returns mining-specific leaderboard data from the pool HTTP API
 * enriched with on-chain balances.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { buildMinersLeaderboard } from '@/lib/miners/helpers';

const CACHE_TTL = 15_000;
let cache: { json: any; ts: number } | null = null;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.json, {
        headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
      });
    }

    const leaderboard = await buildMinersLeaderboard();
    const response = {
      ...leaderboard,
      miners: leaderboard.miners.slice(0, limit),
    };

    cache = { json: response, ts: Date.now() };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Failed to fetch miners leaderboard:', error);
    return NextResponse.json(
      {
        miners: [],
        total_hashrate: 0,
        total_hashrate_formatted: '0 H/s',
        active_miners: 0,
        blocks_found: 0,
        total_shares: 0,
        error: 'Failed to fetch miners leaderboard',
      },
      { status: 503 },
    );
  }
}
