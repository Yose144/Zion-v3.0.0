// ZION Desktop — direct-service API layer.
// Replaces the old Python dashboard proxy (http://127.0.0.1:8766) with direct
// calls to node RPC, pool API, DAO, WARP, OASIS, bridge, swap and AI services.

import { tailLogFile } from './fs';
import {
  startLocalBackup,
  stopStack,
  restartStack,
  restartService,
} from '../api/controls';

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Types (kept for UI compatibility)
// ╚═══════════════════════════════════════════════════════════════════════════════

export interface ServiceHealth {
  id: string;
  name: string;
  icon: string;
  level: string;
  kind: string;
  status?: string;
  alive?: boolean;
  derived?: string;
  depends_on?: string[];
  actions?: string[];
  log?: string;
  meta?: Record<string, unknown>;
}

export interface V3Status {
  timestamp: string;
  topology: 'edge-primary' | 'local-dev';
  node1: {
    running: boolean;
    chain_height: number | null;
    known_peers: number;
    mempool_size: number;
    p2p_bind?: string | null;
    node_id?: string | null;
    uptime_seconds?: number | null;
  };
  node2: {
    running: boolean;
    chain_height: number | null;
    known_peers: number;
    mempool_size: number;
  };
  edge_node: {
    running: boolean;
    chain_height: number | null;
    known_peers: number;
    mempool_size: number;
  };
  pool: {
    running: boolean;
    active_sessions?: number;
    blocks_found?: number;
    shares_accepted?: number;
    shares_rejected?: number;
    fee_split?: string;
    pool_wallet?: string;
    recent_payouts?: string[];
    miner_balances?: {
      miner_id: string;
      worker_name: string;
      balance_atomic: number;
      balance_zion: number;
      on_chain_balance_zion?: number | null;
    }[];
  };
  pool_edge: {
    running: boolean;
    host?: string;
    ports_open?: string[];
    active_miners?: number | null;
    hashrate?: number | null;
    blocks_found?: number | null;
  };
  miner: {
    running: boolean;
    hashrate: number | null;
    gpu_backend: string | null;
    gpu_device: string | null;
    shares_accepted: number;
    shares_rejected: number;
    pool_addr: string | null;
    current_height: number | null;
    current_algorithm: string | null;
  };
}

export interface AlertItem {
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  detail: string;
  action?: string;
  id?: string;
}

export interface ReadinessScore {
  score: number;
  checks: { id: string; ok: boolean }[];
}

export interface MonitoringStatus {
  prometheus: {
    url: string;
    alive: boolean;
    version: string | null;
    targets_up: number;
    targets_total: number;
  };
  grafana: {
    url: string;
    alive: boolean;
    version: string | null;
    database: string | null;
  };
  timestamp: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
}

export interface Checklist {
  checks: ChecklistItem[];
  total: number;
  passed: number;
  pct: number;
}

export interface Wallet {
  address: string;
  label: string;
  source: string;
  category: 'premine' | 'operational';
  amount_zion?: number;
  balance_zion: number | null;
  balance_atomic: number | null;
  rpc_ok: boolean;
}

export interface WalletSummary {
  total_wallets: number;
  premine_wallets: number;
  operational_wallets: number;
  with_live_balance: number;
  total_premine_zion: number;
  total_operational_zion: number;
}

export interface WalletsResponse {
  wallets: Wallet[];
  summary: WalletSummary;
  category_summary: Record<string, { count: number; total_zion: number; labels: string[] }>;
  rpc: { host: string; port: number; reachable: boolean };
}

export interface BlockSummary {
  height: number;
  hash: string;
  ts: number;
  txns: number;
  size: number;
  difficulty: number;
}

export interface BlockEvent {
  ts: number;
  height: number;
  hash: string;
  type: string;
  detail: string;
}

export interface EdgeOverview {
  reachable: boolean;
  edge_host: string;
  topology: string;
  chain_height: number;
  pool_running: boolean;
  active_miners: number;
  hashrate: number;
  shares_accepted: number;
  blocks_found: number;
  services: Record<string, string>;
  local_backup: {
    running: boolean;
    chain_height: number;
    tip_hash: string;
    known_peers: number;
    mempool_size: number;
    network: string;
    protocol_version: string;
    consensus_profile: string;
    accepted_blocks: number;
    node_id: string;
    p2p_bind: string;
    rpc_bind: string;
    host: string;
    port: number;
  };
}

export interface PoolMiner {
  miner_id: string;
  worker_name?: string;
  payout_address?: string;
  hashrate_hps: number;
  valid_shares: number;
  invalid_shares: number;
  pending_balance_zion: number;
  paid_total: number;
  on_chain_balance_zion: number;
  blocks_found: number;
  last_seen: number;
  active: boolean;
}

export interface PoolWalletStatus {
  pool_wallet: string;
  payout_enabled: boolean;
  utxo_count: number | null;
  balance_zion: number;
  blocks_found: number;
  pending_payouts: number;
  last_payout_time: string | null;
  last_payout_error: string | null;
  fee_split: string;
  shares_accepted: number;
  shares_rejected: number;
}

export interface PoolAuxpow {
  circuit_open: boolean;
  coin_switches: number;
  consecutive_failures: number;
  current_algorithm: string;
  current_coin: string;
  current_pool: string;
  enabled: boolean;
  last_switch_ts: string;
  revenue_usd: number;
  shares_accepted: number;
  shares_rejected: number;
  shares_submitted: number;
  uptime_secs: number;
}

export interface PoolRevenue {
  enabled: boolean;
  status: string;
  strategy: string;
  total_usd: number;
  daily_estimate_usd: number;
  miner_share_pct: number;
  dao_share_pct: number;
  humanitarian_share_pct: number;
  pool_fee_pct: number;
  last_distribution_ts: string | null;
  next_distribution_ts: string | null;
  active_coins: string[];
  circuit_open: boolean;
}

