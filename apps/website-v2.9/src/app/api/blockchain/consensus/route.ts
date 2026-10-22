/**
 * ZION Explorer — Consensus & Economics API
 *
 * Returns canonical protocol parameters, decade decay schedule, and
 * optional difficulty chart data for the /explorer/consensus page.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { getBlockHistory } from '@/lib/block-history';
import { CONSENSUS_PARAMS } from '@/lib/consensus/helpers';

const CACHE_TTL = 10_000;
const cache = new Map<string, { json: any; ts: number }>();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedRange = searchParams.get('range') || '7d';
    const rangeParam = ['1h', '6h', '24h', '7d', '30d', 'all'].includes(requestedRange) ? requestedRange : '7d';
    const includeChart = searchParams.get('chart') === 'true';

    const cacheKey = `${rangeParam}:${includeChart}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.json, {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' },
      });
    }

    const rpc = getZionRpc();
    const history = includeChart
      ? await getBlockHistory(rangeParam).catch(() => null)
      : null;
    const [info, lastBlock] = history
      ? [history.info, history.headers.at(-1) ?? null]
      : await Promise.all([
          rpc.getInfo().catch(() => null),
          rpc.getLastBlockHeader().catch(() => null),
        ]);

    const chainHeight = info?.height ?? 0;
    const currentDifficulty = lastBlock?.difficulty ?? info?.difficulty ?? 0;

    const difficultyChart = history
      ? {
          labels: history.headers.map((header) => new Date(header.timestamp * 1000).toISOString()),
          values: history.headers.map((header) => header.difficulty),
        }
      : null;

    const responseBody = {
      protocol: 'ZION TerraNova',
      version: info?.version ?? '',
      network: {
        mainnet: info?.mainnet ?? true,
        testnet: info?.testnet ?? false,
        chain_height: chainHeight,
        current_difficulty: currentDifficulty,
        top_block_hash: info?.top_block_hash ?? '',
      },
      consensus: CONSENSUS_PARAMS,
      difficulty_chart: difficultyChart,
      fetched_at: Date.now(),
    };

    cache.set(cacheKey, { json: responseBody, ts: Date.now() });

    return NextResponse.json(responseBody, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Failed to fetch consensus data:', error);
    return NextResponse.json(
      {
        protocol: 'ZION TerraNova',
        network: { mainnet: true, testnet: false, chain_height: 0, current_difficulty: 0, top_block_hash: '' },
        consensus: CONSENSUS_PARAMS,
        difficulty_chart: null,
        error: 'Failed to fetch consensus data',
      },
      { status: 503 },
    );
  }
}
