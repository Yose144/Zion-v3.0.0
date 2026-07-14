const API_BASE = 'http://127.0.0.1:8766';
const LOCAL_HOST = '127.0.0.1';
export const EDGE_WEB = 'https://zionterranova.com';
// Legacy/decommissioned IP removed — current Edge server is configured server-side in dashboard/app.py.

// Optional Basic Auth for local Python dashboard (set VITE_DASHBOARD_USER / VITE_DASHBOARD_PASS)
const DASHBOARD_USER = import.meta.env.VITE_DASHBOARD_USER as string | undefined;
const DASHBOARD_PASS = import.meta.env.VITE_DASHBOARD_PASS as string | undefined;
const AUTH_HEADER = (DASHBOARD_USER && DASHBOARD_PASS)
  ? `Basic ${btoa(`${DASHBOARD_USER}:${DASHBOARD_PASS}`)}`
  : undefined;

// ── Types ─────────────────────────────────────────────────

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

// ── HTTP Helpers ──────────────────────────────────────────

export async function apiFetchExternal<T>(path: string, opts?: { timeout?: number }): Promise<T | null> {
  return apiFetch<T>(`/api/proxy/edge?path=${encodeURIComponent(path)}`, opts);
}

export async function apiFetch<T>(path: string, opts?: { timeout?: number }): Promise<T | null> {
  try {
    const timeout = opts?.timeout;
    const controller = timeout ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : undefined;
    const r = await fetch(`${API_BASE}${path}`, {
      signal: controller ? controller.signal : undefined,
      headers: { Accept: 'application/json', ...(AUTH_HEADER ? { Authorization: AUTH_HEADER } : {}) },
    });
    if (timer) clearTimeout(timer);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return (await r.json()) as T;
  } catch (e) {
    console.error('API error', path, e);
    return null;
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(AUTH_HEADER ? { Authorization: AUTH_HEADER } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return (await r.json()) as T;
  } catch (e) {
    console.error('API POST error', path, e);
    return null;
  }
}

// ── TCP Probe (browser-compatible via fetch timeout) ────

export async function probeTcp(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  // Browser nemůže přímo TCP. Pro lokální služby použijeme fetch na HTTP endpoint.
  // Pro RPC porty zkusíme HEAD request s krátkým timeoutem.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`http://${host}:${port}/health`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── RPC Call (via Python dashboard proxy) ─────────────────

export async function rpcCall(url: string, method: string, params?: unknown): Promise<unknown> {
  const r = await fetch(`${API_BASE}/api/proxy/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(AUTH_HEADER ? { Authorization: AUTH_HEADER } : {}) },
    body: JSON.stringify({ url, method, params }),
  });
  return r.json();
}

// ── Tail Log (via Python dashboard) ───────────────────────

export async function tailLog(path: string, lines = 100): Promise<string[]> {
  const r = await apiFetch<{ lines: string[] }>(`/api/logs/tail?path=${encodeURIComponent(path)}&lines=${lines}`);
  return r?.lines ?? [];
}

// ── Control Actions ───────────────────────────────────────

export async function controlAction(action: string, env?: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  // dashboard/app.py exposes a single /api/control endpoint for all actions.
  const res = await apiPost<{ ok: boolean; error?: string }>('/api/control', { action, env });
  return res ?? { ok: false, error: 'Network error' };
}

// Stubs for legacy components (TODO: wire to real endpoints)
export async function startLocalBackup(): Promise<string> {
  return 'not implemented';
}
export async function stopLocalBackup(): Promise<string> {
  return 'not implemented';
}
export async function getLocalBackupStatus(): Promise<{ node_running: boolean; miner_running: boolean }> {
  return { node_running: false, miner_running: false };
}
export async function tailscalePing(): Promise<{ ok: boolean; latency_ms?: number }> {
  return { ok: false };
}

// ── Desktop Notifications (browser API) ───────────────────

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

// ── Service Status Aggregation ──────────────────────────

export async function fetchFullStatus(): Promise<{
  status: V3Status | null;
  services: ServiceHealth[];
  alerts: AlertItem[];
  readiness: ReadinessScore | null;
  monitoring: MonitoringStatus | null;
}> {
  const [st, sv, al, rd, mon] = await Promise.all([
    apiFetch<V3Status>('/api/status'),
    apiFetch<{ services: ServiceHealth[] }>('/api/services'),
    apiFetch<{ alerts: AlertItem[] }>('/api/alerts'),
    apiFetch<ReadinessScore>('/api/readiness'),
    apiFetch<MonitoringStatus>('/api/monitoring/status'),
  ]);

  return {
    status: st,
    services: sv?.services ?? [],
    alerts: al?.alerts ?? [],
    readiness: rd,
    monitoring: mon,
  };
}

// ── Pool Miners Dashboard ───────────────────────────────────────────────

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

export async function fetchPoolMinersDashboard(): Promise<PoolMinersDashboard | null> {
  return apiFetch<PoolMinersDashboard>('/api/pool/miners-dashboard');
}

// ── Revenue Dashboard ───────────────────────────────────────────────

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

export async function fetchRevenueDashboard(): Promise<RevenueDashboard | null> {
  return apiFetch<RevenueDashboard>('/api/revenue');
}

export async function fetchRevenueStreams(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/revenue/streams');
}

// ── Checklist ───────────────────────────────────────────────

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

export async function fetchChecklist(): Promise<Checklist | null> {
  return apiFetch<Checklist>('/api/checklist');
}

// ── Wallets ───────────────────────────────────────────────

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

export async function fetchWallets(): Promise<WalletsResponse | null> {
  return apiFetch<WalletsResponse>('/api/wallets');
}

// ── Explorer / Blocks ───────────────────────────────────────────────

export interface BlockSummary {
  height: number;
  hash: string;
  ts: number;
  txns: number;
  size: number;
  difficulty: number;
}

export async function fetchBlocks(limit = 20): Promise<BlockSummary[] | null> {
  return apiFetch<BlockSummary[]>(`/api/blocks?limit=${limit}`);
}

// ── Edge Overview ───────────────────────────────────────────────

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

export async function fetchEdgeOverview(): Promise<EdgeOverview | null> {
  return apiFetch<EdgeOverview>('/api/edge/overview');
}

// ── Events & Alerts ───────────────────────────────────────────────

export interface BlockEvent {
  ts: number;
  height: number;
  hash: string;
  type: string;
  detail: string;
}

export async function fetchEvents(): Promise<{ events: BlockEvent[] } | null> {
  return apiFetch<{ events: BlockEvent[] }>('/api/events');
}

export async function fetchAlertsHistory(): Promise<{ alerts: AlertItem[] } | null> {
  return apiFetch<{ alerts: AlertItem[] }>('/api/alerts/history');
}

// ── Control Actions ───────────────────────────────────────────────

export async function fetchControls(): Promise<{ actions: string[]; topology: string } | null> {
  return apiFetch<{ actions: string[]; topology: string }>('/api/controls');
}

// ── AuxPow Config ───────────────────────────────────────────────────

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

export async function fetchAuxPowConfig(): Promise<AuxPowConfigResponse | null> {
  return apiFetch<AuxPowConfigResponse>('/api/pool/auxpow');
}

export async function updateAuxPowConfig(payload: Partial<AuxPowConfig> & Record<string, unknown>): Promise<{ ok: boolean; error?: string; message?: string; config?: AuxPowConfig } | null> {
  return apiPost<{ ok: boolean; error?: string; message?: string; config?: AuxPowConfig }>('/api/pool/auxpow', payload);
}

export async function restartAuxPowPool(): Promise<{ ok: boolean; error?: string; message?: string } | null> {
  return apiPost<{ ok: boolean; error?: string; message?: string }>('/api/pool/auxpow/restart', {});
}

// ── Payout Status ───────────────────────────────────────────────────

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

export async function fetchPayoutStatus(): Promise<PayoutStatus | null> {
  return apiFetch<PayoutStatus>('/api/payout');
}

// ── Log Files ───────────────────────────────────────────────────────

export interface LogFileInfo {
  name: string;
  svc_id: string;
  size_kb: number;
  modified: string;
}

export interface LogFilesResponse {
  files: LogFileInfo[];
  log_dir: string;
}

export async function fetchLogFiles(): Promise<LogFilesResponse | null> {
  return apiFetch<{ files: LogFileInfo[]; log_dir: string }>('/api/log-files');
}

// SSE log stream — returns an EventSource-like callback
export function streamLog(svcId: string, lines: number, onLine: (line: string) => void, onError?: (e: Event) => void): () => void {
  const url = `${API_BASE}/api/logs/stream?svc=${encodeURIComponent(svcId)}&lines=${lines}`;
  const es = new EventSource(url);
  es.onmessage = (e) => onLine(e.data);
  if (onError) es.onerror = onError;
  return () => es.close();
}

// ── Watchdog ────────────────────────────────────────────────────────

export async function toggleWatchdog(): Promise<{ enabled: boolean } | null> {
  return apiPost<{ enabled: boolean }>('/api/watchdog/toggle', {});
}

// ── Orchestrator ────────────────────────────────────────────────────

export async function orchestratorControl(action: 'start' | 'stop' | 'restart', service: string): Promise<{ ok: boolean; error?: string } | null> {
  return apiPost<{ ok: boolean; error?: string }>(`/api/orchestrator/${action}`, { service });
}

// ── Miner live stats ────────────────────────────────────────────────

export async function fetchMinerLive(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/miner/live');
}

// ── Agent telemetry ───────────────────────────────────────────────────

export interface AgentStatus {
  online: boolean;
  version?: string;
  uptime_seconds?: number;
  rigs_total?: number;
  rigs_online?: number;
}

export async function fetchAgentStatus(): Promise<AgentStatus | null> {
  return apiFetch<AgentStatus>('/api/agent/status');
}

export async function fetchAgentTelemetry(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/agent/telemetry');
}

export async function fetchAgentNodes(): Promise<{ nodes?: unknown[] } | null> {
  return apiFetch<{ nodes?: unknown[] }>('/api/agent/nodes');
}

export async function fetchAgentRewards(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/agent/rewards');
}

export async function fetchAgentGpu(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/agent/gpu');
}

// ── Edge infrastructure ─────────────────────────────────────────────

export async function fetchEdgeInfra(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/edge/infra');
}

export async function fetchEdgeAgentStatus(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/edge-agent/status');
}

// ── Layer status (L1-L6) ──────────────────────────────────────────────

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

export async function fetchLayerStatus(): Promise<LayerStatus | null> {
  return apiFetch<LayerStatus>('/api/layer-status');
}

export async function fetchLayerStatusLayer(layer = 'l1'): Promise<LayerStatusResponse | null> {
  return apiFetch<LayerStatusResponse>(`/api/layer-status?layer=${layer}`);
}

// ── Security status ───────────────────────────────────────────────────

export interface SecurityStatus {
  summary: { open_blockers: number; warnings: number; ok: number };
  checks: { id: string; ok: boolean; severity: 'critical' | 'warning' | 'info'; detail: string }[];
}

export async function fetchSecurityStatus(): Promise<SecurityStatus | null> {
  return apiFetch<SecurityStatus>('/api/security');
}

// ── Backup status ─────────────────────────────────────────────────────

export interface BackupStatus {
  ok: boolean;
  last_backup?: string;
  backups?: { name: string; size: number; age_seconds: number }[];
  error?: string;
}

export async function fetchBackupStatus(): Promise<BackupStatus | null> {
  return apiFetch<BackupStatus>('/api/backup/status');
}

// ── History & mempool ─────────────────────────────────────────────────

export interface HistorySample {
  ts: number;
  hashrate?: number;
  blocks?: number;
  difficulty?: number;
}

export interface HistoryResponse {
  samples: HistorySample[];
}

export async function fetchHistory(): Promise<HistoryResponse | null> {
  return apiFetch<HistoryResponse>('/api/history');
}

export interface MempoolResponse {
  size: number;
  bytes?: number;
  fee_estimates?: Record<string, number>;
}

export async function fetchMempool(): Promise<MempoolResponse | null> {
  return apiFetch<MempoolResponse>('/api/mempool');
}

// ── Mainnet status ────────────────────────────────────────────────────

export async function fetchMainnetStatus(): Promise<Record<string, unknown> | null> {
  return apiFetch<Record<string, unknown>>('/api/mainnet-status');
}

// ── Topology ────────────────────────────────────────────────────────────

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

export async function fetchTopology(): Promise<TopologyResponse | null> {
  return apiFetch<TopologyResponse>('/api/topology');
}
