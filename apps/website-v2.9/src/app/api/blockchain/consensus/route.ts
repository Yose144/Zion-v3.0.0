/**
 * ZION Explorer — Consensus & Economics API
 *
 * Returns canonical protocol parameters, decade decay schedule, and
 * optional difficulty chart data for the /explorer/consensus page.
 *
 * Cached with stale-while-revalidate: the `?chart=true` variant walks sampled
 * block history, so a cache expiry must not block the response.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { getBlockHistory } from '@/lib/block-history';
import { CONSENSUS_PARAMS } from '@/lib/consensus/helpers';
import { createSwrCache, cacheControl } from '@/lib/server-cache';

const RANGES = new Set(['1h', '6h', '24h', '7d', '30d', 'all']);

const consensusCache = createSwrCache<any>({
  freshMs: 10_000,
  staleMs: 2 * 60_000,
  maxEntries: 16,
});

async function computeConsensus(rangeParam: string, includeChart: boolean) {
  const rpc = getZionRpc();
  const history = includeChart ? await getBlockHistory(rangeParam).catch(() => null) : null;
  const [info, lastBlock] = history
    ? [history.info, history.headers.at(-1) ?? null]
    : await Promise.all([
        rpc.getInfo().catch(() => null),
        rpc.getLastBlockHeader().catch(() => null),
      ]);

  const chainHeight = info?.height ?? 0;
  const currentDifficulty = lastBlock?.difficulty ?? info?.difficulty ?? 0;

  return {
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
    difficulty_chart: history
      ? {
          labels: history.headers.map((header) => new Date(header.timestamp * 1000).toISOString()),
          values: history.headers.map((header) => header.difficulty),
        }
      : null,
    fetched_at: Date.now(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedRange = searchParams.get('range') || '7d';
    const rangeParam = RANGES.has(requestedRange) ? requestedRange : '7d';
    const includeChart = searchParams.get('chart') === 'true';

    const { value, stale, ageMs } = await consensusCache.get(
      `${rangeParam}:${includeChart}`,
      () => computeConsensus(rangeParam, includeChart),
    );

    return NextResponse.json(value, {
      headers: {
        'Cache-Control': cacheControl({ maxAge: 10, sMaxAge: 10, swr: 60 }),
        'X-Explorer-Cache': stale ? `stale-${Math.round(ageMs / 1000)}s` : 'fresh',
      },
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
