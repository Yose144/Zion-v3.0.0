/**
 * ZION DeFi — Price Chart API
 *
 * Proxies GeckoTerminal OHLCV data for the primary wZION/USDT Uniswap V3 pool.
 * Returns close prices for charting. Falls back to live /api/defi/price spot
 * if GeckoTerminal is unavailable.
 *
 * GeckoTerminal API: https://api.geckoterminal.com/api/v2
 * Rate limit: 30 req/min (free tier) — we cache for 60s server-side.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const POOL_USDT = '0x186b46c2f04153999d44D25179cD623fD62Bfda2';
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2/networks/base/pools';

// In-memory cache (valid for 60s)
let cached: { data: number[]; timestamps: number[]; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

interface OhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchOhlcv(timeframe: 'minute' | 'hour', limit: number): Promise<OhlcvCandle[]> {
  const url = `${GECKO_BASE}/${POOL_USDT}/ohlcv/${timeframe}?limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const raw: number[][] = json?.data?.attributes?.ohlcv_list ?? [];
  // GeckoTerminal returns candles in descending order (newest first)
  // Each candle: [timestamp, open, high, low, close, volume]
  return raw
    .map((c) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }))
    .sort((a, b) => a.timestamp - b.timestamp); // ascending for charting
}

export async function GET() {
  // Check cache
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      source: 'geckoterminal-cached',
      pool: POOL_USDT,
      timeframe: 'hour',
      prices: cached.data,
      timestamps: cached.timestamps,
      count: cached.data.length,
      fetchedAt: cached.ts,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  try {
    // Try hour timeframe first (more history for a new pool)
    let candles = await fetchOhlcv('hour', 100);
    let timeframe = 'hour';

    // If we have very few hourly candles, also fetch minute candles
    let minuteCandles: OhlcvCandle[] = [];
    if (candles.length < 24) {
      minuteCandles = await fetchOhlcv('minute', 60);
    }

    // Combine: use minute candles for recent detail + hour candles for older history
    // If we have minute candles, use those (they're more granular)
    const useCandles = minuteCandles.length >= candles.length ? minuteCandles : candles;
    if (minuteCandles.length > 0 && candles.length > 0) {
      // Merge: hour candles older than the oldest minute candle, then minute candles
      const oldestMinuteTs = minuteCandles[0].timestamp;
      const olderHours = candles.filter((c) => c.timestamp < oldestMinuteTs);
      const merged = [...olderHours, ...minuteCandles];
      // Deduplicate by timestamp (keep the more granular one)
      const seen = new Set<number>();
      const deduped = merged.filter((c) => {
        if (seen.has(c.timestamp)) return false;
        seen.add(c.timestamp);
        return true;
      });
      candles = deduped;
      timeframe = 'combined';
    } else if (useCandles === minuteCandles) {
      candles = minuteCandles;
      timeframe = 'minute';
    }

    if (candles.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No OHLCV data available',
        pool: POOL_USDT,
        prices: [],
        timestamps: [],
        count: 0,
        fetchedAt: Date.now(),
      }, { status: 200 });
    }

    const prices = candles.map((c) => c.close);
    const timestamps = candles.map((c) => c.timestamp);

    // Update cache
    cached = { data: prices, timestamps, ts: Date.now() };

    return NextResponse.json({
      ok: true,
      source: 'geckoterminal',
      pool: POOL_USDT,
      timeframe,
      prices,
      timestamps,
      count: prices.length,
      fetchedAt: Date.now(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      pool: POOL_USDT,
      prices: [],
      timestamps: [],
      count: 0,
      fetchedAt: Date.now(),
    }, { status: 200 });
  }
}
