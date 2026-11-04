/**
 * ZION Explorer — Charts Data API
 *
 * Returns historical data for charts: difficulty, block times, hashrate,
 * emission, block size, tx count. Derived from block headers over a
 * configurable time range (sampled — see lib/block-history).
 *
 * Response is served through a stale-while-revalidate cache: the expensive
 * history walk (~200 sampled blocks) happens in the background, so a cache
 * expiry never blocks a visitor.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { estimateCirculatingSupplyAtHeight } from '@/lib/supply';
import { getBlockHistory } from '@/lib/block-history';
import { createSwrCache, cacheControl } from '@/lib/server-cache';

const CHART_TYPES = ['difficulty', 'blocktime', 'hashrate', 'emission', 'blocksize', 'txcount'] as const;
type ChartType = (typeof CHART_TYPES)[number];
const RANGES = new Set(['1h', '6h', '24h', '7d', '30d', 'all']);

const chartCache = createSwrCache<any>({
  freshMs: 60_000,
  staleMs: 15 * 60_000,
  maxEntries: 64,
});

async function computeChart(chart: ChartType, rangeParam: string, resolution: number) {
  const history = await getBlockHistory(rangeParam, resolution);
  const { info, chainHeight, headers } = history;
  const labels = headers.map((h) => new Date(h.timestamp * 1000).toISOString());

  let values: number[];
  switch (chart) {
    case 'blocktime': {
      const times: number[] = [];
      for (let i = 1; i < headers.length; i++) {
        const delta = headers[i].timestamp - headers[i - 1].timestamp;
        if (delta > 0) times.push(delta);
      }
      values = times;
      break;
    }
    case 'hashrate': {
      const target = info.target || 60;
      values = headers.map((h) => h.difficulty / target);
      break;
    }
    case 'emission':
      values = headers.map((h) => estimateCirculatingSupplyAtHeight(h.height));
      break;
    case 'blocksize':
      values = headers.map((h) => h.block_size || 0);
      break;
    case 'txcount':
      values = headers.map((h) => h.num_txes || 0);
      break;
    case 'difficulty':
    default:
      values = headers.map((h) => h.difficulty);
      break;
  }

  // blocktime drops the first header (delta needs a pair) — keep labels aligned.
  const chartLabels = chart === 'blocktime' ? labels.slice(1, values.length + 1) : labels;

  return {
    chart,
    range: history.range,
    resolution: history.resolution,
    data_points: values.length,
    chain_height: chainHeight,
    data: { labels: chartLabels, values },
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chartParam = (searchParams.get('type') || 'difficulty') as ChartType;
    if (!CHART_TYPES.includes(chartParam)) {
      return NextResponse.json(
        { error: `Unknown chart type: ${chartParam}`, supported: CHART_TYPES },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const requestedRange = searchParams.get('range') || '24h';
    const rangeParam = RANGES.has(requestedRange) ? requestedRange : '24h';
    const requestedResolution = Number.parseInt(searchParams.get('resolution') || '0', 10);
    const resolution = Number.isFinite(requestedResolution)
      ? Math.min(10_000, Math.max(0, requestedResolution))
      : 0;

    const { value, stale, ageMs } = await chartCache.get(
      `${chartParam}:${rangeParam}:${resolution}`,
      () => computeChart(chartParam, rangeParam, resolution),
    );

    return NextResponse.json(value, {
      headers: {
        'Cache-Control': cacheControl({ maxAge: 10, sMaxAge: 10, swr: 60 }),
        'X-Explorer-Cache': stale ? `stale-${Math.round(ageMs / 1000)}s` : 'fresh',
      },
    });
  } catch (error) {
    console.error('Failed to generate chart data:', error);
    return NextResponse.json({ error: 'Failed to generate chart data' }, { status: 503 });
  }
}
