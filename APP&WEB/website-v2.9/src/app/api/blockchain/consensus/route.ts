/**
 * ZION Explorer — Consensus & Economics API
 *
 * Returns canonical protocol parameters, decade decay schedule, and
 * optional difficulty chart data for the /explorer/consensus page.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { CONSENSUS_PARAMS } from '@/lib/consensus/helpers';

const CACHE_TTL = 10_000;
let cache: { json: any; ts: number } | null = null;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rangeParam = searchParams.get('range') || '7d';
    const includeChart = searchParams.get('chart') !== 'false';

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.json, {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' },
      });
    }

    const rpc = getZionRpc();
    const [info, lastBlock] = await Promise.all([
      rpc.getInfo().catch(() => null),
      rpc.getLastBlockHeader().catch(() => null),
    ]);

    const chainHeight = info?.height ?? 0;
    const currentDifficulty = lastBlock?.difficulty ?? info?.difficulty ?? 0;

    let difficultyChart: { labels: string[]; values: number[] } | null = null;

    if (includeChart && chainHeight > 0) {
      const MAX_HISTORY_BLOCKS = 100_000;
      const rangeBlocks: Record<string, number> = {
        '1h': 60,
        '6h': 360,
        '24h': 1440,
        '7d': 10080,
        '30d': 43200,
        'all': MAX_HISTORY_BLOCKS,
      };

      let blocksToFetch = rangeBlocks[rangeParam] || 10080;
      blocksToFetch = Math.min(blocksToFetch, chainHeight);

      const startHeight = Math.max(0, chainHeight - blocksToFetch);
      const endHeight = chainHeight;
      const step = Math.max(1, Math.floor(blocksToFetch / 200));

      const BATCH_SIZE = 500;
      let allHeaders: any[] = [];

      for (let batchStart = startHeight; batchStart <= endHeight; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endHeight);
        const headers = await rpc.getBlockHeaders(batchStart, batchEnd);
        allHeaders = allHeaders.concat(headers);
      }

      const sampled = step > 1
        ? allHeaders.filter((_, i) => i % step === 0 || i === allHeaders.length - 1)
        : allHeaders;

      difficultyChart = {
        labels: sampled.map((h) => new Date(h.timestamp * 1000).toISOString()),
        values: sampled.map((h) => h.difficulty),
      };
    }

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

    cache = { json: responseBody, ts: Date.now() };

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
