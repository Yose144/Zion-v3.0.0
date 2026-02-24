import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Node definitions ─────────────────────────────────────────────── */
// Pool runs only on Helsinki (port 8080). Seed-only nodes get pool: 0 (skipped).
const NODES = [
  { id: 'helsinki', host: '77.42.31.72',    rpc: 8444, pool: 8080 },
  { id: 'usa',      host: '178.156.240.160', rpc: 8444, pool: 0 },
  { id: 'asia',     host: '5.223.43.93',     rpc: 8444, pool: 0 },
];

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
async function fetchNodeData(node: (typeof NODES)[number]) {
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
        network: rpcInfo.mainnet ? 'mainnet' : 'testnet',
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
          version: poolStats.pool?.version ?? 'v2.9.6',
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
  const [helsinki, usa, asia] = await Promise.all(NODES.map(fetchNodeData));

  // 168h stability run — started 2026-02-24T11:48:00Z (3-node P2P verified)
  const STABILITY_START_EPOCH = 1771962480; // unix epoch UTC
  const STABILITY_DURATION = 168 * 3600;   // 604800s = 7 days
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = Math.min(Math.max(0, nowSec - STABILITY_START_EPOCH), STABILITY_DURATION);

  const data = {
    timestamp: new Date().toISOString(),
    stability_run: {
      start: '2026-02-24T11:48:00Z',
      elapsed_secs: elapsed,
      remaining_secs: Math.max(0, STABILITY_DURATION - elapsed),
      duration_secs: STABILITY_DURATION,
      progress_pct: Math.min(100, Math.round((elapsed / STABILITY_DURATION) * 100)),
    },
    helsinki,
    usa,
    asia,
    log_tail: buildLogTail({ helsinki, usa, asia }),
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

function buildLogTail(nodes: { helsinki: NodeResult; usa: NodeResult; asia: NodeResult }) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  const entries = [
    { label: 'HELSINKI    ', data: nodes.helsinki },
    { label: 'USA         ', data: nodes.usa },
    { label: 'ASIA        ', data: nodes.asia },
  ];
  for (const { label, data } of entries) {
    const s = data?.stats;
    if (s) {
      lines.push(`[${now}] [${label}] H:${s.height} D:${s.difficulty} P:${s.peers_connected} STATUS:${s.status}`);
    } else {
      lines.push(`[${now}] [${label}] OFFLINE — unable to reach node`);
    }
  }
  const hp = nodes.helsinki?.pool;
  if (hp) {
    lines.push(`[${now}] [POOL        ] Miners:${hp.miners?.active} Blocks:${hp.blocks?.found} HR:${hp.hashrate?.pool}`);
  }
  return lines.join('\n');
}
