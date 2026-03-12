import { NextResponse } from 'next/server';
import { SITE_PRIMARY_HOST, SITE_VERSION } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Node definitions ─────────────────────────────────────────────── */
const PRIMARY_NODE = { id: 'primary', host: SITE_PRIMARY_HOST, rpc: 8444, pool: 8080 };
type NodeDefinition = typeof PRIMARY_NODE;

const TIMEOUT = 6_000;

/* ── Helpers ──────────────────────────────────────────────────────── */
async function fetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function rpcCall<T = any>(url: string, method: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '0', method, params: {} }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.result ?? json) as T;
  } catch {
    return null;
  }
}

/* ── Fetch data for a single node ─────────────────────────────────── */
async function fetchNodeData(node: NodeDefinition) {
  const rpcUrl = `http://${node.host}:${node.rpc}/jsonrpc`;
  const [rpcInfo, poolStats] = await Promise.all([
    rpcCall<any>(rpcUrl, 'get_info'),
    node.pool > 0 ? fetchJson<any>(`http://${node.host}:${node.pool}/stats`) : Promise.resolve(null),
  ]);

  const nodeStats = rpcInfo
    ? {
        height: rpcInfo.height ?? 0,
        peers_connected: (rpcInfo.incoming_connections_count ?? 0) + (rpcInfo.outgoing_connections_count ?? 0),
        difficulty: rpcInfo.difficulty ?? 0,
        mempool_size: rpcInfo.tx_pool_size ?? 0,
        status: rpcInfo.status ?? 'OK',
        time_since_last_block: rpcInfo.target ?? 0,
        tip: rpcInfo.top_block_hash ?? '',
        tps: 0,
        sync: { state: rpcInfo.synchronized ? 'synced' : 'syncing' },
        network: `TestNet ${SITE_VERSION}`,
      }
    : undefined;

  const pool = poolStats
    ? {
        ok: true,
        miners: {
          active: poolStats.miners?.active ?? 0,
          total: poolStats.miners?.total ?? 0,
        },
        hashrate: {
          pool: poolStats.hashrate?.pool ?? 0,
          pool_24h: poolStats.hashrate?.pool_24h ?? 0,
        },
        shares: {
          valid: poolStats.shares?.valid ?? 0,
          invalid: poolStats.shares?.invalid ?? 0,
        },
        blocks: {
          found: poolStats.blocks?.found ?? 0,
          pending: poolStats.blocks?.pending ?? 0,
        },
        pool: {
          fee: poolStats.pool?.fee ?? 0,
          version: poolStats.pool?.version ?? SITE_VERSION,
          uptime_secs: poolStats.pool?.uptime_secs ?? 0,
        },
        payouts: {
          pending_miners: poolStats.payouts?.pending_miners ?? 0,
        },
        pplns_window_size: poolStats.pplns_window_size ?? 0,
        blockchain: { connected: poolStats.blockchain?.connected ?? false },
      }
    : undefined;

  return { ip: node.host, stats: nodeStats, pool };
}

/* ── GET handler ───────────────────────────────────────────────── */
export async function GET() {
  const primary = await fetchNodeData(PRIMARY_NODE);

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
