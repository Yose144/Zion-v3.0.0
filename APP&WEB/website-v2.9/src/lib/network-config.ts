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

// Edge-only topology (cloud VPS).
// Two nodes run on the same Edge server:
//   - Node 1 (Primary / Genesis) — P2P 8333, RPC 8443
//   - Node 2 (Follower / P2P peer) — P2P 8334, RPC 8446
// NOTE: These are built lazily (functions) so that env-var overrides in site.ts
// (which use bracket notation to avoid Next.js build-time inlining) are read
// at runtime, not at build time.
function buildDefaultSeedNodes(): SeedNodeConfig[] {
  return [
    {
      id: 'edge-vps',
      name: 'Edge Node 1 (Primary)',
      host: SITE_PRIMARY_HOST,
      region: 'EU',
      lat: 50.08,
      lon: 14.44,
      ports: { p2p: 8333, rpc: 8443, stratum: 8444, pool_api: 8455 },
      poolApiUrl: SITE_PRIMARY_POOL_API_URL,
    },
    {
      id: 'edge-follower',
      name: 'Edge Node 2 (Follower)',
      host: SITE_PRIMARY_HOST,
      region: 'EU',
      lat: 50.08,
      lon: 14.44,
      ports: { p2p: 8334, rpc: 8448, stratum: 0, pool_api: 0 },
    },
  ];
}

function buildDefaultMiningPools(): MiningPoolConfig[] {
  return [
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
}

function safeJsonParse<T>(raw: string | undefined | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeSeedNode(raw: any): SeedNodeConfig | null {
  if (!raw || typeof raw !== 'object' || !raw.host) return null;
  // Accept both `port` (flat) and `ports.rpc` (nested) env-var formats.
  const flatPort = typeof raw.port === 'number' ? raw.port : undefined;
  return {
    id: raw.id ?? 'env-node',
    name: raw.name ?? 'Env Node',
    host: raw.host,
    region: raw.region ?? 'EU',
    lat: raw.lat ?? 50.08,
    lon: raw.lon ?? 14.44,
    ports: {
      p2p: raw.ports?.p2p ?? 8333,
      rpc: raw.ports?.rpc ?? flatPort ?? 8443,
      stratum: raw.ports?.stratum ?? 0,
      pool_api: raw.ports?.pool_api ?? 0,
    },
    rpcUrl: raw.rpcUrl,
    poolApiUrl: raw.poolApiUrl,
  };
}

export function getSeedNodesConfig(): SeedNodeConfig[] {
  const fromEnv = safeJsonParse<any[]>(process.env['ZION_' + 'NETWORK_' + 'NODES_' + 'JSON']);
  if (Array.isArray(fromEnv) && fromEnv.length > 0) {
    const normalized = fromEnv.map(normalizeSeedNode).filter((n): n is SeedNodeConfig => n !== null);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return buildDefaultSeedNodes();
}

export function getMiningPoolsConfig(): MiningPoolConfig[] {
  const fromEnv = safeJsonParse<MiningPoolConfig[]>(process.env['ZION_' + 'MINING_' + 'POOLS_' + 'JSON']);
  if (Array.isArray(fromEnv) && fromEnv.length > 0) {
    return fromEnv;
  }
  return buildDefaultMiningPools();
}
