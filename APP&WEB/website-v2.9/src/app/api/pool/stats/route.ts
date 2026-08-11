import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import {
  ATOMIC_UNITS_PER_ZION,
  BLOCK_REWARD_ZION,
  FLOWERS_PER_ZION,
  HUMANITARIAN_TITHE_PCT,
  HUMANITARIAN_WALLET,
  ISSOBELLA_FUND_PCT,
  ISSOBELLA_WALLET,
  MINER_SHARE_PCT,
  POOL_FEE_PCT,
  POOL_FEE_WALLET,
  POOL_WALLET,
  TOTAL_SUPPLY_ZION,
} from '@/lib/constants';
import { SITE_PRIMARY_HOST, SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090';

// ── In-memory cache for fee wallet balances (30s TTL) ───────────────────────
// Avoids 3+ RPC calls on every /api/pool/stats request.
interface FeeBalanceCache {
  data: Record<string, { balance_flowers: number; balance_zion: number; utxo_count: number }>;
  timestamp: number;
}
let feeBalanceCache: FeeBalanceCache | null = null;
const FEE_BALANCE_CACHE_TTL_MS = 30_000;

interface PromResult {
  metric: Record<string, string>;
  value: [number, string];
}

async function promQuery(query: string): Promise<PromResult[]> {
  const response = await fetch(
    `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!response.ok) {
    throw new Error(`Prometheus query failed: ${query}`);
  }

  const payload = await response.json();
  return payload?.data?.result ?? [];
}

async function fetchPoolApiJson<T = any>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${SITE_PRIMARY_POOL_API_URL}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as T;
  } catch {
    return null;
  }
}

function firstMetricValue(results: PromiseSettledResult<PromResult[]>[], index: number): number | null {
  const result = results[index];
  if (result?.status !== 'fulfilled') {
    return null;
  }

  const first = result.value[0];
  if (!first) {
    return null;
  }

  return Number.parseFloat(first.value[1] ?? '');
}

function labeledMetricValue(
  results: PromiseSettledResult<PromResult[]>[],
  index: number,
  label: string,
  value: string,
): number | null {
  const result = results[index];
  if (result?.status !== 'fulfilled') {
    return null;
  }

  for (const metric of result.value) {
    if (metric.metric[label] === value) {
      return Number.parseFloat(metric.value[1] ?? '');
    }
  }

  return null;
}

export async function GET() {
  const rpc = getZionRpc();

  const poolStats = await rpc.getPoolStats();

  let info: any = null;
  try {
    info = await rpc.getInfo();
  } catch { /* chain unreachable */ }

  const chainHeight = info?.height ?? poolStats?.runtime?.chain_height ?? 0;
  const difficulty = info?.difficulty ?? 0;
  const networkHashrate = info?.difficulty ? info.difficulty / (info.target || 60) : 0;
  const poolHashrate = poolStats?.hashrate?.pool ?? 0;
  const poolHashrate1h = poolStats?.hashrate?.pool_1h ?? 0;
  const poolHashrate24h = poolStats?.hashrate?.pool_24h ?? 0;
  const activeMiners = poolStats?.miners?.active ?? 0;
  const totalMiners = poolStats?.miners?.total ?? activeMiners;
  const validShares = poolStats?.shares?.valid ?? 0;
  const invalidShares = poolStats?.shares?.invalid ?? 0;
  const totalShares = validShares + invalidShares;
  const shareEfficiency = totalShares > 0 ? ((validShares / totalShares) * 100).toFixed(2) : '0';
  const acceptRatePct = totalShares > 0 ? (validShares / totalShares) * 100 : 0;
  const blocksFound = poolStats?.blocks?.found ?? 0;
  const uptimeSeconds = poolStats?.uptime_s ?? 0;
  const pplnsWindowSize = poolStats?.pplns_window_size ?? 0;
  const pplnsWindowUsed = poolStats?.pplns?.window_used ?? 0;
  const pplnsWindowPct = pplnsWindowSize > 0 ? (pplnsWindowUsed / pplnsWindowSize) * 100 : null;
  const pplnsTotalPaidFlowers = Number(poolStats?.pplns?.total_paid_flowers ?? poolStats?.payouts?.pending_total_atomic ?? 0);
  const pplnsTotalPaidZion = pplnsTotalPaidFlowers / ATOMIC_UNITS_PER_ZION;
  const pplnsPayoutRounds = poolStats?.pplns?.payout_rounds ?? 0;
  const routing = poolStats?.routing ?? { submits: 0, accepted: 0, rejected: 0, accept_rate_pct: 0, groups: {}, sources: {} };

  // Map miners from pool telemetry to frontend shape
  const miners = Array.isArray(poolStats?.miners_list)
    ? poolStats.miners_list.map((m: any) => ({
        address: m.address || m.miner_id || '',
        worker_name: m.worker || m.worker_name || 'default',
        algorithm: m.algorithm || '',
        backend: m.backend || '',
        payout_address: m.address || m.miner_id || '',
        last_share: m.last_share_time ?? 0,
        last_seen: m.last_seen_s ?? m.last_share_time ?? 0,
        hashrate: m.hashrate_hps ?? 0,
        hashrate_1h: m.hashrate_1h_hps ?? 0,
        hashrate_24h: m.hashrate_24h_hps ?? 0,
        blocks_found: m.blocks_found ?? 0,
        valid_shares: m.valid_shares ?? 0,
        invalid_shares: m.invalid_shares ?? 0,
        pending_balance: 0,
      }))
    : [];

  // Recent network blocks
  let recentBlocks: any[] = [];
  if (chainHeight > 0) {
    try {
      const startHeight = Math.max(0, chainHeight - 9);
      const headers = await rpc.getBlockHeaders(startHeight, chainHeight);
      recentBlocks = headers
        .slice()
        .reverse()
        .map((header) => ({
          height: header.height,
          hash: header.hash,
          difficulty: header.difficulty,
          reward: header.reward,
          timestamp: header.timestamp,
          miner_address: header.miner_address ?? '',
          server: 'primary',
        }));
    } catch { /* ignore */ }
  }

  // Fee wallet on-chain balances (cached 30s)
  const now = Date.now();
  if (!feeBalanceCache || (now - feeBalanceCache.timestamp) >= FEE_BALANCE_CACHE_TTL_MS) {
    const feeWallets = [
      { key: 'pool', address: POOL_WALLET },
      { key: 'humanitarian', address: HUMANITARIAN_WALLET },
      { key: 'issobella', address: ISSOBELLA_WALLET },
    ].filter((w) => w.address && w.address.startsWith('zion1'));

    const freshBalances: Record<string, { balance_flowers: number; balance_zion: number; utxo_count: number }> = {};
    await Promise.all(feeWallets.map(async (w) => {
      try {
        const bal = await rpc.getAddressBalance(w.address);
        freshBalances[w.key] = {
          balance_flowers: bal.balance_atomic,
          balance_zion: bal.balance_zion,
          utxo_count: bal.utxo_count,
        };
      } catch {
        freshBalances[w.key] = { balance_flowers: 0, balance_zion: 0, utxo_count: 0 };
      }
    }));
    feeBalanceCache = { data: freshBalances, timestamp: now };
  }
  const feeBalances = feeBalanceCache.data;

  // Burned total: 1% of every block subsidy is permanently destroyed at coinbase.
  const burnedTotalZion = blocksFound > 0
    ? blocksFound * (BLOCK_REWARD_ZION * POOL_FEE_PCT / 100)
    : 0;

  return NextResponse.json({
    ok: !!poolStats || !!info,
    timestamp: Date.now(),
    aggregate: {
      hashrate: poolHashrate,
      hashrate_24h: poolHashrate24h,
      active_miners: activeMiners,
      total_miners: totalMiners,
      blocks_found: blocksFound,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      share_efficiency: shareEfficiency,
      submits_total: totalShares,
      accepted_total: validShares,
      rejected_total: invalidShares,
      accept_rate_pct: acceptRatePct,
    },
    fee: {
      pool_fee: POOL_FEE_PCT,
      humanitarian_tithe: HUMANITARIAN_TITHE_PCT,
      issobella_fund: ISSOBELLA_FUND_PCT,
      miner_share: MINER_SHARE_PCT,
      min_payout: 0.1,
      humanitarian_wallet: HUMANITARIAN_WALLET,
      issobella_wallet: ISSOBELLA_WALLET,
      pool_fee_wallet: POOL_FEE_WALLET,
      pool_wallet: POOL_WALLET,
      burned_total_zion: burnedTotalZion,
      balances: feeBalances,
    },
    routing,
    pplns: {
      registered_miners: totalMiners,
      window_size: pplnsWindowSize,
      window_used: pplnsWindowUsed,
      window_pct: pplnsWindowPct,
      total_paid_flowers: pplnsTotalPaidFlowers,
      total_paid_zion: pplnsTotalPaidZion,
      payout_rounds: pplnsPayoutRounds,
    },
    profit_switcher: null,
    runtime: {
      chain_height: chainHeight,
      difficulty,
      network_hashrate: networkHashrate,
      pool_uptime_seconds: uptimeSeconds,
      template_fees_zion: 0,
      last_scrape_ts: Math.floor(Date.now() / 1000),
      data_sources: {
        pool_tcp: !!poolStats,
        core_rpc: !!info,
        prometheus: true,
      },
    },
    servers: [{
      id: 'primary',
      name: 'Edge server',
      flag: '🇨🇿',
      host: SITE_PRIMARY_HOST,
      region: 'primary',
      stratum: 8444,
      online: !!poolStats || !!info,
      stats: {
        ...poolStats,
        blockchain: {
          connected: !!info,
          height: chainHeight,
          difficulty,
        },
        hashrate: {
          pool: poolHashrate,
          pool_1h: poolHashrate1h,
          pool_24h: poolHashrate24h,
        },
        miners: {
          active: activeMiners,
          total: totalMiners,
        },
        shares: {
          valid: validShares,
          invalid: invalidShares,
        },
        blocks: {
          found: blocksFound,
          pending: 0,
        },
        pool: {
          fee: POOL_FEE_PCT,
          humanitarian_tithe: HUMANITARIAN_TITHE_PCT,
          issobella_fund: ISSOBELLA_FUND_PCT,
          miner_share: MINER_SHARE_PCT,
          version: poolStats?.pool?.version ?? '3.1.0',
          uptime_secs: uptimeSeconds,
        },
        pplns_window_size: pplnsWindowSize,
        payouts: {
          pending_miners: 0,
          pending_total_atomic: 0,
        },
      },
    }],
    miners,
    recent_blocks: recentBlocks,
  });
}
