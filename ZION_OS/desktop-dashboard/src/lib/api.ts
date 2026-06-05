const API_BASE = 'http://127.0.0.1:8766';
const EDGE_HOST = '100.76.16.108';
const LOCAL_HOST = '127.0.0.1';

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

export async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
    });
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
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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

export async function controlAction(action: string): Promise<{ ok: boolean; error?: string }> {
  return apiPost<{ ok: boolean; error?: string }>('/api/control', { action }) ?? { ok: false, error: 'Network error' };
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
