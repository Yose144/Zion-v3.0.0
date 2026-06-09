import { SITE_PRIMARY_HOST, SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

export type SeedNodeConfig = {
  id: string;
  name: string;
  host: string;
  region: string;
  lat: number;
  lon: number;
  ports: {
    p2p: number;
    rpc: number;
    stratum: number;
    pool_api: number;
  };
  rpcUrl?: string;
  poolApiUrl?: string;
};

export type MiningPoolConfig = {
  id: string;
  name: string;
  host: string;
  port: number;
  region: string;
  lat: number;
  lon: number;
};

// Edge-only topology (Hetzner VPS).
// Core PC is unreachable via Tailscale since 2026-05-30.
const DEFAULT_SEED_NODES: SeedNodeConfig[] = [
  {
    id: 'edge-vps',
    name: 'Edge VPS (Hetzner)',
    host: SITE_PRIMARY_HOST,
    region: 'EU',
    lat: 50.08,
    lon: 14.44,
    ports: { p2p: 8333, rpc: 8443, stratum: 8444, pool_api: 8455 },
    poolApiUrl: SITE_PRIMARY_POOL_API_URL,
  },
];

const DEFAULT_MINING_POOLS: MiningPoolConfig[] = [
  {
    id: 'pool-edge',
    name: 'Edge Pool (public)',
    host: SITE_PRIMARY_HOST,
    port: 8444,
    region: 'EDGE',
    lat: 50.08,
    lon: 14.44,
  },
];

function safeJsonParse<T>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getSeedNodesConfig(): SeedNodeConfig[] {
  const fromEnv = safeJsonParse<SeedNodeConfig[]>(process.env.ZION_NETWORK_NODES_JSON);
  if (Array.isArray(fromEnv) && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_SEED_NODES;
}

export function getMiningPoolsConfig(): MiningPoolConfig[] {
  const fromEnv = safeJsonParse<MiningPoolConfig[]>(process.env.ZION_MINING_POOLS_JSON);
  if (Array.isArray(fromEnv) && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_MINING_POOLS;
}
