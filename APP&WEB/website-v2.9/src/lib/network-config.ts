import { SITE_PRIMARY_HOST, SITE_PRIMARY_POOL_API_URL, SITE_POOL_PRIMARY } from '@/lib/site';

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

// One Love Mainnet Stable topology: single canonical public node (StatusV3.md).
//   - Primary Node (Mainnet Stable / Pool) — P2P 8333, RPC 9445, Stratum 8444, Pool API 8080
// NOTE: These are built lazily (functions) so that env-var overrides in site.ts
// (which use bracket notation to avoid Next.js build-time inlining) are read
// at runtime, not at build time.
function buildDefaultSeedNodes(): SeedNodeConfig[] {
  return [
    {
      id: 'zion-primary',
      name: 'ZION One Love Node',
      host: SITE_PRIMARY_HOST,
      region: 'PRIMARY',
      lat: 50.08,
      lon: 14.44,
      ports: { p2p: 8333, rpc: 9445, stratum: 8444, pool_api: 8080 },
      // Server-side RPC connects over localhost (node binds 127.0.0.1 for security).
      // `host` above stays public so UI/display shows the real endpoint.
      rpcUrl: '127.0.0.1:9445',
      poolApiUrl: SITE_PRIMARY_POOL_API_URL,
    },
  ];
}

function buildDefaultMiningPools(): MiningPoolConfig[] {
  const [poolHost, poolPortStr] = SITE_POOL_PRIMARY.split(':');
  const poolPort = parseInt(poolPortStr || '8444', 10);
  return [
    {
      id: 'zion-pool',
      name: 'ZION One Love Pool',
      host: poolHost || SITE_PRIMARY_HOST,
      port: poolPort,
      region: 'PUBLIC',
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
    id: raw.id ?? 'zion-node',
    name: raw.name ?? 'ZION Node',
    host: raw.host,
    region: raw.region ?? 'PRIMARY',
    lat: raw.lat ?? 50.08,
    lon: raw.lon ?? 14.44,
    ports: {
      p2p: raw.ports?.p2p ?? 8333,
      rpc: raw.ports?.rpc ?? flatPort ?? 9445,
      stratum: raw.ports?.stratum ?? 8444,
      pool_api: raw.ports?.pool_api ?? 8080,
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
