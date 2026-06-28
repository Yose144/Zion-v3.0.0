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
// NOTE: These are built lazily (functions) so that env-var overrides in site.ts
// (which use bracket notation to avoid Next.js build-time inlining) are read
// at runtime, not at build time.
function buildDefaultSeedNodes(): SeedNodeConfig[] {
  return [
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

export function getSeedNodesConfig(): SeedNodeConfig[] {
  const fromEnv = safeJsonParse<SeedNodeConfig[]>(process.env['ZION_' + 'NETWORK_' + 'NODES_' + 'JSON']);
  if (Array.isArray(fromEnv) && fromEnv.length > 0) {
    return fromEnv;
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
