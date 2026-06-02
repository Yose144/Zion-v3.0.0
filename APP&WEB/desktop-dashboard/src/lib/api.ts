import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'http://127.0.0.1:8766';

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

export interface PayoutStatus {
  pool_wallet?: string;
  payout_enabled?: boolean;
  blocks_found?: number;
  last_payout_time?: string;
  payouts?: Array<{
    block_height: number;
    fee_split: { miner: number; charity: number; dev: number; pool: number };
  }>;
}

// ── Native Tauri commands ─────────────────────────────────

export async function probeTcp(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  try {
    return await invoke('probe_tcp', { host, port, timeoutMs });
  } catch (e) {
    console.error('probeTcp error', e);
    return false;
  }
}

export async function rpcCall(url: string, method: string, params?: unknown): Promise<unknown> {
  return invoke('rpc_call', { url, method, params });
}

export async function tailLog(path: string, lines = 100): Promise<string[]> {
  return invoke('tail_log', { path, lines });
}

export async function runCommand(cmd: string, args: string[]): Promise<string> {
  return invoke('run_command', { cmd, args });
}

export async function startLocalBackup(repoRoot?: string): Promise<string> {
  return invoke('start_local_backup', { repoRoot });
}

export async function stopLocalBackup(repoRoot?: string): Promise<string> {
  return invoke('stop_local_backup', { repoRoot });
}

export async function getLocalBackupStatus(repoRoot?: string): Promise<{
  node_running: boolean;
  miner_running: boolean;
}> {
  return invoke('get_local_backup_status', { repoRoot });
}

export async function tailscalePing(target: string = '100.76.16.108'): Promise<{
  ok: boolean;
  latency_ms?: number;
  error?: string;
}> {
  try {
    const stdout = await runCommand('tailscale', ['ping', '-c', '1', '-timeout', '3s', target]);
    const match = stdout.match(/(\d+)\.?\d*ms/);
    const latency = match ? parseInt(match[1], 10) : undefined;
    return { ok: true, latency_ms: latency };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

// ── HTTP Fallback (Python dashboard backend) ──────────────

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

export async function controlAction(action: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${API_BASE}/api/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    return (await r.json()) as { ok: boolean; error?: string };
  } catch (e) {
    console.error('controlAction error', e);
    return { ok: false, error: String(e) };
  }
}
