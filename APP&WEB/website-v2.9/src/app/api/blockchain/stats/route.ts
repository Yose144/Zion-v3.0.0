/**
 * ZION Explorer — Blockchain Stats API
 *
 * Returns comprehensive network statistics from daemon RPC + pool API.
 * Direct RPC for accuracy — no more Pool-only estimates.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION, BLOCK_REWARD_ZION } from '@/lib/constants';
import { resolveSupplySnapshot } from '@/lib/supply';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * In-memory response cache — deduplicates concurrent requests and serves
 * stale-while-revalidate for up to CACHE_TTL ms.
 * This is critical because 3+ explorer components all call /blockchain/stats
 * simultaneously on page load and every 15s. Without this, each call triggers
 * 6 parallel RPC requests (getInfo, getLastBlockHeader, getPoolStats, etc).
 */
const CACHE_TTL = 5_000; // 5 seconds
let cachedResponse: { json: any; ts: number } | null = null;
let inFlight: Promise<{ json: any; ts: number }> | null = null;

async function computeStats(): Promise<{ json: any; ts: number }> {
  const rpc = getZionRpc();

  const [info, lastBlock, poolStats, prometheusStats, dbSize, avgBlockTime] = await Promise.all([
    rpc.getInfo().catch(() => null),
    rpc.getLastBlockHeader().catch(() => null),
    rpc.getPoolStats().catch(() => null),
    getPoolStatsFromPrometheus().catch(() => null),
    getNodeDatabaseSize().catch(() => 0),
    rpc.getAverageBlockTime(30).catch(() => 60),
  ]);

  if (!info) {
    throw new Error('Cannot reach any ZION daemon');
  }

  const supply = await resolveSupplySnapshot(rpc, info.height);

  const hashrate = poolStats?.hashrate?.pool || poolStats?.pool_hashrate || prometheusStats?.pool_hashrate || 0;
  const miners   = poolStats?.miners?.active || poolStats?.active_miners || prometheusStats?.active_miners || 0;
  const blocksF  = poolStats?.blocks?.found || poolStats?.blocks_found || prometheusStats?.blocks_found || 0;
  const shares   = poolStats?.shares?.valid || poolStats?.valid_shares || prometheusStats?.valid_shares || 0;

  const stats = {
    block_height: info.height,
    top_block_hash: info.top_block_hash || '',
    difficulty: info.difficulty,
    cumulative_difficulty: info.cumulative_difficulty || 0,
    premine_supply: supply.premineSupply,
    mined_supply: supply.minedSupply,
    circulating_supply: supply.circulatingSupply,
    total_supply: supply.maxSupply,
    max_supply: supply.maxSupply,
    remaining_supply: supply.remainingSupply,
    emission_pct: supply.emissionPct.toFixed(6),
    network_hashrate: info.difficulty / (info.target || 60),
    network_hashrate_formatted: formatHashrate(info.difficulty / (info.target || 60)),
    target_block_time: info.target || 60,
    avg_block_time: avgBlockTime,
    tx_count: info.tx_count || 0,
    tx_pool_size: info.tx_pool_size || 0,
    incoming_connections: info.incoming_connections_count || 0,
    outgoing_connections: info.outgoing_connections_count || 0,
    total_connections: (info.incoming_connections_count || 0) + (info.outgoing_connections_count || 0),
    white_peerlist_size: info.white_peerlist_size || 0,
    grey_peerlist_size: info.grey_peerlist_size || 0,
    block_size_limit: info.block_size_limit || 0,
    block_size_median: info.block_size_median || 0,
    mainnet: info.mainnet ?? true,
    testnet: info.testnet ?? false,
    version: info.version || '',
    status: info.status || 'OK',
    start_time: info.start_time || 0,
    database_size: dbSize || info.database_size || 0,
    alt_blocks_count: info.alt_blocks_count || 0,
    pool_hashrate: hashrate,
    pool_hashrate_formatted: formatHashrate(hashrate),
    active_miners: miners,
    total_miners: poolStats?.miners?.total || poolStats?.total_miners || miners,
    pool_blocks_found: blocksF,
    valid_shares: shares,
    pool_uptime_s: poolStats?.uptime_s || 0,
    pool_pplns_window: poolStats?.pplns_window_size || 0,
    pool_pending_payouts_atomic: poolStats?.payouts?.pending_total_atomic || 0,
    pool_pending_miners: poolStats?.payouts?.pending_miners || 0,
    connected: true,
    last_block: lastBlock ? {
      height: lastBlock.height,
      hash: lastBlock.hash,
      timestamp: lastBlock.timestamp,
      difficulty: lastBlock.difficulty,
      reward: lastBlock.subsidy_zion ?? (lastBlock.reward ? lastBlock.reward / ATOMIC_UNITS_PER_ZION : BLOCK_REWARD_ZION),
      num_txes: lastBlock.num_txes || 0,
      block_size: lastBlock.block_size || 0,
    } : null,
    latest_block: lastBlock ? {
      height: lastBlock.height,
      hash: lastBlock.hash,
      timestamp: lastBlock.timestamp,
    } : null,
    mempool_size: info.tx_pool_size || 0,
    total_blocks: info.height,
    total_transactions: info.tx_count || info.height,
  };

  return { json: stats, ts: Date.now() };
}

