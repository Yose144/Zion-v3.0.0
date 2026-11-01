import { createApi } from '@zion/api';
import type { ServiceId } from '@zion/contract';

/**
 * Jediná datová cesta Kingdomu.
 *
 * Defaulty míří na veřejné hostname. V produkci je přepiš env proměnnými
 * na lokální služby (127.0.0.1) — ušetříš TLS handshake a DNS.
 */
export const ORIGINS: Record<ServiceId, string> = {
  chain: process.env.KINGDOM_CHAIN_ORIGIN ?? 'https://app.zionterranova.com',
  pool: process.env.KINGDOM_POOL_ORIGIN ?? 'https://pool.zionterranova.com',
  market: process.env.KINGDOM_MARKET_ORIGIN ?? 'https://market.zionterranova.com',
  oasis: process.env.KINGDOM_OASIS_ORIGIN ?? 'https://oasis.zionterranova.com',
  freeworld: process.env.KINGDOM_FREEWORLD_ORIGIN ?? 'https://app.zionterranova.com',
  issobella: process.env.KINGDOM_ISSOBELLA_ORIGIN ?? 'https://app.zionterranova.com',
  hiran: process.env.KINGDOM_HIRAN_ORIGIN ?? 'https://app.zionterranova.com',
  dao: process.env.KINGDOM_DAO_ORIGIN ?? 'https://app.zionterranova.com',
  auth: process.env.KINGDOM_AUTH_ORIGIN ?? 'https://auth.zionterranova.com',
};

export const api = createApi(ORIGINS);

/** Absolutní URL assentu ze služby (market vrací relativní cesty k obrázkům). */
export function assetUrl(service: ServiceId, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, ORIGINS[service]).toString();
}

/**
 * Existuje asset? BFF normalizuje data z backendu — rozbitý obrázek je
 * backendový dluh, ne díra v UI. Kontrola je HEAD s krátkým timeoutem a
 * hodinovou pamětí v procesu, takže ji zaplatíš jednou za hodinu.
 */
const assetCache = new Map<string, { ok: boolean; at: number }>();
const ASSET_TTL_MS = 60 * 60 * 1000;

export async function assetExists(url: string | null, timeoutMs = 1500): Promise<boolean> {
  if (!url) return false;
  const hit = assetCache.get(url);
  if (hit && Date.now() - hit.at < ASSET_TTL_MS) return hit.ok;

  let ok = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      ok = res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    ok = false;
  }

  assetCache.set(url, { ok, at: Date.now() });
  return ok;
}

/** Povrchy, které zůstávají mimo Kingdom (rozhodnutí 👤 2026-11-01). */
export const EXTERNAL = {
  library: process.env.KINGDOM_LIBRARY_URL ?? 'https://app.zionterranova.com',
  ops: process.env.KINGDOM_OPS_URL ?? 'https://dashboard.zionterranova.com',
  /** E-shop žije na marketu — Kingdom je výloha, pokladna zůstává tam. */
  shop: process.env.KINGDOM_SHOP_URL ?? 'https://market.zionterranova.com/shop',
  /** Ovládání poolu je operátorský povrch za basic auth — klient tam nemá co dělat. */
  poolOps: process.env.KINGDOM_POOL_OPS_URL ?? 'https://pool.zionterranova.com/ops/',
  /** Hlasování DAO — podepsané peněženkou, ne Kingdomem. */
  dao: process.env.KINGDOM_DAO_URL ?? 'https://app.zionterranova.com/dao',
  /** Plný eXplorer (bloky, adresy, historie) — portál drží jen okno. */
  explorer: process.env.KINGDOM_EXPLORER_URL ?? 'https://app.zionterranova.com/explorer',
} as const;
