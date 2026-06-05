export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

const DASHBOARD_URL = coreUrl('dashboard', process.env.DASHBOARD_URL);

interface HistorySample {
  t: number;
  n1_height: number | null;
  n2_height: number | null;
  n1_peers: number | null;
  hashrate: number | null;
  shares_ok: number | null;
  shares_bad: number | null;
  blocks: number | null;
  sessions: number | null;
}

interface HistoryResponse {
  samples: HistorySample[];
}

function buildOfflineMetrics() {
  return {
    chainHeight: 0,
    peerCount: 0,
    mempoolSize: 0,
    blocksAccepted: 0,
    templateHeight: 0,
    templateTxs: 0,
    templateFees: 0,
    poolActiveSessions: 0,
    poolSubmits: 0,
    poolAccepted: 0,
    poolRejected: 0,
    poolAcceptRate: 0,
    poolUptime: 0,
    minerHashrate: 0,
    minerHashrate10s: 0,
    minerHashrate60s: 0,
    minerAccepted: 0,
    minerRejected: 0,
    minerAcceptRate: 0,
    minerSubmitAvgMs: 0,
    minerPoolHeight: 0,
    minerUp: 0,
    groupZionSub: 0,
    groupZionAcc: 0,
    groupRevenueSub: 0,
    groupRevenueAcc: 0,
    groupNclSub: 0,
    groupNclAcc: 0,
    groupAutoSub: 0,
    groupAutoAcc: 0,
    pplnsWindowSize: 0,
    pplnsWindowUsed: 0,
    pplnsMiners: 0,
    pplnsPaid: 0,
    pplnsRounds: 0,
    serverLoad1: 0,
    serverLoad5: 0,
    serverLoad15: 0,
    memTotal: 0,
    memAvail: 0,
    diskTotal: 0,
    diskAvail: 0,
    bootTime: 0,
    coreUp: 0,
    poolUp: 0,
    chain: { height: 0, peers: 0, mempool: 0, tps: 0 },
    pool: { sessions: 0, hashrate_hps: 0, accept_rate_pct: 0, uptime_secs: 0 },
    miner: { hashrate_hps: 0, accepted: 0, rejected: 0, accept_rate_pct: 0 },
    system: { load1: 0, mem_used_gb: 0, mem_total_gb: 0, disk_used_pct: 0 },
    source: 'fallback',
    note: 'Core dashboard offline',
  };
}

export async function GET() {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/history`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Dashboard history error: ${res.status}`);
    const data = (await res.json()) as HistoryResponse;
    const samples = data.samples ?? [];
    const last = samples[samples.length - 1];

    if (!last) {
      return NextResponse.json(buildOfflineMetrics(), {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const totalShares = (last.shares_ok ?? 0) + (last.shares_bad ?? 0);
    const acceptRate = totalShares > 0
      ? Math.round(((last.shares_ok ?? 0) / totalShares) * 100)
      : 0;

    const metrics = {
      chainHeight: last.n1_height ?? 0,
      peerCount: last.n1_peers ?? 0,
      mempoolSize: 0,
      blocksAccepted: last.n1_height ?? 0,
      templateHeight: last.n1_height ?? 0,
      templateTxs: 0,
      templateFees: 0,
      poolActiveSessions: last.sessions ?? 0,
      poolSubmits: totalShares,
      poolAccepted: last.shares_ok ?? 0,
      poolRejected: last.shares_bad ?? 0,
      poolAcceptRate: acceptRate,
      poolUptime: 0,
      minerHashrate: (last.hashrate ?? 0) * 1000,
      minerHashrate10s: (last.hashrate ?? 0) * 1000,
      minerHashrate60s: (last.hashrate ?? 0) * 1000,
      minerAccepted: last.shares_ok ?? 0,
      minerRejected: last.shares_bad ?? 0,
      minerAcceptRate: acceptRate,
      minerSubmitAvgMs: 0,
      minerPoolHeight: last.n1_height ?? 0,
      minerUp: last.hashrate != null && last.hashrate > 0 ? 1 : 0,
      groupZionSub: totalShares,
      groupZionAcc: last.shares_ok ?? 0,
      groupRevenueSub: 0,
      groupRevenueAcc: 0,
      groupNclSub: 0,
      groupNclAcc: 0,
      groupAutoSub: 0,
      groupAutoAcc: 0,
      pplnsWindowSize: 0,
      pplnsWindowUsed: 0,
      pplnsMiners: last.sessions ?? 0,
      pplnsPaid: 0,
      pplnsRounds: 0,
      serverLoad1: 0,
      serverLoad5: 0,
      serverLoad15: 0,
      memTotal: 0,
      memAvail: 0,
      diskTotal: 0,
      diskAvail: 0,
      bootTime: 0,
      coreUp: last.n1_height != null ? 1 : 0,
      poolUp: last.sessions != null ? 1 : 0,
      chain: {
        height: last.n1_height ?? 0,
        peers: last.n1_peers ?? 0,
        mempool: 0,
        tps: 0,
      },
      pool: {
        sessions: last.sessions ?? 0,
        hashrate_hps: (last.hashrate ?? 0) * 1000,
        accept_rate_pct: acceptRate,
        uptime_secs: 0,
      },
      miner: {
        hashrate_hps: (last.hashrate ?? 0) * 1000,
        accepted: last.shares_ok ?? 0,
        rejected: last.shares_bad ?? 0,
        accept_rate_pct: acceptRate,
      },
      system: {
        load1: 0,
        mem_used_gb: 0,
        mem_total_gb: 0,
        disk_used_pct: 0,
      },
    };

    return NextResponse.json(metrics, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json(buildOfflineMetrics(), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
