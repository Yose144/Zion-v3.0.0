// Direct ZION mining pool HTTP API client (:8455).

import { httpGet, shareLatest, type SharedSlot } from '../lib/client';
import { POOL, PUBLIC_POOL_STATS, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface PoolMiner {
  miner_id: string;
  worker_name?: string;
  payout_address?: string;
  hashrate_hps: number;
  valid_shares: number;
  invalid_shares: number;
  pending_balance_zion: number;
  paid_total: number;
  on_chain_balance_zion?: number;
  blocks_found: number;
  last_seen: number;
  active: boolean;
}

export interface PoolStats {
  ok: boolean;
  active_sessions: number;
  blocks_found: number;
  shares_accepted: number;
  shares_rejected: number;
  hashrate_live: number;
  hashrate_1h: number;
  hashrate_24h: number;
  network_hashrate: number;
  difficulty: number;
  pool_wallet: string;
  payout_enabled: boolean;
  pool_wallet_balance_zion: number;
  fee_split: string;
  auxpow: {
    enabled: boolean;
    current_algorithm: string;
    current_coin: string;
    current_pool: string;
    revenue_usd: number;
    circuit_open: boolean;
    consecutive_failures: number;
    coin_switches: number;
    last_switch_ts: string;
    uptime_secs: number;
    shares_submitted: number;
    shares_accepted: number;
    shares_rejected: number;
  };
  revenue: {
    enabled: boolean;
    status: string;
    strategy: string;
    total_usd: number;
    daily_estimate_usd: number;
    miner_share_pct: number;
    dao_share_pct: number;
    humanitarian_share_pct: number;
    pool_fee_pct: number;
    active_coins: string[];
    accumulated_usd: number;
    last_distribution_ts?: string;
    next_distribution_ts?: string;
    distribution_cycle: string;
    stream_profit_enabled: boolean;
    stream_profit_provider: string;
  };
  pplns: {
    payout_rounds: number;
    registered_miners: number;
    total_paid_zion: number;
    total_pending_zion: number;
    window_size: number;
    window_used: number;
    window_utilization_pct: number;
  };
  routing: {
    submits: number;
    accepted: number;
    rejected: number;
    stale: number;
    accept_rate_pct: number;
    groups?: Record<string, { submits?: number; accepted?: number }>;
    sources?: Record<string, { submits?: number; accepted?: number }>;
  };
  connection_history: {
    ts: number;
    time?: string;
    session_id?: string;
    active_sessions?: number;
    peer_addr?: string;
    miner_id?: string | null;
    worker_name?: string | null;
    duration_secs?: number | null;
    bye?: string | null;
  }[];
  totals: {
    pending_zion: number;
    paid_zion: number;
    on_chain_zion: number;
  };
  error?: string;
}

export interface MinersPayload {
  ok: boolean;
  miners: PoolMiner[];
  total: number;
  error?: string;
}

export interface MinerStats {
  ok: boolean;
  miner_id: string;
  stats: {
    hashrate_live: number;
    hashrate_1h: number;
    hashrate_24h: number;
    valid_shares: number;
    invalid_shares: number;
    blocks_found: number;
    pending_balance_zion: number;
    paid_total_zion: number;
  };
  error?: string;
}

export interface MinerPayouts {
  ok: boolean;
  miner_id: string;
  payouts: { ts: number; tx_id: string; amount_zion: number }[];
  total: number;
  error?: string;
}

export interface RevenueStats {
  ok: boolean;
  enabled: boolean;
  status: string;
  strategy: string;
  total_usd: number;
  daily_estimate_usd: number;
  revenue_usd: number;
  revenue_per_hour_usd: number;
  zion_mined_total: number;
  zion_paid_total: number;
  zion_pending: number;
  zion_per_day: number;
  blocks_found: number;
  blocks_per_day: number;
  pool_hashrate: number;
  current_algorithm?: string;
  current_pool?: string;
  current_coin?: string;
  shares_submitted: number;
  shares_accepted: number;
  shares_rejected: number;
  uptime_secs: number;
  coin_switches: number;
  last_switch_ts?: string;
  consecutive_failures: number;
  circuit_open: boolean;
  miner_share_pct: number;
  dao_share_pct: number;
  humanitarian_share_pct: number;
  pool_fee_pct: number;
  humanitarian_accumulated_zion: number;
  issobella_accumulated_zion: number;
  pool_fee_accumulated_zion: number;
  payout_rounds: number;
  pplns_window_size: number;
  pplns_window_used: number;
  registered_miners: number;
  last_distribution_ts?: string;
  next_distribution_ts?: string;
  distribution_cycle: string;
  active_coins: string[];
  accumulated_usd: number;
  coin_revenue: { coin: string; algorithm: string; pool: string; shares: number; revenue_usd: number; active: boolean }[];
  distributions: { ts: string; amount_zion: number; amount_usd: number; recipient: string; type: string }[];
  stream_profit: {
    enabled: boolean;
    provider: string;
    live: boolean;
    interval_secs: number;
    hysteresis_pct: number;
    weights: { source: string; weight_pct: number }[];
    weights_string: string;
    description: string;
  };
  error?: string;
}

export interface RevenueStreamItem {
  source: string;
  weight_pct: number;
  fee_rate_pct: number;
  submits: number;
  accepted: number;
  revenue_usd: number;
  active: boolean;
}

export interface RevenueStreamsPayload {
  ok: boolean;
  streams: RevenueStreamItem[];
  total: number;
  error?: string;
}

export interface PrometheusMetrics {
  raw: string;
  metrics: Record<string, string | number>;
}

function poolUrl(path: string, ep: ServiceEndpoint = POOL): string {
  return endpointUrl(ep, path);
}

interface PublicZionStats {
  ok?: boolean;
  active_miners?: number;
  miners_online?: number;
  accepted_total?: number;
  served_difficulty?: number;
  hashrate?: { live?: number; '1h'?: number };
  blocks?: { found?: number };
  shares?: { accepted?: number; rejected?: number };
}

const poolSlot: SharedSlot<PoolStats | null> = { inflight: null, cached: null };

/** Local pool API first. The public stats page is the fallback on a machine without :8455. */
export function fetchPoolStats(ep: ServiceEndpoint = POOL): Promise<PoolStats | null> {
  if (ep !== POOL) return readPoolStats(ep);
  return shareLatest(poolSlot, () => readPoolStats(POOL));
}

async function readPoolStats(ep: ServiceEndpoint): Promise<PoolStats | null> {
  const local = await httpGet<PoolStats>(poolUrl('/stats', ep), ep === POOL ? 1500 : 4000);
  if (local && local.ok !== false && (local.active_sessions != null || local.blocks_found != null)) return local;
  if (ep !== POOL) return local;
  return fetchPublicPoolStats();
}

async function fetchPublicPoolStats(): Promise<PoolStats | null> {
  const raw = await httpGet<PublicZionStats>(PUBLIC_POOL_STATS, 5000);
  if (!raw?.ok) return null;
  const accepted = raw.shares?.accepted ?? 0;
  const rejected = raw.shares?.rejected ?? 0;
  return {
    ok: true,
    active_sessions: raw.active_miners ?? raw.miners_online ?? 0,
    blocks_found: raw.blocks?.found ?? 0,
    shares_accepted: accepted,
    shares_rejected: rejected,
    hashrate_live: raw.hashrate?.live ?? 0,
    hashrate_1h: raw.hashrate?.['1h'] ?? 0,
    hashrate_24h: 0,
    network_hashrate: 0,
    difficulty: raw.served_difficulty ?? 0,
    pool_wallet: '',
    payout_enabled: true,
    pool_wallet_balance_zion: 0,
    fee_split: '—',
    auxpow: {
      enabled: true,
      current_algorithm: 'ekam_deeksha',
      current_coin: 'ZION',
      current_pool: 'pool.zionterranova.com',
      revenue_usd: 0,
      circuit_open: false,
      consecutive_failures: 0,
      coin_switches: 0,
      last_switch_ts: '',
      uptime_secs: 0,
      shares_submitted: raw.accepted_total ?? accepted,
      shares_accepted: accepted,
      shares_rejected: rejected,
    },
    revenue: {
      enabled: false,
      status: 'public',
      strategy: '—',
      total_usd: 0,
      daily_estimate_usd: 0,
      miner_share_pct: 0,
      dao_share_pct: 0,
      humanitarian_share_pct: 0,
      pool_fee_pct: 0,
      active_coins: ['ZION'],
      accumulated_usd: 0,
      distribution_cycle: '—',
      stream_profit_enabled: false,
      stream_profit_provider: '—',
    },
    pplns: {
      payout_rounds: 0,
      registered_miners: raw.active_miners ?? 0,
      total_paid_zion: 0,
      total_pending_zion: 0,
      window_size: 0,
      window_used: 0,
      window_utilization_pct: 0,
    },
    routing: {
      submits: accepted + rejected,
      accepted,
      rejected,
      stale: 0,
      accept_rate_pct: accepted + rejected > 0 ? (accepted / (accepted + rejected)) * 100 : 100,
    },
    connection_history: [],
    totals: { pending_zion: 0, paid_zion: 0, on_chain_zion: 0 },
  };
}

export async function fetchPoolMiners(limit = 200, ep: ServiceEndpoint = POOL): Promise<MinersPayload | null> {
  return httpGet<MinersPayload>(poolUrl(`/miners?limit=${limit}`, ep), 5000);
}

export async function fetchMinerStats(address: string, ep: ServiceEndpoint = POOL): Promise<MinerStats | null> {
  return httpGet<MinerStats>(poolUrl(`/api/v1/miner/${encodeURIComponent(address)}/stats`, ep), 5000);
}

export async function fetchMinerPayouts(address: string, ep: ServiceEndpoint = POOL): Promise<MinerPayouts | null> {
  return httpGet<MinerPayouts>(poolUrl(`/api/v1/miner/${encodeURIComponent(address)}/payouts`, ep), 5000);
}

export async function fetchRevenueStats(ep: ServiceEndpoint = POOL): Promise<RevenueStats | null> {
  return httpGet<RevenueStats>(poolUrl('/api/v1/revenue/stats', ep), 4000);
}

export async function fetchRevenueStreams(ep: ServiceEndpoint = POOL): Promise<RevenueStreamsPayload | null> {
  return httpGet<RevenueStreamsPayload>(poolUrl('/api/v1/revenue/streams', ep), 4000);
}

export async function fetchPoolMetrics(ep: ServiceEndpoint = POOL): Promise<PrometheusMetrics | null> {
  const raw = await httpGet<string>(poolUrl('/metrics', ep), 4000);
  if (raw === null) return null;
  const text = typeof raw === 'string' ? raw : String(raw);
  const metrics: Record<string, string | number> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const key = parts[0].replace(/\{[^}]*\}/, '');
      const value = parts[parts.length - 1];
      const num = Number(value);
      metrics[key] = Number.isNaN(num) ? value : num;
    }
  }
  return { raw: text, metrics };
}

export async function checkPoolHealth(ep: ServiceEndpoint = POOL): Promise<boolean> {
  const stats = await fetchPoolStats(ep);
  return !!stats && stats.ok;
}
