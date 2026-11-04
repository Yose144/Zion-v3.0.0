/**
 * ZION Explorer — Blocks API
 * 
 * Fetches block headers directly from daemon RPC with pagination.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION, BLOCK_REWARD_ZION } from '@/lib/constants';
import { createSwrCache, cacheControl } from '@/lib/server-cache';

// Page payloads are cached briefly and served stale while revalidating, so a
// cache expiry never makes one visitor wait for `limit` block fetches.
const blocksCache = createSwrCache<any[]>({
  freshMs: 5_000,
  staleMs: 60_000,
  maxEntries: 64,
});

async function computeBlocks(limit: number, offset: number): Promise<any[]> {
  const rpc = getZionRpc();
  // Get current chain height
  const info = await rpc.getInfo();
  const chainHeight = info.height;

  if (chainHeight <= 0) {
    return [];
  }

  // Calculate range: latest blocks first
  const endHeight = Math.max(0, chainHeight - offset);
  const startHeight = Math.max(0, endHeight - limit + 1);

  if (startHeight > endHeight) {
    return [];
  }

  const headers = await rpc.getBlockHeaders(startHeight, endHeight);

  // Transform to explorer format, newest first
  const blocks = headers
    .reverse()
    .map((header) => ({
      height: header.height,
      hash: header.hash || '',
      prev_hash: header.prev_hash || '',
      timestamp: header.timestamp,
      transactions: (header.num_txes || 0) + 1,
      num_txes: header.num_txes || 0,
      miner: header.miner_address || '',
      reward: header.subsidy_zion ?? (header.reward ? header.reward / ATOMIC_UNITS_PER_ZION : BLOCK_REWARD_ZION),
      difficulty: header.difficulty,
      block_size: header.block_size || 0,
      nonce: header.nonce || 0,
      orphan_status: header.orphan_status || false,
      depth: header.depth || 0,
      status: header.orphan_status ? 'orphaned' : 'confirmed',
    }));

  return blocks;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10);
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20, 100);
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

    const { value, stale, ageMs } = await blocksCache.get(`${limit}:${offset}`, () => computeBlocks(limit, offset));

    return NextResponse.json(value, {
      headers: {
        'Cache-Control': cacheControl({ maxAge: 5, sMaxAge: 5, swr: 30 }),
        'X-Explorer-Cache': stale ? `stale-${Math.round(ageMs / 1000)}s` : 'fresh',
      },
    });
  } catch (error) {
    console.error('Failed to fetch blocks:', error);
    return NextResponse.json([], { status: 503 });
  }
}
