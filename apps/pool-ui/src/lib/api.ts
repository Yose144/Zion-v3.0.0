// Data layer — backed by mock data (lib/mock.ts) until the pool
// `/public/v1/*` tier is live; flip USE_MOCK at deploy.  Static coin
// metadata (name/algorithm/ports/accent) is UI-side: the public API
// deliberately serves only live operational data.

import * as mock from './mock';
import { BlockRow, CoinId, CoinInfo, CoinLeg, CoinStats, FeeSplit, MinerStats, PayoutRow, PayoutStatus, PoolOverview } from './types';

const USE_MOCK = false;
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
  // All coins share the multiplexed stratum: stratum+tcp://…:8444 (plaintext)
  // and stratum+ssl://…:8445 (TLS).  The dialect below is how each coin is
  // authenticated on that listener.
  zion: {
    ticker: 'ZION', name: 'ZION TerraNova', algorithm: 'Ekam Deeksha (GPU)',
    port: 8444, tls_port: 8445, dialect: 'ZION native + Stratum v1',
    payout_unit: 'ZION', accent: 'gold',
  },
  qtu: {
    ticker: 'QTC', name: 'Quantus', algorithm: 'QPoW · Poseidon2',
    port: 8444, tls_port: 8445, dialect: 'CryptoNote (SRBMiner / XMRig)',
    payout_unit: 'QTC', accent: 'cyan',
  },
  prl: {
    ticker: 'PRL', name: 'Pearl', algorithm: 'Pearl PoUW · matrix PoW',
    port: 8444, tls_port: 8445, dialect: 'Pearl stratum (SRBMiner ≥3.7.6)',
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
  miner: string; status?: string; worker_name?: string;
  network_difficulty?: number; share_difficulty?: number; confirmed_at?: number | null;
}
interface ApiPayout {
  coin: string; ts: number | null; address: string; amount_flowers?: number;
  tx_id?: string; confirmations?: number; confirmed?: boolean; status?: string;
}
interface ApiWorker {
  name: string; worker: string; accepted: number; rejected: number;
  last_seen_s: number; hashrate: number | null;
}
interface ApiMiner {
  coin: string; wallet: string; worker_count: number; workers: ApiWorker[];
  shares: { accepted: number; rejected: number };
  unpaid: string; unpaid_unit: string; last_seen_s: number; active: boolean;
  window_share: number; est_daily: number | null; est_per_block: number | null;
  min_payout?: string; payout_eta_s?: number | null;
}

// ZION base unit: 1 ZION = 1e6 flowers. Other coins' `native` amounts are
// rendered as-is with the coin ticker — their base-unit scale is coin-specific
// and the public API doesn't publish decimals.
const FLOWERS = 1e6;
const UNIT_LABEL: Record<CoinId, string> = { zion: 'ZION', qtc: 'QTC', prl: 'PRL', multi: '' };

function normalizeAmount(coin: CoinId, raw: number, unit: string): { amount: number; unit: string } {
  if (unit === 'flowers' || coin === 'zion') return { amount: raw / FLOWERS, unit: 'ZION' };
  return { amount: raw, unit: unit === 'native' ? UNIT_LABEL[coin] || unit : unit };
}

function toPayoutRow(coin: CoinId, p: ApiPayout): PayoutRow {
  const { amount, unit } = normalizeAmount(coin, Number(p.amount_flowers ?? 0), 'native');
  const tx = p.tx_id ?? '';
  const confirmed = p.confirmed ?? false;
  const status: PayoutStatus =
    p.status === 'queued' || p.status === 'sent' || p.status === 'confirmed'
      ? p.status
      : confirmed
        ? 'confirmed'
        : tx
          ? 'sent'
          : 'queued';
  return {
    coin, ts: p.ts, address: p.address,
    amount, unit,
    tx,
    confirmations: p.confirmations ?? 0,
    confirmed,
    status,
  };
}

export async function fetchOverview(): Promise<PoolOverview> {
  if (USE_MOCK) return mock.poolOverview();
  const { coins, fees } = await get<{ ok: boolean; coins: ApiCoin[]; fees?: FeeSplit }>('/coins');
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
  return { uptime_s: 0, coins: infos, stats, fees: fees ?? null };
}

export interface HistorySample {
  ts: number;
  hashrate: number;
  miners_online: number;
  online_by_coin: Record<string, number>;
  accepted: number;
  rejected: number;
}

/** Server-side 1-minute pool snapshots (24h retention). Empty when the
 *  pool predates the history endpoint or has just restarted — callers
 *  should fall back to client-accumulated series. */
export async function fetchHistory(limit = 1440): Promise<HistorySample[]> {
  if (USE_MOCK) return [];
  const res = await get<{ ok: boolean; interval_s: number; samples: HistorySample[] }>(
    `/history?limit=${limit}`,
  );
  return res.samples ?? [];
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
    worker: b.worker_name ?? '',
    status: (b.status as BlockRow['status']) ?? 'confirmed',
    effort_pct: null,
    network_difficulty: b.network_difficulty ?? null,
    share_difficulty: b.share_difficulty ?? null,
    confirmed_at: b.confirmed_at ?? null,
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
      .reduce((sum, p) => sum + normalizeAmount(coin, Number(p.amount_flowers ?? 0), 'native').amount, 0);
    const pending = normalizeAmount(coin, Number(m.unpaid), m.unpaid_unit);
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
      pending: pending.amount,
      total_paid: totalPaid,
      unit: pending.unit,
      payouts: payouts.map((p) => toPayoutRow(coin, p)),
      active: m.active,
      window_share: m.window_share ?? 0,
      est_daily: m.est_daily == null ? null : normalizeAmount(coin, Number(m.est_daily), m.unpaid_unit).amount,
      est_per_block: m.est_per_block == null ? null : normalizeAmount(coin, Number(m.est_per_block), m.unpaid_unit).amount,
      min_payout: m.min_payout == null ? null : normalizeAmount(coin, Number(m.min_payout), m.unpaid_unit).amount,
      payout_eta_s: m.payout_eta_s ?? null,
    };
  } catch {
    return null;
  }
}

export interface MinerHistorySample {
  ts: number;
  hps: number;
  accepted: number;
  rejected: number;
}

/** Wallet-scoped hashrate timeseries (schema v6, 60s samples).
 *  Returns [] when the endpoint predates deployment or the wallet has
 *  no recorded samples — callers keep the client-accumulated fallback. */
export async function fetchMinerHistory(
  coin: CoinId,
  wallet: string,
  limit = 720,
): Promise<MinerHistorySample[]> {
  if (USE_MOCK) return [];
  const poolCoin = POOL_COIN[coin];
  if (!poolCoin) return [];
  try {
    const res = await get<{ ok: boolean; samples: MinerHistorySample[] }>(
      `/miner/${poolCoin}/${encodeURIComponent(wallet)}/history?limit=${limit}`,
    );
    return res.samples ?? [];
  } catch {
    return [];
  }
}
