// Data layer — backed by mock data (lib/mock.ts) until the pool
// `/public/v1/*` tier is live; flip USE_MOCK at deploy.  Static coin
// metadata (name/algorithm/ports/accent) is UI-side: the public API
// deliberately serves only live operational data.

import * as mock from './mock';
import { BlockRow, CoinId, CoinInfo, CoinLeg, CoinStats, MinerStats, PayoutRow, PoolOverview } from './types';

const USE_MOCK = true;
const API_BASE = '/public/v1';

// UI coin id -> pool coin key (`/public/v1` uses pool-side tickers).
const POOL_COIN: Record<CoinId, string> = {
  zion: 'zion',
  qtc: 'qtu',
  prl: 'prl',
  multi: '',
};

// Static connect metadata — displayed on cards/start page; the API's
// /coins payload only carries payout_mode/min_payout/fee_bps + legs.
const COIN_META: Record<string, Omit<CoinInfo, 'id' | 'legs' | 'fee_bps' | 'min_payout' | 'payout_mode'>> = {
  zion: {
    ticker: 'ZION', name: 'ZION TerraNova', algorithm: 'Ekam Deeksha (GPU)',
    port: 3333, tls_port: 3334, dialect: 'ZION native + Stratum v1',
    payout_unit: 'ZION', accent: 'gold',
  },
  qtu: {
    ticker: 'QTC', name: 'Quantus', algorithm: 'QPoW · Poseidon2',
    port: 3334, tls_port: 3335, dialect: 'CryptoNote (SRBMiner / XMRig)',
    payout_unit: 'QTC', accent: 'cyan',
  },
  prl: {
    ticker: 'PRL', name: 'Pearl', algorithm: 'Pearl PoUW · matrix PoW',
    port: 3335, tls_port: 3336, dialect: 'Pearl stratum (SRBMiner ≥3.7.6)',
    payout_unit: 'PRL', accent: 'purple',
  },
};

const UI_ID: Record<string, CoinId> = { zion: 'zion', qtu: 'qtc', prl: 'prl' };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

interface ApiLeg { id: string; kind: 'native' | 'upstream'; enabled: boolean; connected: boolean; job_age_ms: number | null }
interface ApiCoin {
  coin: string; payout_mode: 'native' | 'unified';
  min_payout: string; fee_bps: number; legs: ApiLeg[];
}

function toCoinInfo(c: ApiCoin): CoinInfo | null {
  const meta = COIN_META[c.coin];
  const id = UI_ID[c.coin];
  if (!meta || !id) return null;
  const legs: CoinLeg[] = c.legs.map((l) => ({
    kind: l.kind,
    status: !l.enabled ? 'down' : l.connected ? 'live' : 'sync',
    job_age_ms: l.job_age_ms,
    share_pct: 0,
  }));
  return {
    id,
    ...meta,
    payout_mode: c.payout_mode === 'native' ? 'node-wallet-batch' : 'onchain',
    min_payout: Number(c.min_payout),
    fee_bps: c.fee_bps,
    legs,
  };
}

interface ApiCoinStats {
  coin: string; miners_online: number; active_miners: number;
  shares: { accepted: number; rejected: number };
  window_weight: string; accepted_total: number;
  hashrate: { live: number } | null;
}

function toCoinStats(coin: CoinId, s: ApiCoinStats): CoinStats {
  return {
    coin,
    hashrate: s.hashrate?.live ?? 0,
    miners_online: s.miners_online,
    workers_online: s.miners_online,
    network_hashrate: null,
    network_difficulty: null,
    height: null,
    blocks_24h: 0,
    luck_pct: null,
    shares_1h: s.shares,
  };
}

interface ApiBlock {
  coin: string; height: number; hash: string; ts: number;
  miner: string; status?: string;
}
interface ApiPayout {
  coin: string; ts: number; address: string; amount_flowers?: number;
  tx_id?: string; confirmations?: number; confirmed?: boolean;
}
interface ApiWorker {
  name: string; worker: string; accepted: number; rejected: number;
  last_seen_s: number; hashrate: number | null;
}
interface ApiMiner {
  coin: string; wallet: string; worker_count: number; workers: ApiWorker[];
  shares: { accepted: number; rejected: number };
  unpaid: string; unpaid_unit: string; last_seen_s: number; active: boolean;
}

