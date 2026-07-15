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

  let poolStats: any = null;
  try {
    poolStats = await rpc.getPoolStats();
  } catch { /* pool unreachable */ }

  let info: any = null;
  try {
    info = await rpc.getInfo();
  } catch { /* chain unreachable */ }

  const minersPayload = await fetchPoolApiJson<{
    miners?: Array<{
      address: string;
      worker_name?: string;
      algorithm?: string;
      backend?: string;
      payout_address?: string;
      last_share: number;
      last_seen?: number;
      hashrate?: number;
      hashrate_1h?: number;
      hashrate_24h?: number;
      blocks_found?: number;
      valid_shares?: number;
      invalid_shares?: number;
      pending_balance?: number;
    }>;
  }>('/miners?limit=200');

  const promQueries = [
    'zion_chain_height',
    'zion_pool_active_sessions',
    'zion_pool_submits_total',
    'zion_pool_accepted_total',
    'zion_pool_rejected_total',
    'zion_pool_accept_rate_pct',
    'zion_pool_uptime_seconds',
    'zion_pool_group_submits',
    'zion_pool_group_accepted',
    'zion_template_fees_zion',
    'zion_pplns_registered_miners',
    'zion_pplns_window_size',
    'zion_pplns_window_used',
    'zion_pplns_total_paid_flowers',
    'zion_pplns_payout_rounds',
  ];
  const promResults = await Promise.allSettled(promQueries.map((query) => promQuery(query)));

  const chainHeight = firstMetricValue(promResults, 0) ?? info?.height ?? 0;
  const activeMiners = firstMetricValue(promResults, 1) ?? poolStats?.miners?.active ?? 0;
  const submitsTotal = firstMetricValue(promResults, 2) ?? poolStats?.routing?.submits ?? 0;
  const acceptedTotal = firstMetricValue(promResults, 3) ?? poolStats?.routing?.accepted ?? poolStats?.shares?.valid ?? 0;
  const rejectedTotal = firstMetricValue(promResults, 4) ?? poolStats?.routing?.rejected ?? poolStats?.shares?.invalid ?? 0;
  const acceptRatePct = firstMetricValue(promResults, 5) ?? poolStats?.routing?.accept_rate_pct ?? null;
  const poolUptimeSeconds = firstMetricValue(promResults, 6) ?? poolStats?.uptime_s ?? poolStats?.pool?.uptime_secs ?? 0;
  const templateFeesZion = firstMetricValue(promResults, 9) ?? 0;
  const pplnsRegisteredMiners = firstMetricValue(promResults, 10) ?? poolStats?.miners?.total ?? activeMiners;
  const pplnsWindowSize = firstMetricValue(promResults, 11) ?? poolStats?.pplns_window_size ?? 0;
  const pplnsWindowUsed = firstMetricValue(promResults, 12) ?? 0;
  let pplnsTotalPaidFlowers = firstMetricValue(promResults, 13) ?? poolStats?.payouts?.total_paid_atomic ?? 0;
  // Sanity clamp: pre-hardfork pool servers accumulated total_paid in 12-decimal
  // flowers (1 ZION = 1e12). After the 3.0.3/3.0.5 decimal fork, flowers are 6-decimal (1 ZION = 1e6).
  // Total paid can never exceed MINING_EMISSION (127.22B ZION × 1e6 = 127.22e15).
  // Values above are clearly pre-fork artifacts — divide by 1e6 to convert.
  const MINING_EMISSION_FLOWERS = TOTAL_SUPPLY_ZION * FLOWERS_PER_ZION; // 144e9 × 1e6 = 144e15
  if (pplnsTotalPaidFlowers > MINING_EMISSION_FLOWERS) {
    pplnsTotalPaidFlowers = Math.floor(pplnsTotalPaidFlowers / 1_000_000);
  }
  const pplnsPayoutRounds = firstMetricValue(promResults, 14) ?? 0;

  const validShares = acceptedTotal;
  const invalidShares = rejectedTotal;
  const totalShares = validShares + invalidShares;
  const shareEfficiency = totalShares > 0 ? ((validShares / totalShares) * 100).toFixed(2) : '0';
  const pplnsWindowPct = pplnsWindowSize > 0 ? (pplnsWindowUsed / pplnsWindowSize) * 100 : null;
  const pplnsTotalPaidZion = pplnsTotalPaidFlowers / ATOMIC_UNITS_PER_ZION;
  const networkHashrate = info?.difficulty ? info.difficulty / (info.target || 60) : 0;

  const routing = {
    submits_total: submitsTotal,
    accepted_total: acceptedTotal,
    rejected_total: rejectedTotal,
    accept_rate_pct: acceptRatePct ?? (totalShares > 0 ? (validShares / totalShares) * 100 : 0),
    groups: {
      zion: {
        submits: labeledMetricValue(promResults, 7, 'group', 'zion') ?? 0,
        accepted: labeledMetricValue(promResults, 8, 'group', 'zion') ?? 0,
      },
      revenue: {
        submits: labeledMetricValue(promResults, 7, 'group', 'revenue') ?? 0,
        accepted: labeledMetricValue(promResults, 8, 'group', 'revenue') ?? 0,
      },
      ncl: {
        submits: labeledMetricValue(promResults, 7, 'group', 'ncl') ?? 0,
        accepted: labeledMetricValue(promResults, 8, 'group', 'ncl') ?? 0,
      },
      auto: {
        submits: labeledMetricValue(promResults, 7, 'group', 'auto') ?? 0,
        accepted: labeledMetricValue(promResults, 8, 'group', 'auto') ?? 0,
      },
    },
  };

  let recentBlocks: Array<{
    height: number;
    hash: string;
    difficulty: number;
    reward: number;
    timestamp: number;
    miner_address: string;
    server: string;
  }> = [];
  if (chainHeight > 0) {
    try {
      const startHeight = Math.max(0, chainHeight - 9);
      const endHeight = Math.max(0, chainHeight);
      const headers = await rpc.getBlockHeaders(startHeight, endHeight);
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
    } catch {
      recentBlocks = [];
    }
  }

  // ── Fee wallet on-chain balances (cached 30s) ─────────────────────────────
  // Use a module-level cache to avoid 3+ RPC calls on every request.
  // The getUtxos RPC call is very slow for large wallets, so we skip it here
  // and only fetch the balance.
  const now = Date.now();
  if (feeBalanceCache && (now - feeBalanceCache.timestamp) < FEE_BALANCE_CACHE_TTL_MS) {
    // Cache hit — use cached balances
  } else {
    // Cache miss — fetch fresh balances
    const feeWallets: Array<{ key: string; address: string }> = [
      { key: 'pool', address: POOL_WALLET },
      { key: 'humanitarian', address: HUMANITARIAN_WALLET },
      { key: 'issobella', address: ISSOBELLA_WALLET },
    ].filter((w) => w.address && w.address.startsWith('zion1'));

    const freshBalances: Record<string, { balance_flowers: number; balance_zion: number; utxo_count: number }> = {};
    await Promise.all(feeWallets.map(async (w) => {
      try {
        // Only fetch balance, skip getUtxos (which is very slow for large wallets)
        const res = await rpc.rpcCall<any>('getBalance', { address: w.address });
        const balanceAtomic = Number(res?.balance_flowers ?? res?.balance_atomic ?? 0);
        const balanceZion = typeof res?.balance_zion === 'number'
          ? res.balance_zion
          : balanceAtomic / FLOWERS_PER_ZION;
        freshBalances[w.key] = {
          balance_flowers: balanceAtomic,
          balance_zion: balanceZion,
          utxo_count: 0, // skipped for performance
        };
      } catch {
        freshBalances[w.key] = { balance_flowers: 0, balance_zion: 0, utxo_count: 0 };
      }
    }));
    feeBalanceCache = { data: freshBalances, timestamp: now };
  }
  const feeBalances = feeBalanceCache.data;

  // Burned total: 1% of every block subsidy is permanently destroyed at coinbase.
  const blocksFound = poolStats?.blocks?.found ?? 0;
  const burnedTotalZion = blocksFound > 0
    ? blocksFound * (BLOCK_REWARD_ZION * POOL_FEE_PCT / 100)
    : 0;

  return NextResponse.json({
    ok: !!poolStats || !!info,
    timestamp: Date.now(),
    aggregate: {
      hashrate: poolStats?.hashrate?.pool ?? poolStats?.pool_hashrate ?? 0,
      hashrate_24h: poolStats?.hashrate?.pool_24h ?? poolStats?.pool_hashrate_24h ?? 0,
      active_miners: activeMiners,
      total_miners: pplnsRegisteredMiners,
      blocks_found: poolStats?.blocks?.found ?? 0,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      share_efficiency: shareEfficiency,
      submits_total: submitsTotal,
      accepted_total: acceptedTotal,
      rejected_total: rejectedTotal,
      accept_rate_pct: routing.accept_rate_pct,
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
      registered_miners: pplnsRegisteredMiners,
      window_size: pplnsWindowSize,
      window_used: pplnsWindowUsed,
      window_pct: pplnsWindowPct,
      total_paid_flowers: pplnsTotalPaidFlowers,
      total_paid_zion: pplnsTotalPaidZion,
      payout_rounds: pplnsPayoutRounds,
    },
    runtime: {
      chain_height: chainHeight,
      difficulty: info?.difficulty ?? 0,
      network_hashrate: networkHashrate,
      pool_uptime_seconds: poolUptimeSeconds,
      template_fees_zion: templateFeesZion,
      last_scrape_ts: Math.floor(Date.now() / 1000),
      data_sources: {
        pool_tcp: !!poolStats,
        core_rpc: !!info,
        prometheus: promResults.some((result) => result.status === 'fulfilled'),
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
          difficulty: info?.difficulty ?? 0,
        },
        hashrate: {
          pool: poolStats?.hashrate?.pool ?? poolStats?.pool_hashrate ?? 0,
          pool_1h: poolStats?.hashrate?.pool_1h ?? 0,
          pool_24h: poolStats?.hashrate?.pool_24h ?? poolStats?.pool_hashrate_24h ?? 0,
        },
        miners: {
          active: activeMiners,
          total: pplnsRegisteredMiners,
        },
        shares: {
          valid: validShares,
          invalid: invalidShares,
        },
        blocks: {
          found: poolStats?.blocks?.found ?? 0,
          pending: poolStats?.blocks?.pending ?? 0,
        },
        pool: {
          fee: POOL_FEE_PCT,
          humanitarian_tithe: HUMANITARIAN_TITHE_PCT,
          issobella_fund: ISSOBELLA_FUND_PCT,
          miner_share: MINER_SHARE_PCT,
          version: poolStats?.pool?.version ?? '2.9.9',
          uptime_secs: poolUptimeSeconds,
        },
        pplns_window_size: pplnsWindowSize,
        payouts: {
          pending_miners: poolStats?.payouts?.pending_miners ?? 0,
          pending_total_atomic: poolStats?.payouts?.pending_total_atomic ?? 0,
        },
      },
    }],
    miners: Array.isArray(minersPayload?.miners)
      ? minersPayload.miners.map((miner) => ({
          address: miner.address,
          worker_name: miner.worker_name ?? '',
          algorithm: miner.algorithm ?? '',
          backend: miner.backend ?? '',
          payout_address: miner.payout_address ?? '',
          last_share: miner.last_share,
          last_seen: miner.last_seen ?? 0,
          hashrate: miner.hashrate ?? 0,
          hashrate_1h: miner.hashrate_1h ?? 0,
          hashrate_24h: miner.hashrate_24h ?? 0,
          blocks_found: miner.blocks_found ?? 0,
          valid_shares: miner.valid_shares ?? 0,
          invalid_shares: miner.invalid_shares ?? 0,
          pending_balance: miner.pending_balance ?? 0,
          server: 'primary',
        }))
      : [],
    recent_blocks: recentBlocks,
  });
}