/** Try to read the actual LMDB/JSON state file size for database_size */
async function getNodeDatabaseSize(): Promise<number> {
  try {
    const candidates = [
      // Docker volume mount path (production deployment)
      '/app/edge-state.db',
      // Edge server (Edge server) — direct path
      '/root/zion-2.9.6-main/data/edge-state.db',
      // Generic Linux deployment paths
      '/opt/zion/V3/data/zion-node-state.db',
      '/root/V3/data/zion-node-state.db',
      '/workspace/V3/data/zion-node-state.db',
      join(process.cwd(), 'V3/data/zion-node-state.db'),
      join(process.cwd(), '../V3/data/zion-node-state.db'),
      join(process.cwd(), '../../zion-2.9.6-main/data/edge-state.db'),
      '/tmp/zion-node-state.db',
    ];
    for (const p of candidates) {
      const stat = await fs.stat(p).catch(() => null);
      if (stat) return stat.size;
    }
  } catch {}
  return 0;
}

/** Try to get pool stats from Prometheus metrics as fallback */
async function getPoolStatsFromPrometheus(): Promise<any> {
  try {
    const res = await fetch('http://127.0.0.1:9550/metrics', {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split('\n');
    const getGauge = (name: string) => {
      const line = lines.find((l) => l.startsWith(`${name} `));
      return line ? parseFloat(line.split(' ')[1]) : 0;
    };
    return {
      pool_hashrate: getGauge('zion_pool_hashrate_hps'),
      active_miners: getGauge('zion_pool_active_sessions'),
      blocks_found: getGauge('zion_pool_blocks_found_total'),
      valid_shares: getGauge('zion_pool_shares_accepted_total'),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const now = Date.now();

    // Serve from cache if fresh
    if (cachedResponse && now - cachedResponse.ts < CACHE_TTL) {
      return NextResponse.json(cachedResponse.json, {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
      });
    }

    // Deduplicate concurrent requests — if a fetch is in-flight, wait for it
    if (!inFlight) {
      inFlight = computeStats().catch((err) => {
        throw err;
      }).finally(() => {
        // Store successful result in cache
        // (done in the .then below, not here, so errors don't cache)
      });
    }

    try {
      const result = await inFlight;
      cachedResponse = result;
      return NextResponse.json(result.json, {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
      });
    } finally {
      inFlight = null;
    }
  } catch (error) {
    inFlight = null;
    console.error('Failed to fetch blockchain stats:', error);

    // Serve stale cache if available (better than nothing)
    if (cachedResponse) {
      return NextResponse.json(cachedResponse.json, {
        headers: { 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=5' },
      });
    }

    return NextResponse.json(
      {
        block_height: 0, difficulty: 0, premine_supply: 16_280_000_000, mined_supply: 0,
        circulating_supply: 0, total_supply: 144_000_000_000, max_supply: 144_000_000_000,
        remaining_supply: 144_000_000_000,
        network_hashrate: 0, network_hashrate_formatted: 'Offline', tx_count: 0, tx_pool_size: 0,
        total_connections: 0, connected: false, status: 'offline',
        error: 'Failed to connect to ZION daemon',
        total_blocks: 0, total_transactions: 0,
      },
      { status: 503 }
    );
  }
}

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} kH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}
