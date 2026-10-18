// Data layer — currently backed by mock data (lib/mock.ts).
// When the pool `/public/v1/*` tier ships (plan §5a), flip USE_MOCK to
// false and the shapes line up 1:1 — no component changes needed.

import * as mock from './mock';
import { BlockRow, CoinId, MinerStats, PayoutRow, PoolOverview } from './types';

const USE_MOCK = true;
const API_BASE = '/api/public/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchOverview(): Promise<PoolOverview> {
  if (USE_MOCK) return mock.poolOverview();
  return get<PoolOverview>('/overview');
}

export async function fetchBlocks(coin?: CoinId): Promise<BlockRow[]> {
  if (USE_MOCK) {
    return mock.BLOCKS.filter((b) => !coin || b.coin === coin);
  }
  return get<BlockRow[]>(`/blocks${coin ? `?coin=${coin}` : ''}`);
}

export async function fetchPayouts(coin?: CoinId): Promise<PayoutRow[]> {
  if (USE_MOCK) {
    return mock.PAYOUTS.filter((p) => !coin || p.coin === coin);
  }
  return get<PayoutRow[]>(`/payouts${coin ? `?coin=${coin}` : ''}`);
}

export async function fetchMiner(
  coin: CoinId,
  wallet: string,
): Promise<MinerStats | null> {
  if (USE_MOCK) {
    return mock.DEMO_MINER[`${coin}:${wallet}`] ?? null;
  }
  try {
    return await get<MinerStats>(`/miner/${coin}/${wallet}`);
  } catch {
    return null;
  }
}