export interface PoolMinersDashboard {
  ok: boolean;
  miners: PoolMiner[];
  pool_info?: {
    hashrate_live?: number;
    hashrate_24h?: number;
    network_hashrate?: number;
  };
  summary?: {
    active_miners?: number;
    registered_miners?: number;
    total_paid_zion?: number;
    total_pending_zion?: number;
    total_on_chain_zion?: number;
    blocks_found?: number;
  };
  pool_wallet?: PoolWalletStatus;
  auxpow?: PoolAuxpow;
  revenue?: PoolRevenue;
  pplns?: {
    payout_rounds?: number;
    registered_miners?: number;
    total_paid_zion?: number;
    total_pending_zion?: number;
    window_size?: number;
    window_used?: number;
    window_utilization_pct?: number;
  };
  fee_split?: {
    miner_pct?: number;
    humanitarian_pct?: number;
    issobella_pct?: number;
    pool_fee_pct?: number;
    humanitarian_accumulated_zion?: number;
    issobella_accumulated_zion?: number;
    pool_fee_accumulated_zion?: number;
    humanitarian_wallet?: string;
    issobella_wallet?: string;
    pool_fee_wallet?: string;
  };
  routing?: {
    submits?: number;
    accepted?: number;
    rejected?: number;
    stale?: number;
    accept_rate_pct?: number;
    groups?: Record<string, { submits?: number; accepted?: number }>;
    sources?: Record<string, { submits?: number; accepted?: number }>;
  };
  connection_history?: { ts: number; time?: string; session_id?: string; active_sessions?: number; peer_addr?: string; miner_id?: string | null; worker_name?: string | null; duration_secs?: number | null; bye?: string | null }[];
  totals?: { pending_zion?: number; paid_zion?: number; on_chain_zion?: number };
}

export interface RevenueStream {
  source: string;
  weight_pct: number;
  fee_rate_pct: number;
  submits: number;
  accepted: number;
}

export interface RevenueDetail {
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
  distribution_cycle: string;
  accumulated_usd: number;
  active_coins: string[];
  coin_revenue: { coin: string; algorithm: string; pool: string; shares: number; revenue_usd: number; active: boolean }[];
  distributions: { ts: string; amount_zion: number; amount_usd: number; recipient: string; type: string }[];
  stream_profit_enabled: boolean;
  stream_profit_provider: string;
  stream_profit_live: boolean;
  stream_profit_weights: { source: string; weight_pct: number }[];
  stream_profit_weights_string: string;
  stream_profit_description: string;
  stream_profit_interval: number;
  stream_profit_hysteresis: number;
  stream_profit_sources: string;
}

export interface RevenueDashboard {
  ok: boolean;
  auxpow?: PoolAuxpow;
  stream_profit?: {
    description: string;
    enabled: boolean;
    enabled_sources: string;
    live: boolean;
    provider: string;
    weights: { source: string; weight_pct: number }[];
    weights_string?: string;
    interval_secs?: number;
    hysteresis_pct?: number;
  };
  revenue?: RevenueDetail;
}

export interface PayoutMiner {
  address: string;
  worker_name?: string;
  algorithm?: string;
  backend?: string;
  blocks_found: number;
  hashrate: number;
  hashrate_1h?: number;
  hashrate_24h?: number;
  invalid_shares: number;
  last_seen: number;
  last_share?: number;
  payout_address: string;
  pending_balance: number;
  valid_shares: number;
  paid_total_atomic: number;
  paid_total: number;
  on_chain_balance_zion: number;
}

export interface PayoutStatus {
  pool_wallet: string | null;
  pool_wallet_balance: number | null;
  payout_enabled: boolean;
  fee_split: string | null;
  blocks_found: number;
  last_block_height: number | null;
  last_payout_time: string | null;
  last_payout_tx: string | null;
  miner_wallet: string | null;
  humanitarian_wallet: string | null;
  issobella_wallet: string | null;
  pool_fee_wallet: string | null;
  miner_payouts: unknown[];
  fee_payouts: unknown[];
  errors: string[];
  payouts: unknown[];
  pending_payouts: number;
  miner_perf: Record<string, unknown>;
  pool_stats: Record<string, unknown>;
  miners: PayoutMiner[];
  topology: string;
  pool_health: {
    local_rpc_ok: boolean;
    edge_rpc_ok: boolean;
    edge_stats_ok: boolean;
    tailscale_ok: boolean;
    last_update: string;
    error_msg: string | null;
  };
  recent_payouts: unknown[];
  session_stats: {
    active_sessions?: number;
    total_shares_1h?: number;
    blocks_24h?: number;
    accept_rate_pct?: number;
  };
  payout_validation: {
    valid_addresses: number;
    invalid_addresses: number;
    missing_addresses: number;
    last_error: string | null;
    safe_to_payout: boolean;
  };
}

export interface AuxPowConfig {
  mode: 'zion' | 'auto' | 'force';
  enabled: boolean;
  coin: string;
  pool_preference: string;
  region: string;
  split_zion: number;
  split_external: number;
  wallet: string;
  worker_name: string;
  coin_wallets: Record<string, string>;
  stream_profit_enabled: boolean;
  stream_profit_provider: string;
  stream_profit_interval: string;
  stream_profit_hysteresis: string;
  stream_profit_sources: string;
}

export interface AuxPowConfigResponse {
  ok: boolean;
  config: AuxPowConfig;
  supported_coins: string[];
  supported_preferences: string[];
  supported_stream_sources: string[];
  supported_stream_providers: string[];
  env_file: string;
  env_file_exists: boolean;
}


export interface TopologyNode {
  label: string;
  host: string;
  rpc_port: number;
  alive: boolean;
  latency_ms: number | null;
  height: number | null;
  tip_hash: string | null;
  node_id: string | null;
  p2p_bind: string | null;
  known_peers: number;
}

