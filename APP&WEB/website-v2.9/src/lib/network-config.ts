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

// Archived 3-region rehearsal mesh configuration
const DEFAULT_SEED_NODES: SeedNodeConfig[] = [
  {
    id: 'prague-eu',
    name: 'Prague (EU)',
    host: SITE_PRIMARY_HOST,
    region: 'EU',
    lat: 50.08,
    lon: 14.44,
    ports: { p2p: 8333, rpc: 8443, stratum: 3333, pool_api: 8080 },
    poolApiUrl: SITE_PRIMARY_POOL_API_URL,
  },
  {
    id: 'usa-west',
    name: 'USA (Hillsboro, OR)',
    host: '5.78.194.94',
    region: 'US',
    lat: 45.52,
    lon: -122.99,
    ports: { p2p: 8333, rpc: 8443, stratum: 3333, pool_api: 8080 },
    poolApiUrl: 'http://5.78.194.94:8080',
  },
  {
    id: 'singapore-ap',
    name: 'Singapore (APAC)',
    host: '5.223.84.191',
    region: 'APAC',
    lat: 1.35,
    lon: 103.82,
    ports: { p2p: 8333, rpc: 8443, stratum: 3333, pool_api: 8080 },
    poolApiUrl: 'http://5.223.84.191:8080',
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
