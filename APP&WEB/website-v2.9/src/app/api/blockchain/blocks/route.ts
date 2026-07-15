/**
 * ZION Explorer — Blocks API
 * 
 * Fetches block headers directly from daemon RPC with pagination.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION, BLOCK_REWARD_ZION } from '@/lib/constants';

// Short-lived in-memory cache to deduplicate concurrent requests
const CACHE_TTL = 5_000;
const blockCache = new Map<string, { json: any; ts: number }>();

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const cacheKey = `${limit}:${offset}`;

    // Serve from cache
    const cached = blockCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.json, {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
      });
    }

    // Get current chain height
    const info = await rpc.getInfo();
    const chainHeight = info.height;

    if (chainHeight <= 0) {
      return NextResponse.json([]);
    }

    // Calculate range: latest blocks first
    const endHeight = Math.max(0, chainHeight - offset);
    const startHeight = Math.max(0, endHeight - limit + 1);

    if (startHeight > endHeight) {
      return NextResponse.json([]);
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
        reward: header.reward ? header.reward / ATOMIC_UNITS_PER_ZION : BLOCK_REWARD_ZION,
        difficulty: header.difficulty,
        block_size: header.block_size || 0,
        nonce: header.nonce || 0,
        orphan_status: header.orphan_status || false,
        depth: header.depth || 0,
        status: header.orphan_status ? 'orphaned' : 'confirmed',
      }));

    blockCache.set(cacheKey, { json: blocks, ts: Date.now() });

    return NextResponse.json(blocks, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error('Failed to fetch blocks:', error);
    return NextResponse.json([], { status: 503 });
  }
}
