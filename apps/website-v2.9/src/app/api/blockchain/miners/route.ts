/**
 * ZION Explorer — Miners Leaderboard API
 *
 * Returns mining-specific leaderboard data from the pool HTTP API
 * enriched with on-chain balances.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { buildMinersLeaderboard } from '@/lib/miners/helpers';
import { createSwrCache, cacheControl } from '@/lib/server-cache';

// Leaderboard enriches each miner with an on-chain balance (one RPC each), so
// it is cached for a minute and served stale while revalidating after that.
const leaderboardCache = createSwrCache<any>({
  freshMs: 60_000,
  staleMs: 10 * 60_000,
  maxEntries: 2,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawLimit = Number(searchParams.get('limit') || 100);
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 500);

    const { value, stale, ageMs } = await leaderboardCache.get('leaderboard', buildMinersLeaderboard);
    const leaderboard = value;
    const response = {
      ...leaderboard,
      miners: leaderboard.miners.slice(0, limit),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': cacheControl({ maxAge: 15, sMaxAge: 15, swr: 60 }),
        'X-Explorer-Cache': stale ? `stale-${Math.round(ageMs / 1000)}s` : 'fresh',
      },
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
