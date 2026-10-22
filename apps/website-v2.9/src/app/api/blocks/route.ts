export const dynamic = 'force-dynamic';
export const maxDuration = 15;

import { NextRequest, NextResponse } from 'next/server';
import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

// ── Found blocks overview ──────────────────────────────────────────────────
// Server-side aggregation of block discoveries across the stack. Sources:
//   • pool /api/v1/blocks  — ZION blocks found by pool miners (loopback API)
//   • sqm.quantus.com squid indexer — QTC blocks authored by our native node
//     (each wormhole reward leaf on the rewards address = one authored block)
// Every upstream call is bounded; each source fails soft and reports its
// availability in `sources` so clients can render honest partial states.

const POOL_API = SITE_PRIMARY_POOL_API_URL.replace(/\/$/, '');
const QTC_INDEXER = process.env.QTC_INDEXER_URL || 'https://sqm.quantus.com/v1/graphql';
// Public chain data (printed in node logs, visible in the indexer).
const QTC_REWARDS_ADDRESS =
  process.env.QTC_REWARDS_ADDRESS || 'qzk8Rna5KBtuqb5g6eEzEVRAsdbpCo5Mhn7k6eggeR4ZVn2aP';

async function poolGet(path: string, timeoutMs = 4000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // /api/* routes are default-deny on the pool — shared server-side key.
    const headers: Record<string, string> = {};
    if (process.env.ZION_POOL_API_KEY) {
      headers['x-api-key'] = process.env.ZION_POOL_API_KEY;
    }
    const res = await fetch(`${POOL_API}${path}`, { cache: 'no-store', signal: ctrl.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function indexer(query: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(QTC_INDEXER, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'zion-app' },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const j = await res.json();
    return j.data || {};
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

const qtc = (v: string | number | null | undefined) => Math.round((Number(v || 0) / 1e12) * 1e6) / 1e6;
const esc = (s: string) => s.replace(/["\\{}]/g, '');

interface NormalizedBlock {
  chain: string;
  kind: 'block' | 'reward';
  height: number | null;
  hash: string | null;
  miner: string | null;
  worker: string | null;
  status: string;
  ts_ms: number | null;
  amount: number | null;
  leaf: number | string | null;
  share_difficulty: number | null;
  network_difficulty: number | null;
  confirmed_at_ms: number | null;
}

export async function GET(req: NextRequest) {
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') || '30', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

  const [poolBlocks, rewards] = await Promise.all([
    poolGet(`/api/v1/blocks?limit=${limit}`),
    QTC_REWARDS_ADDRESS
      ? indexer(
          `{ transfer(where: {to_id: {_eq: "${esc(QTC_REWARDS_ADDRESS)}"}, extrinsic_id: {_is_null: true}}, order_by: {timestamp: desc}, limit: ${limit}) { amount block_height timestamp leaf_index }
             agg: transfer_aggregate(where: {to_id: {_eq: "${esc(QTC_REWARDS_ADDRESS)}"}, extrinsic_id: {_is_null: true}}) { aggregate { count } } }`
        )
      : Promise.resolve({}),
  ]);

  const blocks: NormalizedBlock[] = [];

  // ── ZION pool-found blocks ──
  const poolRows: any[] = Array.isArray(poolBlocks?.blocks) ? poolBlocks.blocks : [];
  for (const b of poolRows) {
    blocks.push({
      chain: 'ZION',
      kind: 'block',
      height: typeof b.height === 'number' ? b.height : null,
      hash: b.hash || null,
      miner: b.miner_id || null,
      worker: b.worker_name || null,
      status: b.status || 'pending',
      ts_ms: typeof b.ts === 'number' ? b.ts * 1000 : null,
      amount: null,
      leaf: null,
      share_difficulty: b.share_difficulty ?? null,
      network_difficulty: b.network_difficulty ?? null,
      confirmed_at_ms: typeof b.confirmed_at === 'number' ? b.confirmed_at * 1000 : null,
    });
  }

  // ── QTC native-node blocks (wormhole reward leaves) ──
  const rwRows: any[] = rewards?.transfer ?? [];
  for (const r of rwRows) {
    const ts = r.timestamp ? Date.parse(r.timestamp) : NaN;
    blocks.push({
      chain: 'QTC',
      kind: 'reward',
      height: typeof r.block_height === 'number' ? r.block_height : null,
      hash: null,
      miner: null,
      worker: null,
      status: 'reward',
      ts_ms: Number.isFinite(ts) ? ts : null,
      amount: qtc(r.amount),
      leaf: r.leaf_index ?? null,
      share_difficulty: null,
      network_difficulty: null,
      confirmed_at_ms: null,
    });
  }

  blocks.sort((a, b) => (b.ts_ms ?? 0) - (a.ts_ms ?? 0));

  const counts = {
    zion: poolRows.length,
    qtc: rewards?.agg?.aggregate?.count ?? rwRows.length,
  };

  return NextResponse.json(
    {
      ok: true,
      ts: Date.now(),
      sources: {
        pool: poolBlocks === null ? 'unavailable' : poolBlocks.ok === false ? 'error' : 'ok',
        indexer: rewards && Object.keys(rewards).length ? 'ok' : 'unavailable',
      },
      counts,
      blocks: blocks.slice(0, limit),
    },
    { headers: { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' } }
  );
}
