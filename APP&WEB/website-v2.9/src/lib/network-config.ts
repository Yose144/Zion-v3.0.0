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

const DEFAULT_SEED_NODES: SeedNodeConfig[] = [
  {
    id: 'seed-helsinki',
    name: 'Helsinki',
    host: '77.42.31.72',
    region: 'EU-NORTH',
    lat: 60.17,
    lon: 24.94,
    ports: { p2p: 8334, rpc: 8444, stratum: 3333, pool_api: 8080 },
    rpcUrl: 'http://77.42.31.72:8444/jsonrpc',
    poolApiUrl: 'http://77.42.31.72:8080',
  },

  {
    id: 'seed-seedde',
    name: 'SeedDE',
    host: '46.225.126.243',
    region: 'EU-CENTRAL',
    lat: 50.11,
    lon: 8.68,
    ports: { p2p: 8334, rpc: 8444, stratum: 3333, pool_api: 8080 },
    rpcUrl: 'http://46.225.126.243:8444/jsonrpc',
    poolApiUrl: 'http://46.225.126.243:8080',
  },
  {
    id: 'seed-usa1',
    name: 'Usa1',
    host: '5.78.178.227',
    region: 'US-WEST',
    lat: 37.77,
    lon: -122.42,
    ports: { p2p: 8334, rpc: 8444, stratum: 3333, pool_api: 8080 },
    rpcUrl: 'http://5.78.178.227:8444/jsonrpc',
    poolApiUrl: 'http://5.78.178.227:8080',
  },
  {
    id: 'seed-usa2',
    name: 'Usa2',
    host: '178.156.240.160',
    region: 'US-EAST',
    lat: 40.71,
    lon: -74.01,
    ports: { p2p: 8334, rpc: 8444, stratum: 3333, pool_api: 8080 },
    rpcUrl: 'http://178.156.240.160:8444/jsonrpc',
    poolApiUrl: 'http://178.156.240.160:8080',
  },
  {
    id: 'seed-asia3',
    name: 'Asia3',
    host: '5.223.43.93',
    region: 'ASIA',
    lat: 35.69,
    lon: 139.69,
    ports: { p2p: 8334, rpc: 8444, stratum: 3333, pool_api: 8080 },
    rpcUrl: 'http://5.223.43.93:8444/jsonrpc',
    poolApiUrl: 'http://5.223.43.93:8080',
  },
];

const DEFAULT_MINING_POOLS: MiningPoolConfig[] = [
  {
    id: 'pool-helsinki',
    name: 'Helsinki Pool (Primary)',
    host: '77.42.31.72',
    port: 3333,
    region: 'EU-NORTH',
    lat: 60.17,
    lon: 24.94,
  },

  // SeedDE/Usa1/Usa2/Asia3 are seed-only — no stratum pool
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
