import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import {
  ATOMIC_UNITS_PER_ZION,
  HUMANITARIAN_TITHE_PCT,
  HUMANITARIAN_WALLET,
  ISSOBELLA_FUND_PCT,
  ISSOBELLA_WALLET,
  MINER_SHARE_PCT,
  POOL_FEE_PCT,
  POOL_FEE_WALLET,
} from '@/lib/constants';
import { SITE_PRIMARY_HOST, SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090';

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

  const minersPayload = await fetchPoolApiJson<{ miners?: Array<{ address: string; last_share: number }> }>('/miners?limit=200');

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
  const pplnsTotalPaidFlowers = firstMetricValue(promResults, 13) ?? poolStats?.payouts?.pending_total_atomic ?? 0;
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
      const startHeight = Math.max(0, chainHeight - 10);
      const endHeight = Math.max(0, chainHeight - 1);
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
      name: 'Edge VPS',
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
          last_share: miner.last_share,
          server: 'primary',
        }))
      : [],
    recent_blocks: recentBlocks,
  });
}
