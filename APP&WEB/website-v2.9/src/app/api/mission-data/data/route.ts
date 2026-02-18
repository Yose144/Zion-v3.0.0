import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Node definitions ─────────────────────────────────────────────── */
const NODES = [
  { id: 'helsinki', host: '77.42.31.72', rpc: 8444, pool: 8080 },
  { id: 'germany', host: '195.201.31.201', rpc: 8444, pool: 8080 },
] as const;

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
async function fetchNodeData(node: typeof NODES[number]) {
  const [stats, poolStats] = await Promise.all([
    fetchJson<any>(`http://${node.host}:${node.rpc}/stats`),
    fetchJson<any>(`http://${node.host}:${node.pool}/stats`),
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

/* ── GET handler ──────────────────────────────────────────────────── */
export async function GET() {
  const [helsinki, germany] = await Promise.all(NODES.map(fetchNodeData));

  // Build stability run from uptime data
  const poolUptime = helsinki?.pool?.pool?.uptime_secs ?? germany?.pool?.pool?.uptime_secs ?? 0;
  const STABILITY_DURATION = 72 * 3600; // 72 hours
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
    germany,
    log_tail: buildLogTail(helsinki, germany),
  };

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://zionterranova.com',
    },
  });
}

/* ── Build a fake monitoring log from live data ───────────────────── */
function buildLogTail(
  helsinki: Awaited<ReturnType<typeof fetchNodeData>> | undefined,
  germany: Awaited<ReturnType<typeof fetchNodeData>> | undefined,
) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  const hs = helsinki?.stats;
  const gs = germany?.stats;
  const hp = helsinki?.pool;

  if (hs) {
    lines.push(`[${now}] [HELSINKI] H:${hs.height} D:${hs.difficulty} P:${hs.peers_connected} STATUS:${hs.status}`);
  } else {
    lines.push(`[${now}] [HELSINKI] OFFLINE — unable to reach node`);
  }
  if (gs) {
    lines.push(`[${now}] [GERMANY]  H:${gs.height} D:${gs.difficulty} P:${gs.peers_connected} STATUS:${gs.status}`);
  } else {
    lines.push(`[${now}] [GERMANY]  OFFLINE — unable to reach node`);
  }
  if (hs && gs) {
    const synced = hs.height === gs.height && hs.tip === gs.tip;
    lines.push(`[${now}] [SYNC]     ${synced ? '✓ Nodes synchronized' : `⚠ Height diff: ${Math.abs(hs.height - gs.height)}`}`);
  }
  if (hp) {
    lines.push(`[${now}] [POOL]     Miners:${hp.miners?.active} Blocks:${hp.blocks?.found} HR:${hp.hashrate?.pool}`);
  }

  return lines.join('\n');
}
