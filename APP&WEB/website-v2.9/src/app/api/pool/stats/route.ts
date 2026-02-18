import { NextResponse } from 'next/server';

const POOL_SERVERS = [
  { id: 'helsinki', name: 'Helsinki (EU-North)', flag: '🇫🇮', host: '77.42.31.72', port: 8080, stratum: 3333, region: 'eu-north' },
  { id: 'germany', name: 'Germany (EU-Central)', flag: '🇩🇪', host: '195.201.31.201', port: 8080, stratum: 3333, region: 'eu-central' },
];

async function fetchPool(host: string, port: number, endpoint: string, timeout = 4000) {
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

export async function GET() {
  const results = await Promise.all(
    POOL_SERVERS.map(async (srv) => {
      const [stats, miners, blocks] = await Promise.all([
        fetchPool(srv.host, srv.port, '/stats'),
        fetchPool(srv.host, srv.port, '/miners'),
        fetchPool(srv.host, srv.port, '/blocks'),
      ]);
      return {
        ...srv,
        online: !!stats?.ok,
        stats: stats ?? null,
        miners: miners ?? null,
        recentBlocks: blocks?.blocks?.slice(0, 20) ?? [],
      };
    })
  );

  // Aggregate
  const totalHashrate = results.reduce((s, r) => s + (r.stats?.hashrate?.pool ?? 0), 0);
  const totalHashrate24h = results.reduce((s, r) => s + (r.stats?.hashrate?.pool_24h ?? 0), 0);
  const activeMiners = results.reduce((s, r) => s + (r.stats?.miners?.active ?? 0), 0);
  const totalMiners = results.reduce((s, r) => s + (r.stats?.miners?.total ?? 0), 0);
  const blocksFound = results.reduce((s, r) => s + (r.stats?.blocks?.found ?? 0), 0);
  const validShares = results.reduce((s, r) => s + (r.stats?.shares?.valid ?? 0), 0);
  const invalidShares = results.reduce((s, r) => s + (r.stats?.shares?.invalid ?? 0), 0);

  // Merge all miners into a deduplicated list
  const minerMap = new Map<string, { address: string; last_share: number; server: string }>();
  for (const srv of results) {
    for (const m of srv.miners?.miners ?? []) {
      const existing = minerMap.get(m.address);
      if (!existing || m.last_share > existing.last_share) {
        minerMap.set(m.address, { address: m.address, last_share: m.last_share, server: srv.id });
      }
    }
  }

  // Merge all recent blocks, sorted by height desc
  const allBlocks = results
    .flatMap((r) => (r.recentBlocks ?? []).map((b: Record<string, unknown>) => ({ ...b, server: r.id })))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.height as number) - (a.height as number))
    .slice(0, 30);

  // Fee structure (same across all)
  const fee = results.find((r) => r.stats?.pool)?.stats?.pool ?? {};

  return NextResponse.json({
    ok: true,
    timestamp: Date.now(),
    aggregate: {
      hashrate: totalHashrate,
      hashrate_24h: totalHashrate24h,
      active_miners: activeMiners,
      total_miners: totalMiners,
      blocks_found: blocksFound,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      share_efficiency: validShares > 0 ? ((validShares / (validShares + invalidShares)) * 100).toFixed(2) : '0',
    },
    fee: {
      pool_fee: fee.fee ?? 1,
      humanitarian_tithe: fee.humanitarian_tithe ?? 5,
      miner_share: fee.miner_share ?? 89,
      min_payout: fee.min_payout ?? 0.1,
    },
    servers: results,
    miners: Array.from(minerMap.values()).sort((a, b) => b.last_share - a.last_share),
    recent_blocks: allBlocks,
  });
}
