import { NextResponse } from 'next/server';
import { SITE_VERSION } from '@/lib/site';
import { getZionRpc } from '@/lib/zion-rpc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Fetch data for primary node via V3 TCP RPC ───────────────────── */
async function fetchNodeData() {
  const rpc = getZionRpc();

  let nodeStats: any = undefined;
  let pool: any = undefined;

  try {
    const info = await rpc.getInfo();
    const peerCount = (info.outgoing_connections_count ?? 0) + (info.incoming_connections_count ?? 0);
    nodeStats = {
      height: info.height ?? 0,
      peers_connected: peerCount,
      difficulty: info.difficulty ?? 0,
      mempool_size: info.tx_pool_size ?? 0,
      status: info.status ?? 'OK',
      time_since_last_block: info.target ?? 60,
      tip: info.top_block_hash ?? '',
      tps: 0,
      sync: { state: 'synced' },
      network: `TestNet ${SITE_VERSION}`,
    };
  } catch { /* node unreachable */ }

  try {
    const poolStats = await rpc.getPoolStats();
    if (poolStats) {
      pool = {
        ok: true,
        miners: poolStats.miners ?? { active: 0, total: 0 },
        hashrate: poolStats.hashrate ?? { pool: 0, pool_24h: 0 },
        shares: poolStats.shares ?? { valid: 0, invalid: 0 },
        blocks: poolStats.blocks ?? { found: 0, pending: 0 },
        pool: poolStats.pool ?? { fee: 5, version: SITE_VERSION, uptime_secs: 0 },
        payouts: { pending_miners: 0 },
        pplns_window_size: 0,
        blockchain: { connected: !!nodeStats },
        routing: poolStats.routing ?? null,
      };
    }
  } catch { /* pool unreachable */ }

  return { ip: '', stats: nodeStats, pool };
}

/* ── GET handler ───────────────────────────────────────────────── */
export async function GET() {
  const primary = await fetchNodeData();

  // 168h stability run — started 2026-02-24T11:48:00Z (3-node P2P verified)
  const STABILITY_START_EPOCH = 1771962480; // unix epoch UTC
  const STABILITY_DURATION = 168 * 3600;   // 604800s = 7 days
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = Math.min(Math.max(0, nowSec - STABILITY_START_EPOCH), STABILITY_DURATION);

  // 72h canary run — B-CRIT-02, E-07 validation: started 2026-03-04T06:00:00Z
  const CANARY_START_EPOCH = 1772604000; // 2026-03-04T06:00:00Z UTC
  const CANARY_DURATION = 72 * 3600;    // 259200s = 3 days
  const canaryElapsed = Math.min(Math.max(0, nowSec - CANARY_START_EPOCH), CANARY_DURATION);

  const data = {
    timestamp: new Date().toISOString(),
    stability_run: {
      start: '2026-02-24T11:48:00Z',
      elapsed_secs: elapsed,
      remaining_secs: Math.max(0, STABILITY_DURATION - elapsed),
      duration_secs: STABILITY_DURATION,
      progress_pct: Math.min(100, Math.round((elapsed / STABILITY_DURATION) * 100)),
    },
    canary_run: {
      start: '2026-03-04T06:00:00Z',
      elapsed_secs: canaryElapsed,
      remaining_secs: Math.max(0, CANARY_DURATION - canaryElapsed),
      duration_secs: CANARY_DURATION,
      progress_pct: Math.min(100, Math.round((canaryElapsed / CANARY_DURATION) * 100)),
    },
    current_topology: 'single-primary-host',
    internal_seed_containers: ['zion-seed-1', 'zion-seed-2'],
    seed_containers: ['zion-seed-1', 'zion-seed-2'],
    primary,
    log_tail: buildLogTail({ primary }),
  };

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://zionterranova.com',
    },
  });
}

/* ── Build monitoring log from live data ────────────────────────── */
type NodeResult = Awaited<ReturnType<typeof fetchNodeData>> | undefined;

function buildLogTail(nodes: { primary: NodeResult }) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  const entries = [{ label: 'PRIMARY     ', data: nodes.primary }];
  for (const { label, data } of entries) {
    const s = data?.stats;
    if (s) {
      lines.push(`[${now}] [${label}] H:${s.height} D:${s.difficulty} P:${s.peers_connected} STATUS:${s.status}`);
    } else {
      lines.push(`[${now}] [${label}] OFFLINE — unable to reach node`);
    }
  }
  const hp = nodes.primary?.pool;
  if (hp) {
    lines.push(`[${now}] [POOL        ] Miners:${hp.miners?.active} Blocks:${hp.blocks?.found} HR:${hp.hashrate?.pool}`);
  }
  lines.push(`[${now}] [SEEDS       ] Internal seed containers: zion-seed-1, zion-seed-2`);
  return lines.join('\n');
}
