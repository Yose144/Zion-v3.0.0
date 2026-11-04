import {
  readFileSync,
  statSync,
} from 'fs';

// Marketplace-issued Archive Pass codes — read side of the shared store.
// MarketPlace writes /opt/zion/data/archive-market-codes.json on EDGE2
// when a paid order contains a product flagged `archive-pass:<id>`;
// this reader lets the archive gate redeem those codes identically to
// operator-issued ARCHIVE_PASS_CODES. Lazy mtime+size cache, fail-closed.

export interface ArchiveMarketCode {
  code: string;
  orderId: string;
  email: string;
  productId: string;
  issuedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

interface MarketCodeStore {
  version: 1;
  records: ArchiveMarketCode[];
}

export function marketCodesPath(): string {
  return (
    process.env.ARCHIVE_MARKET_CODES_PATH ??
    '/opt/zion/data/archive-market-codes.json'
  );
}

let cache: { mtimeMs: number; size: number; store: MarketCodeStore } | null =
  null;

function emptyStore(): MarketCodeStore {
  return { version: 1, records: [] };
}

function loadStore(): MarketCodeStore {
  const path = marketCodesPath();
  try {
    const st = statSync(path);
    if (cache && cache.mtimeMs === st.mtimeMs && cache.size === st.size) {
      return cache.store;
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as MarketCodeStore;
    const store =
      parsed && parsed.version === 1 && Array.isArray(parsed.records)
        ? parsed
        : emptyStore();
    cache = { mtimeMs: st.mtimeMs, size: st.size, store };
    return store;
  } catch {
    return emptyStore();
  }
}

function isActive(r: ArchiveMarketCode, now = new Date()): boolean {
  if (r.revokedAt) return false;
  if (r.expiresAt && new Date(r.expiresAt) <= now) return false;
  return true;
}

/**
 * Active marketplace code bought with this e-mail — used for automatic
 * unlock of a signed-in, e-mail-verified ZIS user (no manual code entry).
 */
export function findActiveMarketCodeByEmail(email: string): ArchiveMarketCode | null {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  return (
    loadStore().records.find(
      (r) => isActive(r) && r.email?.trim().toLowerCase() === target,
    ) ?? null
  );
}

/** True when the code exists in the market store and is still usable. */
export function isValidMarketCode(code: string): boolean {
  const trimmed = code.trim();
  return loadStore().records.some(
    (r) => r.code === trimmed && isActive(r),
  );
}
