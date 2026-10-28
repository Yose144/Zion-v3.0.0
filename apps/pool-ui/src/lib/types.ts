// Public API types — mirror the planned pool `/public/v1/*` surface
// (docs/3.2/ZION-POOL-NG-PLAN.md §5a). The mock layer returns these
// shapes so swapping to the live API is a base-URL change only.

export type CoinId =
  | 'zion' | 'qtc' | 'prl'           // native-payout / native legs
  | 'zano' | 'vrsc' | 'evr' | 'mewc' // auxPoW upstream legs
  | 'rtm' | 'zcl' | 'zec' | 'phx' | 'krx'
  | 'multi';

export type LegStatus = 'native' | 'upstream' | 'down';

export interface CoinLeg {
  kind: 'native' | 'upstream';
  status: 'live' | 'sync' | 'down';
  job_age_ms: number | null;
  share_pct: number; // fraction of served shares on this leg
}

export interface CoinInfo {
  id: CoinId;
  ticker: string;
  name: string;
  algorithm: string;
  port: number;
  tls_port: number;
  dialect: string;
  payout_mode: 'onchain' | 'node-wallet-batch' | 'bridged-batch';
  min_payout: number;
  payout_unit: string;
  fee_bps: number;
  legs: CoinLeg[];
  accent: 'gold' | 'cyan' | 'purple' | 'green';
  requirements?: string;
}

export interface CoinStats {
  coin: CoinId;
  hashrate: number;        // H/s pool-side estimate
  miners_online: number;
  workers_online: number;
  network_hashrate: number | null;
  network_difficulty: number | null;
  height: number | null;
  blocks_24h: number;
  luck_pct: number | null; // pool luck, 100 = average
  shares_1h: { accepted: number; rejected: number };
}

export interface BlockRow {
  coin: CoinId;
  height: number;
  hash: string;
  ts: number; // unix seconds
  miner: string;
  worker: string;
  status: 'pending' | 'confirmed' | 'orphaned';
  effort_pct: number | null;
  network_difficulty: number | null;
  share_difficulty: number | null;
  confirmed_at: number | null;
  shares_since_prev?: number;
  luck_pct?: number | null; // >100 = lucky (fewer shares than expected)
}

export type PayoutStatus = 'queued' | 'sent' | 'confirmed';

export interface PayoutRow {
  coin: CoinId;
  ts: number | null;
  address: string;
  amount: number;
  unit: string;
  tx: string;
  confirmations: number;
  confirmed: boolean;
  status: PayoutStatus;
}

export interface WorkerRow {
  name: string;
  algorithm: string;
  hashrate: number;
  shares_accepted: number;
  shares_rejected: number;
  last_seen: number;
}

export interface MinerStats {
  coin: CoinId;
  wallet: string;
  hashrate: number;
  hashrate_history: { ts: number; hps: number }[];
  workers: WorkerRow[];
  shares_24h: { accepted: number; rejected: number };
  immature: number;
  pending: number;
  total_paid: number;
  unit: string;
  payouts: PayoutRow[];
  active: boolean;
  /** Miner's weight fraction of this coin's PPLNS window (0..1). */
  window_share: number;
  /** Estimated daily earnings in `unit` (null when the store is absent). */
  est_daily: number | null;
  /** Estimated per-block earning, ZION only (null elsewhere). */
  est_per_block: number | null;
  /** Min payout threshold in `unit` (null when absent from payload). */
  min_payout: number | null;
  /** Seconds until `pending` crosses `min_payout` at the estimated accrual
      rate; 0 = eligible for the next batch; null = rate unknown. */
  payout_eta_s: number | null;
}

/** Protocol reward split — percentages of each ZION block subsidy. */
export interface FeeSplit {
  miner_pct: number;
  humanitarian_pct: number;
  issobella_pct: number;
  pool_fee_pct: number;
}

/** Advertised vardiff policy — values the stratum actually enforces. */
export interface VarDiffPolicy {
  start: number;
  min: number;
  max: number | null; // null = no ceiling
  target_secs: number;
  retarget_shares: number;
}

export interface PoolOverview {
  uptime_s: number;
  coins: CoinInfo[];
  stats: Record<string, CoinStats>;
  /** Global fee split from `/coins` — null when the backend predates it. */
  fees: FeeSplit | null;
}
