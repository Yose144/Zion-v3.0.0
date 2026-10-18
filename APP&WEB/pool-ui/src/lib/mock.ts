// Mock data for the pool UI — same shapes as /public/v1/* (types.ts).
// Replace with live fetches when the pool public tier ships (F4).

import {
  BlockRow,
  CoinInfo,
  CoinStats,
  MinerStats,
  PayoutRow,
  PoolOverview,
} from './types';

export const COINS: CoinInfo[] = [
  {
    id: 'zion',
    ticker: 'ZION',
    name: 'ZION TerraNova',
    algorithm: 'Ekam Deeksha (GPU)',
    port: 3333,
    tls_port: 3334,
    dialect: 'ZION native + Stratum v1',
    payout_mode: 'onchain',
    min_payout: 5,
    payout_unit: 'ZION',
    fee_bps: 100,
    legs: [
      { kind: 'native', status: 'live', job_age_ms: 1200, share_pct: 1.0 },
    ],
    accent: 'gold',
  },
  {
    id: 'qtc',
    ticker: 'QTC',
    name: 'Quantus',
    algorithm: 'QPoW · Poseidon2',
    port: 3334,
    tls_port: 3335,
    dialect: 'CryptoNote (SRBMiner / XMRig)',
    payout_mode: 'node-wallet-batch',
    min_payout: 0.5,
    payout_unit: 'QTC',
    fee_bps: 100,
    legs: [
      { kind: 'native', status: 'live', job_age_ms: 900, share_pct: 0.72 },
      { kind: 'upstream', status: 'live', job_age_ms: 2400, share_pct: 0.28 },
    ],
    accent: 'cyan',
    requirements: 'GPU recommended · CPU supported',
  },
  {
    id: 'prl',
    ticker: 'PRL',
    name: 'Pearl',
    algorithm: 'Pearl PoUW · matrix PoW',
    port: 3335,
    tls_port: 3336,
    dialect: 'Pearl stratum (SRBMiner ≥3.7.6)',
    payout_mode: 'node-wallet-batch',
    min_payout: 1,
    payout_unit: 'PRL',
    fee_bps: 100,
    legs: [
      { kind: 'native', status: 'live', job_age_ms: 1600, share_pct: 0.9 },
      { kind: 'upstream', status: 'sync', job_age_ms: 6100, share_pct: 0.1 },
    ],
    accent: 'purple',
    requirements: 'GPU only · NVIDIA SM75+ or AMD RDNA+ (Pascal unsupported)',
  },
  {
    id: 'multi',
    ticker: 'MULTI',
    name: 'Multi-algo',
    algorithm: 'auto-switch (opt-in)',
    port: 3336,
    tls_port: 3337,
    dialect: 'Stratum v1 (yiimp-style)',
    payout_mode: 'bridged-batch',
    min_payout: 10,
    payout_unit: 'per-coin',
    fee_bps: 150,
    legs: [
      { kind: 'upstream', status: 'live', job_age_ms: 3100, share_pct: 1.0 },
    ],
    accent: 'green',
    requirements: 'Opt-in lane — shares follow the coin you pick',
  },
];

const now = Math.floor(Date.now() / 1000);

export const COIN_STATS: Record<string, CoinStats> = {
  zion: {
    coin: 'zion',
    hashrate: 4_812_000,
    miners_online: 37,
    workers_online: 52,
    network_hashrate: 5_940_000,
    network_difficulty: 16_420,
    height: 142_881,
    blocks_24h: 1421,
    luck_pct: 104.2,
    shares_1h: { accepted: 18_442, rejected: 91 },
  },
  qtc: {
    coin: 'qtc',
    hashrate: 61_300_000,
    miners_online: 19,
    workers_online: 24,
    network_hashrate: 812_000_000,
    network_difficulty: 5_520_000_000,
    height: 3_912_444,
    blocks_24h: 3,
    luck_pct: 88.6,
    shares_1h: { accepted: 9_310, rejected: 44 },
  },
  prl: {
    coin: 'prl',
    hashrate: 2_140_000_000,
    miners_online: 6,
    workers_online: 8,
    network_hashrate: 58_100_000_000_000_000_000,
    network_difficulty: null,
    height: 128_910,
    blocks_24h: 0,
    luck_pct: null,
    shares_1h: { accepted: 1_204, rejected: 2 },
  },
  multi: {
    coin: 'multi',
    hashrate: 8_400_000,
    miners_online: 11,
    workers_online: 14,
    network_hashrate: null,
    network_difficulty: null,
    height: null,
    blocks_24h: 0,
    luck_pct: null,
    shares_1h: { accepted: 5_120, rejected: 61 },
  },
};

