/**
 * Shared miner leaderboard helpers.
 */

import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';
import { getZionRpc } from '@/lib/zion-rpc';
import { KNOWN_ADDRESS_MAP } from '@/lib/explorer/known-addresses';
import { formatHashrate } from '@/lib/explorer/format';

export interface PoolMinerRaw {
  payout_address?: string;
  address?: string;
  worker_name?: string;
  worker?: string;
  miner_id?: string;
  hashrate?: number;
  hashrate_hps?: number;
  hashrate_1h?: number;
  hashrate_1h_hps?: number;
  hashrate_24h?: number;
  hashrate_24h_hps?: number;
  valid_shares?: number;
  accepted_shares?: number;
  invalid_shares?: number;
  rejected_shares?: number;
  blocks_found?: number;
  paid_total_atomic?: number;
  total_paid_flowers?: number;
  paid_total?: number;
  pending_balance?: number;
  last_seen?: number;
  last_seen_s?: number;
  first_seen_s?: number;
}

export interface MinerEntry {
  rank: number;
  address: string;
  worker_name?: string;
  hashrate: number;
  hashrate_formatted: string;
  hashrate_1h?: number;
  hashrate_1h_formatted?: string;
  hashrate_24h?: number;
  hashrate_24h_formatted?: string;
  shares_accepted: number;
  shares_rejected: number;
  blocks_found: number;
  paid: number;
  pending: number;
  last_seen: number;
  type: 'pool' | 'solo';
  label?: string | null;
  efficiency_pct: number;
  balance: number;
}

export interface MinersLeaderboard {
  miners: MinerEntry[];
  total_hashrate: number;
  total_hashrate_formatted: string;
  active_miners: number;
  blocks_found: number;
  total_shares: number;
  fetched_at: number;
}

export async function fetchMinersFromPool(): Promise<PoolMinerRaw[]> {
  // Try live telemetry first; fall back to persistent share-store history.
  const endpoints = [`${SITE_PRIMARY_POOL_API_URL}/miners?limit=500`, `${SITE_PRIMARY_POOL_API_URL}/api/v1/miners?limit=500`];
  const results: PoolMinerRaw[] = [];
  const seen = new Set<string>();

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json() as any;
      if (!data.ok || !Array.isArray(data.miners)) continue;

      for (const m of data.miners as PoolMinerRaw[]) {
        const id = m.miner_id || `${m.address || m.payout_address || 'unknown'}.${m.worker_name || 'default'}`;
        if (seen.has(id)) continue;
        seen.add(id);
        // Normalize persistent-miner shape to telemetry shape.
        if (!m.payout_address && !m.address && m.miner_id) {
          const [addr, worker] = m.miner_id.split('.');
          m.address = addr;
          m.worker_name = worker || 'default';
          m.paid_total_atomic = m.total_paid_flowers;
          m.valid_shares = m.accepted_shares;
          m.invalid_shares = m.rejected_shares;
          m.last_seen = m.last_seen_s;
        }
        results.push(m);
      }
    } catch {
      /* try next endpoint */
    }
  }

  return results;
}

export async function buildMinersLeaderboard(): Promise<MinersLeaderboard> {
  const rawMiners = await fetchMinersFromPool();

  if (rawMiners.length === 0) {
    return {
      miners: [],
      total_hashrate: 0,
      total_hashrate_formatted: formatHashrate(0),
      active_miners: 0,
      blocks_found: 0,
      total_shares: 0,
      fetched_at: Date.now(),
    };
  }

  const rpc = getZionRpc();
  const byAddress = new Map<string, MinerEntry>();

  for (const m of rawMiners) {
    const addr = m.payout_address || m.address || '';
    if (!addr || !addr.startsWith('zion1')) continue;

    const existing = byAddress.get(addr);
    const currentHps = Number(m.hashrate_hps ?? m.hashrate ?? 0);
    const h1Hps = Number(m.hashrate_1h_hps ?? m.hashrate_1h ?? 0);
    const h24Hps = Number(m.hashrate_24h_hps ?? m.hashrate_24h ?? 0);
    const hashrate = Math.max(existing?.hashrate || 0, currentHps || h1Hps || h24Hps);
    const hashrate1h = Math.max(existing?.hashrate_1h || 0, h1Hps);
    const hashrate24h = Math.max(existing?.hashrate_24h || 0, h24Hps);
    const accepted = (existing?.shares_accepted || 0) + Number(m.valid_shares || 0);
    const rejected = (existing?.shares_rejected || 0) + Number(m.invalid_shares || 0);
    const blocks = (existing?.blocks_found || 0) + Number(m.blocks_found || 0);
    const paid = (existing?.paid || 0) + Number(m.paid_total_atomic || m.paid_total || 0) / 1_000_000;
    const pending = (existing?.pending || 0) + Number(m.pending_balance || 0) / 1_000_000;
    const lastSeen = Math.max(existing?.last_seen || 0, Number(m.last_seen || 0));

    byAddress.set(addr, {
      rank: 0,
      address: addr,
      worker_name: m.worker_name || existing?.worker_name,
      hashrate,
      hashrate_formatted: formatHashrate(hashrate),
      hashrate_1h: hashrate1h,
      hashrate_1h_formatted: formatHashrate(hashrate1h),
      hashrate_24h: hashrate24h,
      hashrate_24h_formatted: formatHashrate(hashrate24h),
      shares_accepted: accepted,
      shares_rejected: rejected,
      blocks_found: blocks,
      paid,
      pending,
      last_seen: lastSeen,
      type: 'solo',
      label: null,
      efficiency_pct: accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : 100,
      balance: 0,
    });
  }

  // Enrich with on-chain balance
  await Promise.all(
    Array.from(byAddress.values()).map(async (entry) => {
      try {
        const bal = await rpc.getAddressBalance(entry.address);
        entry.balance = bal?.balance_zion || 0;
      } catch {
        entry.balance = 0;
      }
    })
  );

  // Mark known pool addresses
  for (const entry of byAddress.values()) {
    const known = KNOWN_ADDRESS_MAP.get(entry.address);
    if (known?.type === 'pool') {
      entry.type = 'pool';
      entry.label = known.label;
    }
    // Treat high hashrate as pool-ish if multiple workers but no known label
    if (!entry.label && entry.hashrate > 1_000_000 && entry.shares_accepted > 1000) {
      entry.type = 'pool';
    }
  }

  const miners = Array.from(byAddress.values())
    .sort((a, b) => b.hashrate - a.hashrate)
    .slice(0, 100)
    .map((m, i) => ({ ...m, rank: i + 1 }));

  const totalHashrate = miners.reduce((sum, m) => sum + m.hashrate, 0);
  const blocksFound = miners.reduce((sum, m) => sum + m.blocks_found, 0);
  const totalShares = miners.reduce((sum, m) => sum + m.shares_accepted, 0);

  return {
    miners,
    total_hashrate: totalHashrate,
    total_hashrate_formatted: formatHashrate(totalHashrate),
    active_miners: miners.length,
    blocks_found: blocksFound,
    total_shares: totalShares,
    fetched_at: Date.now(),
  };
}
