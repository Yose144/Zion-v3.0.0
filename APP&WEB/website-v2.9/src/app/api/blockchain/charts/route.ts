/**
 * ZION Explorer — Charts Data API
 * 
 * Returns historical data for charts: difficulty, block times, hashrate, emission.
 * Data derived from block headers over configurable time ranges.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { estimateCirculatingSupplyAtHeight } from '@/lib/supply';
import { getZionRpc } from '@/lib/zion-rpc';

type ChartType = 'difficulty' | 'blocktime' | 'hashrate' | 'emission' | 'blocksize' | 'txcount';

// In-memory cache — charts are expensive (hundreds of RPC calls)
const CACHE_TTL = 10_000; // 10 seconds
const chartCache = new Map<string, { json: any; ts: number }>();

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const chart = (searchParams.get('type') || 'difficulty') as ChartType;
    const rangeParam = searchParams.get('range') || '24h';
    const resolution = parseInt(searchParams.get('resolution') || '0');

    // Check cache
    const cacheKey = `${chart}:${rangeParam}:${resolution}`;
    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.json, {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' },
      });
    }

    // Determine how many blocks to fetch based on range
    // Assume ~60s block time; cap "all" so the API stays fast as the chain grows.
    const MAX_HISTORY_BLOCKS = 100_000;
    const rangeBlocks: Record<string, number> = {
      '1h': 60,
      '6h': 360,
      '24h': 1440,
      '7d': 10080,
      '30d': 43200,
      'all': MAX_HISTORY_BLOCKS,
    };

    const info = await rpc.getInfo();
    const chainHeight = info.height;

    let blocksToFetch = rangeBlocks[rangeParam] || 1440;
    if (rangeParam === 'all') blocksToFetch = Math.min(blocksToFetch, chainHeight);
    blocksToFetch = Math.min(blocksToFetch, chainHeight);

    // Apply resolution (sample every Nth block for large ranges)
    const step = resolution || Math.max(1, Math.floor(blocksToFetch / 200));
    
    const startHeight = Math.max(0, chainHeight - blocksToFetch);
    const endHeight = chainHeight;

    // Fetch headers in batches (RPC may limit range)
    const BATCH_SIZE = 500;
    let allHeaders: any[] = [];

    for (let batchStart = startHeight; batchStart <= endHeight; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endHeight);
      const headers = await rpc.getBlockHeaders(batchStart, batchEnd);
      allHeaders = allHeaders.concat(headers);
    }

    // Sample headers at resolution
    const sampledHeaders = step > 1
      ? allHeaders.filter((_, i) => i % step === 0 || i === allHeaders.length - 1)
      : allHeaders;

    // Generate chart data based on type
    let data: { labels: string[]; values: number[]; secondary?: number[] };

    switch (chart) {
      case 'difficulty':
        data = {
          labels: sampledHeaders.map(h => new Date(h.timestamp * 1000).toISOString()),
          values: sampledHeaders.map(h => h.difficulty),
        };
        break;

      case 'blocktime': {
        const times: number[] = [];
        const labels: string[] = [];
        for (let i = 1; i < sampledHeaders.length; i++) {
          const delta = sampledHeaders[i].timestamp - sampledHeaders[i - 1].timestamp;
          if (delta > 0) {
            times.push(delta);
            labels.push(new Date(sampledHeaders[i].timestamp * 1000).toISOString());
          }
        }
        data = { labels, values: times };
        break;
      }

      case 'hashrate': {
        const targetTime = info.target || 60;
        data = {
          labels: sampledHeaders.map(h => new Date(h.timestamp * 1000).toISOString()),
          values: sampledHeaders.map(h => h.difficulty / targetTime),
        };
        break;
      }

      case 'emission': {
        data = {
          labels: sampledHeaders.map(h => new Date(h.timestamp * 1000).toISOString()),
          values: sampledHeaders.map(h => estimateCirculatingSupplyAtHeight(h.height)),
        };
        break;
      }

      case 'blocksize':
        data = {
          labels: sampledHeaders.map(h => new Date(h.timestamp * 1000).toISOString()),
          values: sampledHeaders.map(h => h.block_size || 0),
        };
        break;

      case 'txcount':
        data = {
          labels: sampledHeaders.map(h => new Date(h.timestamp * 1000).toISOString()),
          values: sampledHeaders.map(h => h.num_txes || 0),
        };
        break;

      default:
        return NextResponse.json({ error: `Unknown chart type: ${chart}` }, { status: 400 });
    }

    const responseBody = {
      chart,
      range: rangeParam,
      resolution: step,
      data_points: data.values.length,
      chain_height: chainHeight,
      data,
    };

    // Store in cache
    chartCache.set(cacheKey, { json: responseBody, ts: Date.now() });

    return NextResponse.json(responseBody, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Failed to generate chart data:', error);
    return NextResponse.json({ error: 'Failed to generate chart data' }, { status: 503 });
  }
}
