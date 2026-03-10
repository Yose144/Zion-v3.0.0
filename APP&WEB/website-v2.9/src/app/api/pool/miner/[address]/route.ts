import { NextResponse, NextRequest } from 'next/server';
import { SITE_PRIMARY_HOST } from '@/lib/site';

const POOL_SERVERS = [
  { id: 'primary', host: SITE_PRIMARY_HOST, port: 8080 },
];

async function fetchPool(host: string, port: number, endpoint: string, timeout = 5000) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(`http://${host}:${port}${endpoint}`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function extractStatsPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, unknown>;
  // Supported shapes:
  // 1) { ok: true, stats: { ... } }
  // 2) { ...fields }
  const nested = r.stats;
  if (nested && typeof nested === 'object') {
    return nested as Record<string, unknown>;
  }
  return r;
}

function normalizeShareCounters(totalShares: number, validSharesRaw: number, invalidSharesRaw: number) {
  const total = Math.max(0, Math.floor(totalShares));
  let invalid = Math.max(0, Math.floor(invalidSharesRaw));
  let valid = Math.max(0, Math.floor(validSharesRaw));

  // Some pool nodes can leak wrapped u64 values for valid_shares (underflow/overflow symptoms).
  // If valid is clearly out of bounds for this miner record, derive a safe value.
  if (valid > total) {
    valid = Math.max(0, total - invalid);
  }

  // Keep counters coherent.
  if (invalid > total) {
    invalid = Math.max(0, total - valid);
  }

  return { total, valid, invalid };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 10) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }

  // Fetch miner stats + payouts + blocks from all pool servers
  const results = await Promise.all(
    POOL_SERVERS.map(async (srv) => {
      const [stats, payouts, blocks] = await Promise.all([
        fetchPool(srv.host, srv.port, `/api/v1/miner/${address}/stats`),
        fetchPool(srv.host, srv.port, `/api/v1/miner/${address}/payouts`),
        fetchPool(srv.host, srv.port, `/api/v1/blocks/recent/50`),
      ]);
      return { server: srv.id, stats, payouts, blocks };
    })
  );

  // Check if miner exists on any server
  const hasData = results.some((r) => {
    const s = extractStatsPayload(r.stats);
    if (!s) return false;
    if (s.error) return false;
    // Any non-zero signal means miner exists
    return (
      toNum(s.last_share_time) > 0 ||
      toNum(s.total_shares) > 0 ||
      toNum(s.hashrate_1h) > 0 ||
      toNum(s.hashrate_24h) > 0 ||
      toNum(s.blocks_found) > 0 ||
      toNum(s.total_paid) > 0 ||
      toNum(s.pending_balance) > 0
    );
  });
  if (!hasData) {
    return NextResponse.json({ ok: false, error: 'Miner not found', address }, { status: 404 });
  }

  // Aggregate stats across servers
  let totalShares = 0, validShares = 0, invalidShares = 0, blocksFound = 0;
  let hashrate1h = 0, hashrate24h = 0, totalPaid = 0, pendingBalance = 0;
  let lastShareTime = 0;

  for (const r of results) {
    const s = extractStatsPayload(r.stats);
    if (!s || s.error) continue;

    const totalRaw = toNum(s.total_shares);
    const validRaw = toNum(s.valid_shares);
    const invalidRaw = toNum(s.invalid_shares);
    const normalized = normalizeShareCounters(totalRaw, validRaw, invalidRaw);

    totalShares += normalized.total;
    validShares += normalized.valid;
    invalidShares += normalized.invalid;
    blocksFound += toNum(s.blocks_found);
    hashrate1h += toNum(s.hashrate_1h);
    hashrate24h += toNum(s.hashrate_24h);
    totalPaid += toNum(s.total_paid);
    pendingBalance += toNum(s.pending_balance);
    const lst = toNum(s.last_share_time);
    if (lst > lastShareTime) lastShareTime = lst;
  }

  // Merge payouts (dedup by tx_id)
  const payoutMap = new Map<string, Record<string, unknown>>();
  for (const r of results) {
    const payouts = r.payouts?.payouts || r.payouts?.pending_payouts;
    if (!payouts) continue;
    for (const p of payouts) {
      const key = p.tx_id || `${p.amount}-${p.timestamp}`;
      if (!payoutMap.has(key)) payoutMap.set(key, p);
    }
  }

  // Merge blocks found by this miner (deduplicate by height)
  const minerBlocks: Record<string, unknown>[] = [];
  const seenBlockHeights = new Set<number>();
  for (const r of results) {
    if (!r.blocks?.blocks) continue;
    for (const b of r.blocks.blocks) {
      if (b.miner_address === address && !seenBlockHeights.has(b.height as number)) {
        seenBlockHeights.add(b.height as number);
        minerBlocks.push({ ...b, server: r.server });
      }
    }
  }
  minerBlocks.sort((a, b) => (b.height as number) - (a.height as number));

  const efficiency = validShares > 0
    ? ((validShares / (validShares + invalidShares)) * 100).toFixed(2)
    : '0';

  const isActive = (Date.now() / 1000 - lastShareTime) < 600; // Active if share within 10min

  return NextResponse.json({
    ok: true,
    address,
    active: isActive,
    stats: {
      hashrate_1h: hashrate1h,
      hashrate_24h: hashrate24h,
      total_shares: totalShares,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      efficiency,
      blocks_found: blocksFound,
      total_paid: totalPaid,
      pending_balance: pendingBalance,
      last_share_time: lastShareTime,
    },
    payouts: Array.from(payoutMap.values()).sort(
      (a, b) => (b.timestamp as number) - (a.timestamp as number)
    ),
    blocks: minerBlocks.slice(0, 50),
    servers: results.map((r) => ({
      id: r.server,
      connected: !!(extractStatsPayload(r.stats) && !extractStatsPayload(r.stats)?.error),
    })),
  });
}