function toPayoutRow(coin: CoinId, p: ApiPayout): PayoutRow {
  return {
    coin, ts: p.ts, address: p.address,
    amount: Number(p.amount_flowers ?? 0), unit: '',
    tx: p.tx_id ?? '',
    confirmations: p.confirmations ?? 0,
    confirmed: p.confirmed ?? false,
  };
}

export async function fetchOverview(): Promise<PoolOverview> {
  if (USE_MOCK) return mock.poolOverview();
  const { coins } = await get<{ ok: boolean; coins: ApiCoin[] }>('/coins');
  const infos = coins.map(toCoinInfo).filter((c): c is CoinInfo => c !== null);
  const stats: Record<string, CoinStats> = {};
  await Promise.all(
    infos.map(async (c) => {
      try {
        const s = await get<ApiCoinStats>(`/coins/${POOL_COIN[c.id]}/stats`);
        stats[c.id] = toCoinStats(c.id, s);
      } catch { /* stat failures degrade to absent entries */ }
    }),
  );
  return { uptime_s: 0, coins: infos, stats };
}

export async function fetchBlocks(coin?: CoinId): Promise<BlockRow[]> {
  if (USE_MOCK) {
    return mock.BLOCKS.filter((b) => !coin || b.coin === coin);
  }
  const q = coin && POOL_COIN[coin] ? `?coin=${POOL_COIN[coin]}` : '';
  const { blocks } = await get<{ blocks: ApiBlock[] }>(`/blocks${q}`);
  return blocks.map((b) => ({
    coin: UI_ID[b.coin] ?? 'multi',
    height: b.height,
    hash: b.hash,
    ts: b.ts,
    miner: b.miner,
    worker: '',
    status: (b.status as BlockRow['status']) ?? 'confirmed',
    effort_pct: null,
  }));
}

export async function fetchPayouts(coin?: CoinId): Promise<PayoutRow[]> {
  if (USE_MOCK) {
    return mock.PAYOUTS.filter((p) => !coin || p.coin === coin);
  }
  const q = coin && POOL_COIN[coin] ? `?coin=${POOL_COIN[coin]}` : '';
  const { payouts } = await get<{ payouts: ApiPayout[] }>(`/payouts${q}`);
  return payouts.map((p) => toPayoutRow(UI_ID[p.coin] ?? 'multi', p));
}

export async function fetchMiner(
  coin: CoinId,
  wallet: string,
): Promise<MinerStats | null> {
  if (USE_MOCK) {
    return mock.DEMO_MINER[`${coin}:${wallet}`] ?? null;
  }
  const poolCoin = POOL_COIN[coin];
  if (!poolCoin) return null;
  try {
    const m = await get<ApiMiner>(`/miner/${poolCoin}/${wallet}`);
    const { payouts } = await get<{ payouts: ApiPayout[] }>(
      `/miner/${poolCoin}/${wallet}/payouts`,
    );
    const totalPaid = payouts
      .filter((p) => p.confirmed)
      .reduce((sum, p) => sum + Number(p.amount_flowers ?? 0), 0);
    return {
      coin,
      wallet,
      hashrate: m.workers.reduce((s, w) => s + (w.hashrate ?? 0), 0),
      hashrate_history: [],
      workers: m.workers.map((w) => ({
        name: w.name,
        algorithm: COIN_META[poolCoin]?.algorithm ?? '',
        hashrate: w.hashrate ?? 0,
        shares_accepted: w.accepted,
        shares_rejected: w.rejected,
        last_seen: w.last_seen_s,
      })),
      shares_24h: m.shares,
      immature: 0,
      pending: Number(m.unpaid),
      total_paid: totalPaid,
      unit: m.unpaid_unit,
      payouts: payouts.map((p) => toPayoutRow(coin, p)),
    };
  } catch {
    return null;
  }
}
