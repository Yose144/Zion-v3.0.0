// ZION Desktop — direct service endpoints.
// Edit these values (or override via import.meta.env.VITE_* env vars) to point
// at your local stack. The defaults match the local PC backup-node topology.

export interface ServiceEndpoint {
  id: string;
  label: string;
  host: string;
  port: number;
  /** HTTP health/RPC path, if any. */
  healthPath?: string;
  /** Whether this is a JSON-RPC endpoint. */
  jsonrpc?: boolean;
  /** API base path for REST calls. */
  apiBase?: string;
  /** Optional metrics path for Prometheus exposition. */
  metricsPath?: string;
}

function envOr(key: string, fallback: string): string {
  try {
    return (import.meta.env[key] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

function envOrInt(key: string, fallback: number): number {
  const v = envOr(key, '');
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

// ── L1 nodes ─────────────────────────────────────────────────────────────
export const EDGE_NODE1: ServiceEndpoint = {
  id: 'edge-node1',
  label: 'Edge Primary Node',
  host: envOr('VITE_EDGE_NODE1_HOST', '127.0.0.1'),
  port: envOrInt('VITE_EDGE_NODE1_RPC_PORT', 8443),
  healthPath: '/health',
  jsonrpc: true,
};

export const EDGE_NODE2: ServiceEndpoint = {
  id: 'edge-node2',
  label: 'Edge Follower Node',
  host: envOr('VITE_EDGE_NODE2_HOST', '127.0.0.1'),
  port: envOrInt('VITE_EDGE_NODE2_RPC_PORT', 8448),
  healthPath: '/health',
  jsonrpc: true,
};

export const LOCAL_BACKUP_NODE: ServiceEndpoint = {
  id: 'local-backup',
  label: 'Local Backup Node',
  host: envOr('VITE_LOCAL_NODE_HOST', '127.0.0.1'),
  port: envOrInt('VITE_LOCAL_NODE_RPC_PORT', 8446),
  healthPath: '/health',
  jsonrpc: true,
};

// Preferred node for queries: local backup if available, otherwise Edge.
export const PREFERRED_NODE: ServiceEndpoint = LOCAL_BACKUP_NODE;
export const FALLBACK_NODE: ServiceEndpoint = EDGE_NODE1;

export const NODES = [EDGE_NODE1, EDGE_NODE2, LOCAL_BACKUP_NODE];

// ── L1 services ──────────────────────────────────────────────────────────
export const POOL: ServiceEndpoint = {
  id: 'pool',
  label: 'Mining Pool',
  host: envOr('VITE_POOL_HOST', '127.0.0.1'),
  port: envOrInt('VITE_POOL_METRICS_PORT', 8455),
  apiBase: '',
  metricsPath: '/metrics',
};

// Stratum port (TCP, not HTTP) — used only for reachability checks.
export const POOL_STRATUM = {
  host: envOr('VITE_POOL_HOST', '127.0.0.1'),
  port: envOrInt('VITE_POOL_STRATUM_PORT', 8444),
};

// ── L2 services ──────────────────────────────────────────────────────────
export const DAO: ServiceEndpoint = {
  id: 'dao',
  label: 'DAO Daemon',
  host: envOr('VITE_DAO_HOST', '127.0.0.1'),
  port: envOrInt('VITE_DAO_PORT', 8450),
  apiBase: '',
};

export const BRIDGE: ServiceEndpoint = {
  id: 'bridge',
  label: 'Bridge Watcher',
  host: envOr('VITE_BRIDGE_HOST', '127.0.0.1'),
  port: envOrInt('VITE_BRIDGE_PORT', 8081),
  healthPath: '/health',
};

export const ATOMIC_SWAP: ServiceEndpoint = {
  id: 'atomic-swap',
  label: 'Atomic Swap',
  host: envOr('VITE_SWAP_HOST', '127.0.0.1'),
  port: envOrInt('VITE_SWAP_PORT', 8082),
  healthPath: '/health',
};

export const SWAP_AGGREGATOR: ServiceEndpoint = {
  id: 'swap-aggregator',
  label: 'Swap Aggregator',
  host: envOr('VITE_SWAP_AGGREGATOR_HOST', '127.0.0.1'),
  port: envOrInt('VITE_SWAP_AGGREGATOR_PORT', 8456),
  healthPath: '/health',
  apiBase: '',
};

// ── L3 services ──────────────────────────────────────────────────────────
export const WARP: ServiceEndpoint = {
  id: 'warp',
  label: 'WARP Relay',
  host: envOr('VITE_WARP_HOST', '127.0.0.1'),
  port: envOrInt('VITE_WARP_PORT', 8453),
  healthPath: '/health',
  apiBase: '',
};

// ── L4+ services ─────────────────────────────────────────────────────────
export const OASIS: ServiceEndpoint = {
  id: 'oasis',
  label: 'OASIS Game',
  host: envOr('VITE_OASIS_HOST', '127.0.0.1'),
  port: envOrInt('VITE_OASIS_PORT', 8094),
  healthPath: '/health',
  apiBase: '',
};

export const FREE_WORLD: ServiceEndpoint = {
  id: 'free-world',
  label: 'Free World',
  host: envOr('VITE_FREE_WORLD_HOST', '127.0.0.1'),
  port: envOrInt('VITE_FREE_WORLD_PORT', 8095),
  metricsPath: '/metrics',
};

export const ISSOBELLA: ServiceEndpoint = {
  id: 'issobella',
  label: 'Issobella Space',
  host: envOr('VITE_ISSOBELLA_HOST', '127.0.0.1'),
  port: envOrInt('VITE_ISSOBELLA_PORT', 8096),
  metricsPath: '/metrics',
};

// ── AI services ──────────────────────────────────────────────────────────
export const HIRANYAGARBHA: ServiceEndpoint = {
  id: 'hiranyagarbha',
  label: 'Hiranyagarbha Orchestrator',
  host: envOr('VITE_ORCH_HOST', '127.0.0.1'),
  port: envOrInt('VITE_ORCH_PORT', 8001),
  healthPath: '/health',
  apiBase: '/api',
};

export const HIRAN_INFERENCE: ServiceEndpoint = {
  id: 'hiran-inference',
  label: 'Hiran Inference',
  host: envOr('VITE_HIRAN_HOST', '127.0.0.1'),
  port: envOrInt('VITE_HIRAN_PORT', 8002),
  healthPath: '/health',
};

// ── Web / Edge ───────────────────────────────────────────────────────────
export const EDGE_WEB = envOr('VITE_EDGE_WEB', 'https://zionterranova.com');

// ── Helpers ───────────────────────────────────────────────────────────────
export function endpointUrl(ep: ServiceEndpoint, path: string): string {
  const base = `http://${ep.host}:${ep.port}${ep.apiBase ?? ''}`;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function rpcUrl(ep: ServiceEndpoint): string {
  return `http://${ep.host}:${ep.port}/jsonrpc`;
}

export function healthUrl(ep: ServiceEndpoint): string {
  return endpointUrl(ep, ep.healthPath ?? '/health');
}