export const BLOCKS: BlockRow[] = [
  { coin: 'zion', height: 142_881, hash: '9f3c…a7d21b', ts: now - 42, miner: 'zion1n4k4…hf8c2', worker: 'vega-smos', status: 'confirmed', effort_pct: 41 },
  { coin: 'zion', height: 142_880, hash: '77be…0c4f9a', ts: now - 108, miner: 'zion1wq2m…x9p40', worker: 'rig-east-2', status: 'confirmed', effort_pct: 88 },
  { coin: 'qtc', height: 3_912_444, hash: 'Qn2f…aa08c1', ts: now - 3_240, miner: 'qz7xk…m2', worker: 'amd-7900xtx', status: 'confirmed', effort_pct: 132 },
  { coin: 'zion', height: 142_877, hash: 'c1d0…55e8f3', ts: now - 241, miner: 'zion1n4k4…hf8c2', worker: 'vega-smos', status: 'confirmed', effort_pct: 12 },
  { coin: 'zion', height: 142_876, hash: '02aa…9b14d7', ts: now - 305, miner: 'zion1j8pq…u2v88', worker: 'homebox', status: 'confirmed', effort_pct: 61 },
  { coin: 'prl', height: 128_908, hash: 'pearl…demo…pending', ts: now - 19_800, miner: 'prl1pz…ca7a5m', worker: 'pool-leg', status: 'pending', effort_pct: null },
  { coin: 'qtc', height: 3_912_102, hash: 'Qm91…4f77ba', ts: now - 21_600, miner: 'qz3rt…k9', worker: 'rig-east-2', status: 'confirmed', effort_pct: 97 },
  { coin: 'zion', height: 142_855, hash: 'e844…7a2c60', ts: now - 1_560, miner: 'zion1n4k4…hf8c2', worker: 'vega-smos', status: 'orphaned', effort_pct: 156 },
];

export const PAYOUTS: PayoutRow[] = [
  { coin: 'zion', ts: now - 1_800, address: 'zion1wq2m…x9p40', amount: 183.42, unit: 'ZION', tx: 'tx4f…9aa2', confirmations: 61, confirmed: true },
  { coin: 'zion', ts: now - 5_400, address: 'zion1j8pq…u2v88', amount: 96.10, unit: 'ZION', tx: 'tx1b…77cd', confirmations: 174, confirmed: true },
  { coin: 'qtc', ts: now - 10_800, address: 'qz7xk…m2', amount: 4.812_000_000_001, unit: 'QTC', tx: '0x8f2e…c1', confirmations: 44, confirmed: true },
  { coin: 'zion', ts: now - 14_400, address: 'zion1n4k4…hf8c2', amount: 512.77, unit: 'ZION', tx: 'tx90…41fe', confirmations: 402, confirmed: true },
  { coin: 'prl', ts: now - 86_400, address: 'prl1q9…zz21', amount: 2.5, unit: 'PRL', tx: 'dry-run', confirmations: 0, confirmed: false },
];

const hist = (base: number, spread: number, n = 48) =>
  Array.from({ length: n }, (_, i) => ({
    ts: now - (n - i) * 300,
    hps: Math.max(0, base + (Math.sin(i / 3.1) + Math.sin(i / 7.7) * 0.6) * spread),
  }));

export const DEMO_MINER: Record<string, MinerStats> = {
  'zion:zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2': {
    coin: 'zion',
    wallet: 'zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2',
    hashrate: 196_400,
    hashrate_history: hist(190_000, 24_000),
    workers: [
      { name: 'vega-smos', algorithm: 'deeksha-gpu', hashrate: 182_300, shares_accepted: 41_208, shares_rejected: 177, last_seen: now - 4 },
      { name: 'edge-fallback', algorithm: 'deeksha-cpu', hashrate: 14_100, shares_accepted: 3_955, shares_rejected: 12, last_seen: now - 9 },
    ],
    shares_24h: { accepted: 45_163, rejected: 189 },
    immature: 12.44,
    pending: 41.9,
    total_paid: 2_814.55,
    unit: 'ZION',
    payouts: [
      { coin: 'zion', ts: now - 14_400, address: 'zion1n4k4…hf8c2', amount: 512.77, unit: 'ZION', tx: 'tx90…41fe', confirmations: 402, confirmed: true },
      { coin: 'zion', ts: now - 100_800, address: 'zion1n4k4…hf8c2', amount: 488.02, unit: 'ZION', tx: 'tx5e…90ab', confirmations: 1_922, confirmed: true },
    ],
  },
  'qtc:qz7xkm2demo': {
    coin: 'qtc',
    wallet: 'qz7xkm2demo',
    hashrate: 37_700_000,
    hashrate_history: hist(34_000_000, 6_000_000),
    workers: [
      { name: 'amd-7900xtx', algorithm: 'quantus', hashrate: 37_700_000, shares_accepted: 12_844, shares_rejected: 60, last_seen: now - 3 },
    ],
    shares_24h: { accepted: 12_844, rejected: 60 },
    immature: 0.214_000_000_000,
    pending: 0,
    total_paid: 4.812,
    unit: 'QTC',
    payouts: [
      { coin: 'qtc', ts: now - 10_800, address: 'qz7xk…m2', amount: 4.812, unit: 'QTC', tx: '0x8f2e…c1', confirmations: 44, confirmed: true },
    ],
  },
  'prl:prl1pzdemo': {
    coin: 'prl',
    wallet: 'prl1pzdemo',
    hashrate: 1_340_000_000,
    hashrate_history: hist(1_200_000_000, 300_000_000),
    workers: [
      { name: 'rtx-4090', algorithm: 'pearlhash', hashrate: 1_340_000_000, shares_accepted: 2_130, shares_rejected: 4, last_seen: now - 2 },
    ],
    shares_24h: { accepted: 2_130, rejected: 4 },
    immature: 0,
    pending: 0,
    total_paid: 0,
    unit: 'PRL',
    payouts: [],
  },
};

export const DEMO_WALLETS: Record<string, string> = {
  zion: 'zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2',
  qtc: 'qz7xkm2demo',
  prl: 'prl1pzdemo',
};

export function poolOverview(): PoolOverview {
  return { uptime_s: 2_847_913, coins: COINS, stats: COIN_STATS };
}