export interface TopologyResponse {
  edge_node1: TopologyNode;
  edge_node2: TopologyNode;
  local_backup: TopologyNode;
  max_height: number;
  min_height: number;
  sync_gap: number;
  all_in_sync: boolean;
  ports: Record<string, boolean>;
}

export interface AgentStatus {
  online: boolean;
  version?: string;
  uptime_seconds?: number;
  rigs_total?: number;
  rigs_online?: number;
}

export interface LayerStatus {
  layers: { id: string; name: string; status: 'up' | 'down' | 'degraded'; detail?: string }[];
  summary: { up: number; down: number; degraded: number; total: number };
}

export interface LayerStatusResponse {
  layer: string;
  ok: boolean;
  services: Record<string, boolean>;
  block_height?: number;
  peers?: number;
  hashrate?: number;
  shares_accepted?: number;
  pool_alive?: boolean;
  miner_alive?: boolean;
  node2_alive?: boolean;
  edge_alive?: boolean;
  error?: string;
}

export interface SecurityStatus {
  summary: { open_blockers: number; warnings: number; ok: number };
  checks: { id: string; ok: boolean; severity: 'critical' | 'warning' | 'info'; detail: string }[];
}

export interface BackupStatus {
  ok: boolean;
  last_backup?: string;
  backups?: { name: string; size: number; age_seconds: number }[];
  error?: string;
}

export interface HistorySample {
  ts: number;
  hashrate?: number;
  blocks?: number;
  difficulty?: number;
}

export interface HistoryResponse {
  samples: HistorySample[];
}

export interface MempoolResponse {
  size: number;
  bytes?: number;
  fee_estimates?: Record<string, number>;
}

export const EDGE_WEB = 'https://zionterranova.com';

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Re-exports from new direct-service clients
// ╚═══════════════════════════════════════════════════════════════════════════════

