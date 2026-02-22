import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Node definitions ─────────────────────────────────────────────── */
// Pool runs only on Helsinki (port 8080). Seed-only nodes get pool: 0 (skipped).
const NODES = [
  { id: 'helsinki', host: '77.42.31.72',    rpc: 8444, pool: 8080 },
  { id: 'seedde',  host: '46.225.126.243',  rpc: 8444, pool: 0 },
  { id: 'usa1',    host: '5.78.178.227',    rpc: 8444, pool: 0 },
  { id: 'usa2',    host: '178.156.240.160', rpc: 8444, pool: 0 },
  { id: 'asia3',   host: '5.223.43.93',     rpc: 8444, pool: 0 },
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
  const [stats, poolStats] = await Promise.all([
    fetchJson<any>(`http://${node.host}:${node.rpc}/stats`),
    node.pool > 0 ? fetchJson<any>(`http://${node.host}:${node.pool}/stats`) : Promise.resolve(null),
  ]);

  const nodeStats = stats
    ? {
        height: stats.height ?? 0,
        peers_connected: stats.peers_connected ?? 0,
        difficulty: stats.difficulty ?? 0,
        mempool_size: stats.mempool_size ?? 0,
        status: stats.status ?? 'unknown',
        time_since_last_block: stats.time_since_last_block ?? 0,
        tip: stats.tip ?? '',
        tps: stats.tps ?? 0,
        sync: stats.sync ?? { state: 'unknown' },
        network: stats.network ?? 'testnet',
      }
    : undefined;

  const pool = poolStats
    ? {
        ok: true,
        miners: {
          active: poolStats.miners_active ?? poolStats.miners?.active ?? 0,
          total: poolStats.miners_total ?? poolStats.miners?.total ?? 0,
        },
        hashrate: {
          pool: poolStats.pool_hashrate ?? poolStats.hashrate?.pool ?? 0,
          pool_24h: poolStats.pool_hashrate_24h ?? poolStats.hashrate?.pool_24h ?? 0,
        },
        shares: {
          valid: poolStats.shares_valid ?? poolStats.shares?.valid ?? 0,
          invalid: poolStats.shares_invalid ?? poolStats.shares?.invalid ?? 0,
        },
        blocks: {
          found: poolStats.blocks_found ?? poolStats.blocks?.found ?? 0,
          pending: poolStats.blocks_pending ?? poolStats.blocks?.pending ?? 0,
        },
        pool: {
          fee: poolStats.pool_fee ?? poolStats.fee ?? 0,
          version: poolStats.version ?? 'v2.9.6',
          uptime_secs: poolStats.uptime_secs ?? poolStats.pool_uptime ?? 0,
        },
        payouts: {
          pending_miners: poolStats.pending_payouts ?? poolStats.payouts?.pending_miners ?? 0,
        },
        pplns_window_size: poolStats.pplns_window ?? 0,
        blockchain: { connected: !!stats },
      }
    : undefined;

  return { ip: node.host, stats: nodeStats, pool };
}

/* ── GET handler ───────────────────────────────────────────────── */
export async function GET() {
  const [helsinki, seedde, usa1, usa2, asia3] = await Promise.all(NODES.map(fetchNodeData));

  const poolUptime = helsinki?.pool?.pool?.uptime_secs ?? 0;
  const STABILITY_DURATION = 168 * 3600; // 168h = 7 days
  const elapsed = Math.min(poolUptime, STABILITY_DURATION);

  const data = {
    timestamp: new Date().toISOString(),
    stability_run: {
      start: new Date(Date.now() - elapsed * 1000).toISOString(),
      elapsed_secs: elapsed,
      remaining_secs: Math.max(0, STABILITY_DURATION - elapsed),
      duration_secs: STABILITY_DURATION,
      progress_pct: Math.min(100, Math.round((elapsed / STABILITY_DURATION) * 100)),
    },
    helsinki,
    seedde,
    usa1,
    usa2,
    asia3,
    log_tail: buildLogTail({ helsinki, seedde, usa1, usa2, asia3 }),
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

function buildLogTail(nodes: { helsinki: NodeResult; seedde: NodeResult; usa1: NodeResult; usa2: NodeResult; asia3: NodeResult }) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  const entries = [
    { label: 'HELSINKI    ', data: nodes.helsinki },
    { label: 'SEEDDE      ', data: nodes.seedde },
    { label: 'USA1        ', data: nodes.usa1 },
    { label: 'USA2        ', data: nodes.usa2 },
    { label: 'ASIA3       ', data: nodes.asia3 },
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
