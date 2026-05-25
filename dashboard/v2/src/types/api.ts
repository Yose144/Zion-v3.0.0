// ─── ZION Dashboard v2 — API Type Definitions ────────────────────────────────

// ── Shared primitives ──────────────────────────────────────────────────────

export type ServiceName =
  | 'node1' | 'node2' | 'pool' | 'pool-edge' | 'miner'
  | 'bridge' | 'dao' | 'swap' | 'warp' | 'oasis'
  | 'hiran' | 'hiranyagarbha' | 'freeworld' | 'space';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// ── /api/status ────────────────────────────────────────────────────────────

export interface NodeStatus {
  running: boolean;
  block_height: number;
  best_hash: string;
  peers: number;
  version: string;
  syncing: boolean;
  mempool_size: number;
}

export interface PoolStatus {
  running: boolean;
  connected_miners: number;
  hashrate_hs: number;
  accepted_shares: number;
  rejected_shares: number;
}

export interface MinerStatus {
  running: boolean;
  hashrate_hs: number;
  gpu_temp?: number;
  gpu_load?: number;
  accepted: number;
  rejected: number;
}

export interface ResourceUsage {
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
}

export interface StatusResponse {
  node1?: NodeStatus;
  node2?: NodeStatus;
  pool?: PoolStatus;
  'pool-edge'?: PoolStatus;
  miner?: MinerStatus;
  resources?: ResourceUsage;
  uptime_seconds?: number;
  timestamp?: number;
}

// ── /api/health ───────────────────────────────────────────────────────────

export type HealthMap = Record<ServiceName, HealthStatus>;

// ── /api/events ──────────────────────────────────────────────────────────

export interface ZionEvent {
  id: string;
  ts: number;               // unix ms
  type: string;
  severity: AlertSeverity;
  message: string;
  service?: ServiceName;
}

// ── /api/history (metrics) ───────────────────────────────────────────────

export interface MetricPoint {
  ts: number;
  cpu: number;
  ram: number;
  hashrate: number;
  peers: number;
  block_height: number;
}

// ── /api/mempool ─────────────────────────────────────────────────────────

export interface MempoolEntry {
  txid: string;
  fee: number;
  size: number;
  age_s: number;
}

export interface MempoolResponse {
  count: number;
  entries: MempoolEntry[];
}

// ── /api/block ───────────────────────────────────────────────────────────

export interface BlockSummary {
  height: number;
  hash: string;
  ts: number;
  txns: number;
  miner: string;
  size: number;
}

export interface BlockDetail extends BlockSummary {
  prev_hash: string;
  merkle_root: string;
  difficulty: number;
  nonce: number;
  transactions: TxSummary[];
}

export interface TxSummary {
  txid: string;
  inputs: number;
  outputs: number;
  total_value: number;
  fee: number;
}

// ── /api/wallets ─────────────────────────────────────────────────────────

export interface WalletEntry {
  label: string;
  address: string;
  balance: number;
  type: 'premine' | 'operational' | 'fee';
}

// ── /api/env ─────────────────────────────────────────────────────────────

export interface EnvFile {
  path: string;
  content: string;
}

// ── /api/controls ────────────────────────────────────────────────────────

export interface ControlsConfig {
  rpc_url: string;
  pool_addr: string;
  worker_name: string;
  loop_count: number;
  nonce_count: number;
  gpu_work_size: number;
  autostart: boolean;
}

// ── /api/alerts ──────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  ts: number;
  severity: AlertSeverity;
  title: string;
  body: string;
  dismissed: boolean;
}

// ── /api/topology ────────────────────────────────────────────────────────

export interface TopoNode {
  id: string;
  label: string;
  type: 'node' | 'pool' | 'miner' | 'service';
  status: HealthStatus;
  host: string;
  port: number;
}

export interface TopoEdge {
  source: string;
  target: string;
  label?: string;
}

export interface TopologyResponse {
  nodes: TopoNode[];
  edges: TopoEdge[];
}

// ── /api/hiran/* ──────────────────────────────────────────────────────────

export interface HiranStatus {
  running: boolean;
  model: string;
  backend: 'llama-server' | 'lm-studio' | 'ollama' | 'serve-py' | 'unknown';
  inference_url: string;
  context_length: number;
}

export interface HiranChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HiranChatRequest {
  messages: HiranChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface HiranChatResponse {
  id: string;
  message: HiranChatMessage;
  usage: { prompt_tokens: number; completion_tokens: number };
}

// ── /api/dao/* ────────────────────────────────────────────────────────────

export interface DaoProposal {
  id: number;
  title: string;
  status: 'active' | 'passed' | 'failed' | 'pending';
  yes_votes: number;
  no_votes: number;
  deadline_ts: number;
}

// ── /api/backup/* ────────────────────────────────────────────────────────

export interface BackupInfo {
  filename: string;
  created_ts: number;
  size_bytes: number;
  verified: boolean;
}

// ── /api/cli/run ─────────────────────────────────────────────────────────

export interface CliRunRequest {
  command: string;
  args?: string[];
}

export interface CliRunResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

// ── WebSocket message union ───────────────────────────────────────────────

export interface WsLogMessage {
  type: 'log';
  service: ServiceName;
  line: string;
  ts: number;
}

export interface WsStatusMessage {
  type: 'status';
  data: StatusResponse;
}

export interface WsAlertMessage {
  type: 'alert';
  data: Alert;
}

export interface WsHealthMessage {
  type: 'health';
  data: HealthMap;
}

export type WsMessage = WsLogMessage | WsStatusMessage | WsAlertMessage | WsHealthMessage;