export * from '../config/services';
export * from './client';
export * from '../api/node';
export * from '../api/pool';
export * from '../api/dao';
export * from '../api/warp';
export * from '../api/oasis';
export * from '../api/bridge';
export * from '../api/swap';
export * from '../api/hiran';
export * from '../api/auxiliary';
export * from '../api/controls';
export { tailLogFile, fetchLogFiles, type LogFilesResponse, type LogFileInfo } from './fs';

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Desktop notifications (browser API)
// ╚═══════════════════════════════════════════════════════════════════════════════

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNotification(title: string, body: string, icon?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: icon || '/zion_logo.png' });
  } catch {
    /* ignore */
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Aggregate dashboard status (replaces /api/status, /api/services, /api/alerts, /api/readiness)
// ╚═══════════════════════════════════════════════════════════════════════════════

import { fetchDirectFullStatus, type DirectStatus } from '../api/aggregate';

export async function fetchFullStatus(): Promise<{
  status: V3Status | null;
  services: ServiceHealth[];
  alerts: AlertItem[];
  readiness: ReadinessScore | null;
  monitoring: MonitoringStatus | null;
}> {
  try {
    const data = await fetchDirectFullStatus();
    return {
      status: data.status,
      services: data.services,
      alerts: data.alerts,
      readiness: data.readiness,
      monitoring: null,
    };
  } catch (e) {
    console.error('[fetchFullStatus]', e);
    return { status: null, services: [], alerts: [], readiness: null, monitoring: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Pool / mining dashboards (built directly from pool :8455 API)
// ╚═══════════════════════════════════════════════════════════════════════════════

import {
  fetchPoolStats as _fetchPoolStats,
  fetchPoolMiners as _fetchPoolMiners,
  fetchRevenueStats as _fetchRevenueStats,
  fetchRevenueStreams as _fetchRevenueStreams,
  fetchPoolMetrics as _fetchPoolMetrics,
} from '../api/pool';

export async function fetchPoolMinersDashboard(): Promise<PoolMinersDashboard | null> {
  const [stats, miners, metrics] = await Promise.all([
    _fetchPoolStats().catch(() => null),
    _fetchPoolMiners(200).catch(() => null),
    _fetchPoolMetrics().catch(() => null),
  ]);

  if (!stats) return null;

  const revenue: PoolRevenue = {
    enabled: stats.revenue?.enabled ?? false,
    status: stats.revenue?.status ?? 'disabled',
    strategy: stats.revenue?.strategy ?? '—',
    total_usd: stats.revenue?.total_usd ?? 0,
    daily_estimate_usd: stats.revenue?.daily_estimate_usd ?? 0,
    miner_share_pct: stats.revenue?.miner_share_pct ?? 0,
    dao_share_pct: stats.revenue?.dao_share_pct ?? 0,
    humanitarian_share_pct: stats.revenue?.humanitarian_share_pct ?? 0,
    pool_fee_pct: stats.revenue?.pool_fee_pct ?? 0,
    last_distribution_ts: stats.revenue?.last_distribution_ts ?? null,
    next_distribution_ts: stats.revenue?.next_distribution_ts ?? null,
    active_coins: stats.revenue?.active_coins ?? [],
    circuit_open: stats.auxpow?.circuit_open ?? false,
  };

  const auxpow: PoolAuxpow = {
    circuit_open: stats.auxpow?.circuit_open ?? false,
    coin_switches: stats.auxpow?.coin_switches ?? 0,
    consecutive_failures: stats.auxpow?.consecutive_failures ?? 0,
    current_algorithm: stats.auxpow?.current_algorithm ?? '—',
    current_coin: stats.auxpow?.current_coin ?? '—',
    current_pool: stats.auxpow?.current_pool ?? '—',
    enabled: stats.auxpow?.enabled ?? false,
    last_switch_ts: stats.auxpow?.last_switch_ts ?? '—',
    revenue_usd: stats.auxpow?.revenue_usd ?? 0,
    shares_accepted: stats.auxpow?.shares_accepted ?? 0,
    shares_rejected: stats.auxpow?.shares_rejected ?? 0,
    shares_submitted: stats.auxpow?.shares_submitted ?? 0,
    uptime_secs: stats.auxpow?.uptime_secs ?? 0,
  };

  return {
    ok: true,
    miners: miners?.miners.map((m) => ({
      miner_id: m.miner_id,
      worker_name: m.worker_name,
      payout_address: m.payout_address,
      hashrate_hps: m.hashrate_hps,
      valid_shares: m.valid_shares,
      invalid_shares: m.invalid_shares,
      pending_balance_zion: m.pending_balance_zion,
      paid_total: m.paid_total,
      on_chain_balance_zion: m.on_chain_balance_zion ?? 0,
      blocks_found: m.blocks_found,
      last_seen: m.last_seen,
      active: m.active,
    })) ?? [],
    pool_info: {
      hashrate_live: stats.hashrate_live,
      hashrate_24h: stats.hashrate_24h,
      network_hashrate: stats.network_hashrate,
    },
    summary: {
      active_miners: stats.active_sessions,
      registered_miners: stats.pplns?.registered_miners,
      total_paid_zion: stats.pplns?.total_paid_zion,
      total_pending_zion: stats.pplns?.total_pending_zion,
      total_on_chain_zion: stats.totals?.on_chain_zion,
      blocks_found: stats.blocks_found,
    },
    pool_wallet: {
      pool_wallet: stats.pool_wallet,
      payout_enabled: stats.payout_enabled,
      utxo_count: null,
      balance_zion: stats.pool_wallet_balance_zion ?? 0,
      blocks_found: stats.blocks_found,
      pending_payouts: stats.pplns?.total_pending_zion ? Math.round(stats.pplns.total_pending_zion) : 0,
      last_payout_time: null,
      last_payout_error: null,
      fee_split: stats.fee_split ?? '—',
      shares_accepted: stats.shares_accepted,
      shares_rejected: stats.shares_rejected,
    },
    auxpow,
    revenue,
    pplns: stats.pplns,
    fee_split: {
      miner_pct: undefined,
      humanitarian_pct: undefined,
      issobella_pct: undefined,
      pool_fee_pct: undefined,
      humanitarian_accumulated_zion: undefined,
      issobella_accumulated_zion: undefined,
      pool_fee_accumulated_zion: undefined,
    },
    routing: stats.routing,
    connection_history: stats.connection_history ?? [],
    totals: stats.totals,
  };
}

export async function fetchRevenueDashboard(): Promise<RevenueDashboard | null> {
  const [stats, streams] = await Promise.all([
    _fetchRevenueStats().catch(() => null),
    _fetchRevenueStreams().catch(() => null),
  ]);
  if (!stats) return null;
  return {
    ok: true,
    auxpow: {
      circuit_open: false,
      coin_switches: 0,
      consecutive_failures: 0,
      current_algorithm: stats.current_algorithm ?? '—',
      current_coin: stats.current_coin ?? '—',
      current_pool: stats.current_pool ?? '—',
      enabled: false,
      last_switch_ts: stats.last_switch_ts ?? '—',
      revenue_usd: stats.revenue_usd ?? 0,
      shares_accepted: stats.shares_accepted ?? 0,
      shares_rejected: stats.shares_rejected ?? 0,
      shares_submitted: stats.shares_submitted ?? 0,
      uptime_secs: stats.uptime_secs ?? 0,
    },
    stream_profit: {
      description: stats.stream_profit?.description ?? '—',
      enabled: stats.stream_profit?.enabled ?? false,
      enabled_sources: stats.stream_profit?.weights_string ?? '—',
      live: stats.stream_profit?.live ?? false,
      provider: stats.stream_profit?.provider ?? '—',
      weights: stats.stream_profit?.weights ?? streams?.streams.map((s) => ({ source: s.source, weight_pct: s.weight_pct })) ?? [],
      weights_string: stats.stream_profit?.weights_string,
      interval_secs: stats.stream_profit?.interval_secs,
      hysteresis_pct: stats.stream_profit?.hysteresis_pct,
    },
    revenue: {
      enabled: stats.enabled,
      status: stats.status,
      strategy: stats.strategy,
      total_usd: stats.total_usd,
      daily_estimate_usd: stats.daily_estimate_usd,
      revenue_usd: stats.revenue_usd,
      revenue_per_hour_usd: stats.revenue_usd / Math.max(stats.uptime_secs / 3600, 1),
      zion_mined_total: stats.zion_mined_total,
      zion_paid_total: stats.zion_paid_total,
      zion_pending: stats.zion_pending,
      zion_per_day: stats.zion_per_day,
      blocks_found: stats.blocks_found,
      blocks_per_day: stats.blocks_per_day,
      pool_hashrate: stats.pool_hashrate,
      current_algorithm: stats.current_algorithm,
      current_pool: stats.current_pool,
      current_coin: stats.current_coin,
      shares_submitted: stats.shares_submitted,
      shares_accepted: stats.shares_accepted,
      shares_rejected: stats.shares_rejected,
      uptime_secs: stats.uptime_secs,
      coin_switches: stats.coin_switches,
      last_switch_ts: stats.last_switch_ts,
      consecutive_failures: stats.consecutive_failures,
      circuit_open: stats.circuit_open,
      miner_share_pct: stats.miner_share_pct,
      dao_share_pct: stats.dao_share_pct,
      humanitarian_share_pct: stats.humanitarian_share_pct,
      pool_fee_pct: stats.pool_fee_pct,
      humanitarian_accumulated_zion: stats.humanitarian_accumulated_zion,
      issobella_accumulated_zion: stats.issobella_accumulated_zion,
      pool_fee_accumulated_zion: stats.pool_fee_accumulated_zion,
      payout_rounds: stats.payout_rounds,
      pplns_window_size: stats.pplns_window_size,
      pplns_window_used: stats.pplns_window_used,
      registered_miners: stats.registered_miners,
      last_distribution_ts: stats.last_distribution_ts,
      distribution_cycle: stats.distribution_cycle,
      accumulated_usd: stats.accumulated_usd,
      active_coins: stats.active_coins,
      coin_revenue: stats.coin_revenue,
      distributions: stats.distributions,
      stream_profit_enabled: stats.stream_profit?.enabled ?? false,
      stream_profit_provider: stats.stream_profit?.provider ?? '—',
      stream_profit_live: stats.stream_profit?.live ?? false,
      stream_profit_weights: stats.stream_profit?.weights ?? [],
      stream_profit_weights_string: stats.stream_profit?.weights_string ?? '—',
      stream_profit_description: stats.stream_profit?.description ?? '—',
      stream_profit_interval: stats.stream_profit?.interval_secs ?? 0,
      stream_profit_hysteresis: stats.stream_profit?.hysteresis_pct ?? 0,
      stream_profit_sources: stats.stream_profit?.weights_string ?? '—',
    },
  };
}

export async function fetchRevenueStreams(): Promise<Record<string, unknown> | null> {
  const s = await _fetchRevenueStreams().catch(() => null);
  if (!s) return null;
  return { ok: true, streams: s.streams, total: s.total };
}

export async function fetchPayoutStatus(): Promise<PayoutStatus | null> {
  const stats = await _fetchPoolStats().catch(() => null);
  const miners = await _fetchPoolMiners(200).catch(() => null);
  if (!stats) return null;
  return {
    pool_wallet: stats.pool_wallet ?? null,
    pool_wallet_balance: stats.pool_wallet_balance_zion ?? null,
    payout_enabled: stats.payout_enabled,
    fee_split: stats.fee_split ?? null,
    blocks_found: stats.blocks_found,
    last_block_height: null,
    last_payout_time: null,
    last_payout_tx: null,
    miner_wallet: null,
    humanitarian_wallet: null,
    issobella_wallet: null,
    pool_fee_wallet: null,
    miner_payouts: [],
    fee_payouts: [],
    errors: [],
    payouts: [],
    pending_payouts: stats.pplns?.total_pending_zion ? Math.round(stats.pplns.total_pending_zion) : 0,
    miner_perf: {},
    pool_stats: stats as unknown as Record<string, unknown>,
    miners: miners?.miners.map((m) => ({
      address: m.miner_id,
      worker_name: m.worker_name,
      algorithm: undefined,
      backend: undefined,
      blocks_found: m.blocks_found,
      hashrate: m.hashrate_hps,
      hashrate_1h: undefined,
      hashrate_24h: undefined,
      invalid_shares: m.invalid_shares,
      last_seen: m.last_seen,
      last_share: undefined,
      payout_address: m.payout_address ?? '',
      pending_balance: m.pending_balance_zion,
      valid_shares: m.valid_shares,
      paid_total_atomic: 0,
      paid_total: m.paid_total,
      on_chain_balance_zion: m.on_chain_balance_zion ?? 0,
    })) ?? [],
    topology: 'local-dev',
    pool_health: {
      local_rpc_ok: true,
      edge_rpc_ok: true,
      edge_stats_ok: !!stats,
      tailscale_ok: false,
      last_update: new Date().toISOString(),
      error_msg: null,
    },
    recent_payouts: [],
    session_stats: {
      active_sessions: stats.active_sessions,
      total_shares_1h: stats.shares_accepted,
      blocks_24h: stats.blocks_found,
      accept_rate_pct: stats.routing?.accept_rate_pct,
    },
    payout_validation: {
      valid_addresses: 0,
      invalid_addresses: 0,
      missing_addresses: 0,
      last_error: null,
      safe_to_payout: stats.payout_enabled,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Checklist
// ╚═══════════════════════════════════════════════════════════════════════════════

export async function fetchChecklist(): Promise<Checklist | null> {
  const { status, services, readiness } = await fetchFullStatus();
  const checks: ChecklistItem[] = [];

  const nodeRunning = status && (status.node1.running || status.node2.running || status.edge_node.running);
  checks.push({ id: 'node-running', label: 'L1 node reachable', ok: !!nodeRunning });
  checks.push({ id: 'pool-running', label: 'Pool metrics reachable', ok: !!(status?.pool.running || status?.pool_edge.running) });
  checks.push({ id: 'chain-height', label: 'Chain height > 0', ok: (status?.node1.chain_height ?? 0) > 0 || (status?.edge_node.chain_height ?? 0) > 0 });
  checks.push({ id: 'peers', label: 'Node has peers', ok: (status?.node1.known_peers ?? 0) > 0 || (status?.edge_node.known_peers ?? 0) > 0 });
  checks.push({ id: 'dao', label: 'DAO daemon reachable', ok: services.some((s) => s.id === 'dao' && s.alive) });
  checks.push({ id: 'warp', label: 'WARP relay reachable', ok: services.some((s) => s.id === 'warp' && s.alive) });
  checks.push({ id: 'oasis', label: 'OASIS reachable', ok: services.some((s) => s.id === 'oasis' && s.alive) });
  checks.push({ id: 'bridge', label: 'Bridge reachable', ok: services.some((s) => s.id === 'bridge' && s.alive) });
  checks.push({ id: 'swap', label: 'Atomic swap reachable', ok: services.some((s) => s.id === 'atomic-swap' && s.alive) });
  checks.push({ id: 'hiran', label: 'Hiran orchestrator reachable', ok: services.some((s) => s.id === 'hiranyagarbha' && s.alive) });

  const passed = checks.filter((c) => c.ok).length;
  return { checks, total: checks.length, passed, pct: Math.round((passed / checks.length) * 100) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Edge / topology / network overview
// ╚═══════════════════════════════════════════════════════════════════════════════

import {
  queryAllNodes,
  getChainInfo,
  getPeerInfo,
  type ChainInfo,
  type NodeInfo,
} from '../api/node';

export async function fetchEdgeOverview(): Promise<EdgeOverview | null> {
  const [nodes, poolStats] = await Promise.all([
    queryAllNodes().catch(() => []),
    _fetchPoolStats().catch(() => null),
  ]);
  const edge1 = nodes.find((n) => n.endpoint.id === 'edge-node1');
  const local = nodes.find((n) => n.endpoint.id === 'local-backup');
  const chainInfo = local?.chainInfo ?? edge1?.chainInfo ?? null;
  const nodeInfo = local?.nodeInfo ?? edge1?.nodeInfo ?? null;

  return {
    reachable: !!edge1?.alive,
    edge_host: '127.0.0.1',
    topology: 'local-dev',
    chain_height: chainInfo?.chain_height ?? 0,
    pool_running: !!poolStats,
    active_miners: poolStats?.active_sessions ?? 0,
    hashrate: poolStats?.hashrate_live ?? 0,
    shares_accepted: poolStats?.shares_accepted ?? 0,
    blocks_found: poolStats?.blocks_found ?? 0,
    services: {
      node: chainInfo ? 'online' : 'offline',
      pool: poolStats ? 'online' : 'offline',
      dao: 'unknown',
      warp: 'unknown',
      bridge: 'unknown',
    },
    local_backup: {
      running: !!local?.alive,
      chain_height: local?.chainInfo?.chain_height ?? 0,
      tip_hash: local?.chainInfo?.tip_hash ?? '—',
      known_peers: local?.nodeInfo?.known_peers ?? 0,
      mempool_size: local?.chainInfo?.mempool_transactions ?? 0,
      network: local?.chainInfo?.network ?? '—',
      protocol_version: local?.chainInfo?.protocol_version ?? '—',
      consensus_profile: local?.chainInfo?.consensus_profile ?? '—',
      accepted_blocks: local?.chainInfo?.accepted_blocks ?? 0,
      node_id: local?.nodeInfo?.node_id ?? '—',
      p2p_bind: local?.nodeInfo?.p2p_bind ?? '—',
      rpc_bind: local?.nodeInfo?.rpc_bind ?? '—',
      host: '127.0.0.1',
      port: 8446,
    },
  };
}

export async function fetchTopology(): Promise<TopologyResponse | null> {
  const nodes = await queryAllNodes().catch(() => []);
  const toNode = (label: string, n: { endpoint: { host: string; port: number }; alive: boolean; chainInfo?: ChainInfo | null; nodeInfo?: NodeInfo | null }) => ({
    label,
    host: n.endpoint.host,
    rpc_port: n.endpoint.port,
    alive: n.alive,
    latency_ms: null,
    height: n.chainInfo?.chain_height ?? null,
    tip_hash: n.chainInfo?.tip_hash ?? null,
    node_id: n.nodeInfo?.node_id ?? null,
    p2p_bind: n.nodeInfo?.p2p_bind ?? null,
    known_peers: n.nodeInfo?.known_peers ?? 0,
  });

  const edge1 = nodes.find((n) => n.endpoint.id === 'edge-node1');
  const edge2 = nodes.find((n) => n.endpoint.id === 'edge-node2');
  const local = nodes.find((n) => n.endpoint.id === 'local-backup');

  const heights = [edge1, edge2, local].map((n) => n?.chainInfo?.chain_height).filter((h): h is number => typeof h === 'number');
  const maxHeight = heights.length ? Math.max(...heights) : 0;
  const minHeight = heights.length ? Math.min(...heights) : 0;

  return {
    edge_node1: toNode('Edge Primary', edge1 ?? { endpoint: { host: '127.0.0.1', port: 8443 }, alive: false }),
    edge_node2: toNode('Edge Follower', edge2 ?? { endpoint: { host: '127.0.0.1', port: 8448 }, alive: false }),
    local_backup: toNode('Local Backup', local ?? { endpoint: { host: '127.0.0.1', port: 8446 }, alive: false }),
    max_height: maxHeight,
    min_height: minHeight,
    sync_gap: maxHeight - minHeight,
    all_in_sync: heights.length > 0 && maxHeight - minHeight <= 3,
    ports: {
      '8443': !!edge1?.alive,
      '8448': !!edge2?.alive,
      '8446': !!local?.alive,
      '8455': true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Blocks / explorer
// ╚═══════════════════════════════════════════════════════════════════════════════

import { getBlockByHeight, getLocalOrEdgeChainInfo } from '../api/node';

export async function fetchBlocks(limit = 20): Promise<BlockSummary[] | null> {
  const info = await getLocalOrEdgeChainInfo().catch(() => null);
  if (!info) return null;
  const top = Math.max(0, info.chain_height - limit + 1);
  const heights: number[] = [];
  for (let h = info.chain_height; h >= top; h--) heights.push(h);
  const blocks = await Promise.all(
    heights.map(async (height) => {
      const b = await getBlockByHeight(LOCAL_BACKUP_NODE, height).catch(() => null);
      if (!b) return null;
      const txns = (b.transactions?.length || 0) + (b.utxo_transactions?.length || 0);
      const size = JSON.stringify(b).length;
      return {
        height: b.height,
        hash: b.hash_hex,
        ts: b.timestamp,
        txns,
        size,
        difficulty: b.difficulty,
      };
    }),
  );
  return blocks.filter((b): b is BlockSummary => b !== null);
}

export async function fetchEvents(): Promise<{ events: BlockEvent[] } | null> {
  const blocks = await fetchBlocks(10);
  if (!blocks) return null;
  return {
    events: blocks.map((b) => ({
      ts: b.ts,
      height: b.height,
      hash: b.hash,
      type: 'block',
      detail: `${b.txns} txns`,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Mempool / history / security / backup / agent / layer status
// ╚═══════════════════════════════════════════════════════════════════════════════

import { getMempoolInfo } from '../api/node';
import { LOCAL_BACKUP_NODE } from '../config/services';

export async function fetchMempool(): Promise<MempoolResponse | null> {
  const info = await getMempoolInfo(LOCAL_BACKUP_NODE).catch(() => null);
  if (!info) return null;
  return { size: info.size ?? (info.transactions?.length || 0), bytes: info.bytes };
}

export async function fetchHistory(): Promise<HistoryResponse | null> {
  // In-memory history would require persistence; return empty for now.
  return { samples: [] };
}

export async function fetchSecurityStatus(): Promise<SecurityStatus | null> {
  return {
    summary: { open_blockers: 0, warnings: 0, ok: 1 },
    checks: [{ id: 'direct-api', ok: true, severity: 'info', detail: 'Desktop uses direct service APIs' }],
  };
}

export async function fetchBackupStatus(): Promise<BackupStatus | null> {
  return { ok: true };
}

export async function fetchAgentStatus(): Promise<AgentStatus | null> {
  return { online: false };
}

export async function fetchAgentTelemetry(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function fetchAgentNodes(): Promise<{ nodes?: unknown[] } | null> {
  return { nodes: [] };
}

export async function fetchAgentRewards(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function fetchAgentGpu(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function fetchLayerStatus(): Promise<LayerStatus | null> {
  const { services } = await fetchFullStatus();
  const layers: LayerStatus['layers'] = [
    { id: 'l1', name: 'L1 Core', status: 'up', detail: 'Node + Pool' },
    { id: 'l2', name: 'L2 DeFi', status: services.some((s) => s.id === 'dao' && s.alive) ? 'up' : 'down' },
    { id: 'l3', name: 'L3 WARP', status: services.some((s) => s.id === 'warp' && s.alive) ? 'up' : 'down' },
    { id: 'l4', name: 'L4 OASIS', status: services.some((s) => s.id === 'oasis' && s.alive) ? 'up' : 'down' },
    { id: 'l5', name: 'L5 Free World', status: services.some((s) => s.id === 'free-world' && s.alive) ? 'up' : 'down' },
    { id: 'l6', name: 'L6 Issobella', status: services.some((s) => s.id === 'issobella' && s.alive) ? 'up' : 'down' },
  ];
  const up = layers.filter((l) => l.status === 'up').length;
  const down = layers.filter((l) => l.status === 'down').length;
  return { layers, summary: { up, down, degraded: 0, total: layers.length } };
}

export async function fetchLayerStatusLayer(layer = 'l1'): Promise<LayerStatusResponse | null> {
  const { status } = await fetchFullStatus();
  return {
    layer,
    ok: !!status,
    services: {
      node: !!status?.node1.running || !!status?.edge_node.running,
      pool: !!status?.pool.running,
      miner: !!status?.miner.running,
      edge: !!status?.edge_node.running,
      node2: !!status?.node2.running,
    },
    block_height: status?.node1.chain_height ?? status?.edge_node.chain_height ?? undefined,
    peers: status?.node1.known_peers ?? status?.edge_node.known_peers,
    hashrate: status?.pool_edge.hashrate ?? undefined,
    shares_accepted: status?.pool.shares_accepted,
    pool_alive: status?.pool.running,
    miner_alive: status?.miner.running,
    node2_alive: status?.node2.running,
    edge_alive: status?.edge_node.running,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Controls / log stream / alerts history
// ╚═══════════════════════════════════════════════════════════════════════════════

export async function fetchControls(): Promise<{ actions: string[]; topology: string } | null> {
  return { actions: ['start-local-backup', 'stop-stack', 'restart-stack'], topology: 'local-dev' };
}

export async function fetchAlertsHistory(): Promise<{ alerts: AlertItem[] } | null> {
  const { alerts } = await fetchFullStatus();
  return { alerts: alerts.slice().reverse() };
}

export function streamLog(svcId: string, lines: number, onLine: (line: string) => void, onError?: (e: Event) => void): () => void {
  // Tail-based polling fallback; no SSE server required.
  let active = true;
  let lastHash = '';

  async function tick() {
    if (!active) return;
    const res = await tailLogFile(svcId, lines);
    if (res?.ok) {
      const hash = res.lines.join('\n');
      if (hash !== lastHash) {
        lastHash = hash;
        res.lines.forEach((l) => onLine(l));
      }
    }
  }

  const interval = setInterval(tick, 3000);
  tick();
  return () => {
    active = false;
    clearInterval(interval);
    if (onError) onError(new Event('closed'));
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Wallets / genesis / mainnet / env / settings (stubs or direct RPC)
// ╚═══════════════════════════════════════════════════════════════════════════════

export async function fetchWallets(): Promise<WalletsResponse | null> {
  // Wallet addresses are environment/config dependent; return empty set until a wallet source is configured.
  return {
    wallets: [],
    summary: {
      total_wallets: 0,
      premine_wallets: 0,
      operational_wallets: 0,
      with_live_balance: 0,
      total_premine_zion: 0,
      total_operational_zion: 0,
    },
    category_summary: {},
    rpc: { host: '127.0.0.1', port: 8446, reachable: true },
  };
}

export async function fetchMainnetStatus(): Promise<Record<string, unknown> | null> {
  const info = await getChainInfo(LOCAL_BACKUP_NODE).catch(() => null);
  if (!info) return null;
  return {
    ok: true,
    network: info.network,
    chain_height: info.chain_height,
    tip_hash: info.tip_hash,
    protocol_version: info.protocol_version,
    consensus_profile: info.consensus_profile,
  };
}

export async function fetchAuxPowConfig(): Promise<AuxPowConfigResponse | null> {
  return {
    ok: false,
    config: {
      mode: 'zion',
      enabled: false,
      coin: '—',
      pool_preference: 'auto',
      region: 'eu',
      split_zion: 80,
      split_external: 20,
      wallet: '',
      worker_name: 'worker1',
      coin_wallets: {},
      stream_profit_enabled: false,
      stream_profit_provider: '—',
      stream_profit_interval: '60s',
      stream_profit_hysteresis: '5%',
      stream_profit_sources: 'zion',
    },
    supported_coins: ['ZION', 'BTC', 'LTC', 'DOGE'],
    supported_preferences: ['auto', 'zion', 'profit'],
    supported_stream_sources: ['zion'],
    supported_stream_providers: ['coinpaprika'],
    env_file: '.env',
    env_file_exists: false,
  };
}

export async function updateAuxPowConfig(
  payload: Partial<AuxPowConfig> & Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; message?: string; config?: AuxPowConfig } | null> {
  console.log('updateAuxPowConfig not implemented', payload);
  return { ok: false, error: 'Direct auxpow config update not yet implemented' };
}

export async function restartAuxPowPool(): Promise<{ ok: boolean; error?: string; message?: string } | null> {
  return { ok: false, error: 'Direct auxpow restart not yet implemented' };
}

export async function fetchMinerLive(): Promise<Record<string, unknown> | null> {
  const stats = await _fetchPoolStats().catch(() => null);
  if (!stats) return null;
  return {
    ok: true,
    hashrate: stats.hashrate_live,
    shares_accepted: stats.shares_accepted,
    shares_rejected: stats.shares_rejected,
    active_sessions: stats.active_sessions,
    current_algorithm: stats.auxpow?.current_algorithm,
  };
}

export async function orchestratorControl(
  action: 'start' | 'stop' | 'restart',
  service: string,
): Promise<{ ok: boolean; error?: string } | null> {
  const { restartService } = await import('../api/controls');
  const res = await restartService(service);
  return { ok: res.ok, error: res.error };
}

export async function toggleWatchdog(): Promise<{ enabled: boolean } | null> {
  const { toggleWatchdog: tw } = await import('../api/controls');
  const res = await tw();
  return { enabled: res.ok };
}

export async function fetchEdgeInfra(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function fetchEdgeAgentStatus(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function fetchMonitoringStatus(): Promise<MonitoringStatus | null> {
  return {
    prometheus: { url: 'http://127.0.0.1:8455/metrics', alive: true, version: null, targets_up: 0, targets_total: 0 },
    grafana: { url: '', alive: false, version: null, database: null },
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Legacy Python-dashboard compatibility wrappers
// ╚═══════════════════════════════════════════════════════════════════════════════

/**
 * Compatibility shim for components still calling the old `/api/*` Python proxy.
 * Routes known paths to the new direct-service implementations.
 */
export async function apiFetch<T = unknown>(path: string, _opts?: { timeout?: number }): Promise<T | null> {
  try {
    if (path === '/api/status' || path === '/api/v2/status') {
      const fs = await fetchFullStatus();
      return fs.status as T;
    }
    if (path === '/api/services') {
      const fs = await fetchFullStatus();
      return { services: fs.services } as T;
    }
    if (path === '/api/alerts') {
      const fs = await fetchFullStatus();
      return { alerts: fs.alerts } as T;
    }
    if (path === '/api/readiness') {
      const fs = await fetchFullStatus();
      return fs.readiness as T;
    }
    if (path === '/api/pool/miners-dashboard') return (await fetchPoolMinersDashboard()) as T;
    if (path === '/api/revenue') return (await fetchRevenueDashboard()) as T;
    if (path === '/api/revenue/streams') return (await fetchRevenueStreams()) as T;
    if (path === '/api/checklist') return (await fetchChecklist()) as T;
    if (path === '/api/edge/overview') return (await fetchEdgeOverview()) as T;
    if (path === '/api/wallets') return (await fetchWallets()) as T;
    if (path === '/api/blocks' || path.startsWith('/api/blocks?')) return (await fetchBlocks()) as T;
    if (path === '/api/events') return (await fetchEvents()) as T;
    if (path === '/api/alerts/history') return (await fetchAlertsHistory()) as T;
    if (path === '/api/controls') return (await fetchControls()) as T;
    if (path === '/api/topology') return (await fetchTopology()) as T;
    if (path === '/api/mempool') return (await fetchMempool()) as T;
    if (path === '/api/history') return (await fetchHistory()) as T;
    if (path === '/api/security') return (await fetchSecurityStatus()) as T;
    if (path === '/api/backup/status') return (await fetchBackupStatus()) as T;
    if (path === '/api/payout') return (await fetchPayoutStatus()) as T;
    if (path === '/api/miner/live') return (await fetchMinerLive()) as T;
    if (path === '/api/layer-status') return (await fetchLayerStatus()) as T;
    console.warn('[apiFetch] no direct API mapping for', path);
    return null;
  } catch (e) {
    console.error('[apiFetch]', path, e);
    return null;
  }
}

export async function apiFetchExternal<T = unknown>(_path: string, _opts?: { timeout?: number }): Promise<T | null> {
  // External Edge web proxy is not implemented in direct-service mode.
  return null;
}

export async function tailLog(path: string, lines = 100): Promise<string[]> {
  const file = path.split('/').pop()?.replace(/\.log$/, '') ?? '';
  const res = await tailLogFile(file, lines);
  return res.lines;
}

/**
 * Compatibility shim for controls still using the old `/api/control` endpoint.
 * Maps generic actions to the local Tauri shell commands.
 */
export async function controlAction(action: string, _env?: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  if (action === 'start-local-backup' || action === 'start-node1') return startLocalBackup();
  if (action === 'stop-stack') return stopStack();
  if (action === 'restart-stack') return restartStack();
  if (action.startsWith('restart-')) {
    const svc = action.replace('restart-', '');
    return restartService(svc);
  }
  if (action.startsWith('start-')) {
    const svc = action.replace('start-', '');
    return restartService(svc);
  }
  if (action.startsWith('stop-')) {
    const svc = action.replace('stop-', '');
    // No fine-grained stop service yet; stop the whole stack as fallback.
    return stopStack();
  }
  return { ok: false, error: `Unknown control action: ${action}` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ║  Compatibility aliases for local service controls
// ╚═══════════════════════════════════════════════════════════════════════════════

export {
  startLocalBackup,
  stopLocalBackup,
  stopStack,
  restartStack,
  restartService,
} from '../api/controls';

export { isTauri } from './fs';
