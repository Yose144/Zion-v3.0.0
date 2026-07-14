const API_BASE = 'http://127.0.0.1:8766';
const EDGE_HOST = '100.76.16.108';
const LOCAL_HOST = '127.0.0.1';
export const EDGE_WEB = 'https://zionterranova.com';

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
  let path = '/api/control';
  let body: unknown = { action, env };
  if (action === 'start-miner') {
    path = '/api/miner/start';
    body = {};
  } else if (action === 'stop-miner') {
    path = '/api/miner/stop';
    body = {};
  } else if (action === 'restart-miner') {
    path = '/api/miner/restart';
    body = env?.ZION_MINER_ALGORITHM ? { algorithm: env.ZION_MINER_ALGORITHM } : {};
  }
  const res = await apiPost<{ ok: boolean; error?: string }>(path, body);
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
}

export async function fetchPoolMinersDashboard(): Promise<PoolMinersDashboard | null> {
  return apiFetch<PoolMinersDashboard>('/api/pool/miners-dashboard');
}
