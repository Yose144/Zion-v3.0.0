// ─── ZION Dashboard v2 — API Client ─────────────────────────────────────────
import type {
  StatusResponse, HealthMap, ZionEvent, MetricPoint,
  MempoolResponse, BlockDetail, BlockSummary, WalletEntry,
  EnvFile, ControlsConfig, Alert, TopologyResponse,
  HiranStatus, HiranChatRequest, HiranChatResponse,
  DaoProposal, BackupInfo, CliRunRequest, CliRunResponse,
  NclJob, NclWorker, NclEntry,
} from '../types/api';

// ── Config ──────────────────────────────────────────────────────────────────

const BASE = '';          // same-origin (Vite proxy forwards /api → :8766)
const DEFAULT_TIMEOUT = 10_000;
const MAX_RETRIES = 2;

// ── Fetch wrapper ────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { timeout?: number } = {},
  retries = MAX_RETRIES,
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...init } = options;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}: ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    if (retries > 0 && !(err instanceof ApiError)) {
      await sleep(500);
      return apiFetch<T>(path, options, retries - 1);
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── API endpoints ────────────────────────────────────────────────────────────

export const api = {

  // ── Status & health ─────────────────────────────────────────────────────

  status: () => apiFetch<StatusResponse>('/api/status'),
  health: () => apiFetch<HealthMap>('/api/health'),

  // ── Events & metrics history ─────────────────────────────────────────────

  events: () => apiFetch<ZionEvent[]>('/api/events'),
  history: () => apiFetch<MetricPoint[]>('/api/history'),

  // ── Mempool & Explorer ───────────────────────────────────────────────────

  mempool: () => apiFetch<MempoolResponse>('/api/mempool'),
  blocks: (limit = 20) => apiFetch<BlockSummary[]>(`/api/blocks?limit=${limit}`),
  block: (hashOrHeight: string | number) => apiFetch<BlockDetail>(`/api/block/${hashOrHeight}`),

  // ── Wallets ──────────────────────────────────────────────────────────────

  wallets: () => apiFetch<WalletEntry[]>('/api/wallets'),

  // ── Env & Controls ───────────────────────────────────────────────────────

  env: () => apiFetch<EnvFile[]>('/api/env'),
  controls: () => apiFetch<ControlsConfig>('/api/controls'),
  controlsSave: (cfg: Partial<ControlsConfig>) => apiPost<{ ok: boolean }>('/api/controls', cfg),

  // ── Alerts ───────────────────────────────────────────────────────────────

  alerts: () => apiFetch<Alert[]>('/api/alerts'),
  alertDismiss: (id: string) => apiPost<{ ok: boolean }>('/api/alerts/dismiss', { id }),

  // ── Topology ─────────────────────────────────────────────────────────────

  topology: () => apiFetch<TopologyResponse>('/api/topology'),

  // ── Service control ──────────────────────────────────────────────────────

  serviceStart:   (svc: string) => apiPost<{ ok: boolean }>(`/api/service/${svc}/start`, {}),
  serviceStop:    (svc: string) => apiPost<{ ok: boolean }>(`/api/service/${svc}/stop`, {}),
  serviceRestart: (svc: string) => apiPost<{ ok: boolean }>(`/api/service/${svc}/restart`, {}),

  // ── Node actions ─────────────────────────────────────────────────────────

  nodeStart: ()  => apiPost<{ ok: boolean }>('/api/node/start', {}),
  nodeStop:  ()  => apiPost<{ ok: boolean }>('/api/node/stop', {}),
  poolStart: ()  => apiPost<{ ok: boolean }>('/api/pool/start', {}),
  poolStop:  ()  => apiPost<{ ok: boolean }>('/api/pool/stop', {}),
  minerStart: () => apiPost<{ ok: boolean }>('/api/miner/start', {}),
  minerStop:  () => apiPost<{ ok: boolean }>('/api/miner/stop', {}),

  // ── CLI ──────────────────────────────────────────────────────────────────

  cliRun: (req: CliRunRequest) => apiPost<CliRunResponse>('/api/cli/run', req),
  cliNodeStatus: () => apiFetch<CliRunResponse>('/api/cli/node-status'),
  cliStatus:     () => apiFetch<CliRunResponse>('/api/cli/status'),

  // ── Backup ───────────────────────────────────────────────────────────────

  backups: () => apiFetch<BackupInfo[]>('/api/backup/list'),
  backupCreate:  () => apiPost<{ ok: boolean; filename: string }>('/api/backup/create', {}),
  backupVerify:  (filename: string) => apiPost<{ ok: boolean; message: string }>('/api/backup/verify', { filename }),
  backupRestore: (filename: string) => apiPost<{ ok: boolean }>('/api/backup/restore', { filename }),
  backupTrigger: () => apiPost<{ ok: boolean }>('/api/backup/trigger', {}),

  // ── Hiran ────────────────────────────────────────────────────────────────

  hiranStatus: () => apiFetch<HiranStatus>('/api/hiran/status'),
  hiranHealth: () => apiFetch<{ healthy: boolean }>('/api/hiran/health'),
  hiranChat:   (req: HiranChatRequest) => apiPost<HiranChatResponse>('/api/hiran/chat', req),

  // ── Hiranyagarbha ────────────────────────────────────────────────────────

  hiranyagarbhaHealth: () => apiFetch<{ healthy: boolean }>('/api/hiranyagarbha/health'),

  // ── DAO ──────────────────────────────────────────────────────────────────

  daoProposals: () => apiFetch<DaoProposal[]>('/api/dao/proposals'),
  daoHealth:    () => apiFetch<{ healthy: boolean }>('/api/dao/health'),

  // ── Bridge / Swap / Warp / Oasis / Space / Freeworld ────────────────────

  bridgeHealth:  () => apiFetch<{ healthy: boolean }>('/api/bridge/health'),
  swapHealth:    () => apiFetch<{ healthy: boolean }>('/api/swap/health'),
  warpHealth:    () => apiFetch<{ healthy: boolean }>('/api/warp/health'),
  oasisStats:    () => apiFetch<Record<string, unknown>>('/api/oasis/stats'),
  spaceStats:    () => apiFetch<Record<string, unknown>>('/api/space/stats'),
  freeworldStats: () => apiFetch<Record<string, unknown>>('/api/freeworld/stats'),

  // ── DB ───────────────────────────────────────────────────────────────────

  db:        () => apiFetch<Record<string, unknown>>('/api/db'),
  dbInspect: () => apiFetch<Record<string, unknown>>('/api/db/inspect'),

  // ── Launch day ───────────────────────────────────────────────────────────

  launchDayStatus: () => apiFetch<Record<string, unknown>>('/api/launch-day/status'),

  // ── v2 batch ─────────────────────────────────────────────────────────────

  v2Status: () => apiFetch<{
    status: StatusResponse;
    health: HealthMap;
    events: ZionEvent[];
    checklist: Record<string, unknown>;
  }>('/api/v2/status'),

  // ── NCL (via Hiranyagarbha :8001) ─────────────────────────────────────────

  nclJobs:        () => apiFetch<{ jobs: NclJob[] }>('/ncl/jobs'),
  nclWorkers:     () => apiFetch<{ workers: NclWorker[] }>('/ncl/workers'),
  nclLeaderboard: () => apiFetch<{ entries: NclEntry[] }>('/ncl/leaderboard'),
};

export { ApiError };
export default api;
