import { SITE_PRIMARY_HOST, SITE_PRIMARY_POOL_API_URL, SITE_PRIMARY_RPC_URL } from '@/lib/site';

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

// Current public topology: one primary host with two internal seed containers.
const DEFAULT_SEED_NODES: SeedNodeConfig[] = [
  {
    id: 'primary-host',
    name: 'Zion2 Primary',
    host: SITE_PRIMARY_HOST,
    region: 'PRIMARY',
    lat: 0,
    lon: 0,
    ports: { p2p: 8334, rpc: 8444, stratum: 3333, pool_api: 8080 },
    rpcUrl: SITE_PRIMARY_RPC_URL,
    poolApiUrl: SITE_PRIMARY_POOL_API_URL,
  },
];

const DEFAULT_MINING_POOLS: MiningPoolConfig[] = [
  {
    id: 'pool-primary',
    name: 'Primary Pool',
    host: SITE_PRIMARY_HOST,
    port: 3333,
    region: 'PRIMARY',
    lat: 0,
    lon: 0,
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
