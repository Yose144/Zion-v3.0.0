import { randomBytes } from 'crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { prisma } from '@/lib/db';

/**
 * ZION Archive Pass — marketplace purchase grants.
 *
 * Buying a product flagged via `ShopSetting archive-pass:<externalId>`
 * issues a unique ZAP-… code at the paid transition. The website gate
 * (app.zionterranova.com/zion-archive) validates codes against a shared
 * JSON store on EDGE2 (both services run as `zion`), so codes need no
 * ZIS account — the customer redeems them in the ArchiveLock form, or
 * binds them to a ZIS session for a permanent entitlement.
 *
 * Store: /opt/zion/data/archive-market-codes.json
 *        (override via ARCHIVE_MARKET_CODES_PATH)
 * Writes are atomic (tmp + fsync + rename + fsync dir, F1.2 durability).
 * Revocation = order cancelled → revokedAt set → website denies the code.
 */

export interface ArchiveMarketCode {
  code: string;
  orderId: string;
  email: string | null;
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

function emptyStore(): MarketCodeStore {
  return { version: 1, records: [] };
}

function loadStore(): MarketCodeStore {
  const path = marketCodesPath();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as MarketCodeStore;
    return parsed && parsed.version === 1 && Array.isArray(parsed.records)
      ? parsed
      : emptyStore();
  } catch {
    return emptyStore();
  }
}

function persistStore(store: MarketCodeStore): void {
  const path = marketCodesPath();
  const dir = dirname(path);
  const tmp = join(
    dir,
    `.archive-market-codes.${process.pid}.${randomBytes(4).toString('hex')}.tmp`,
  );
  if (existsSync(path)) {
    try {
      JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      renameSync(path, `${path}.corrupt-${Date.now()}`);
    }
  }
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, JSON.stringify(store, null, 2));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
  const dfd = openSync(dir, 'r');
  try {
    fsyncSync(dfd);
  } finally {
    closeSync(dfd);
  }
}

interface ArchivePassGrant {
  /** optional ISO date — pass issued by this product expires then */
  passExpiresAt?: string | null;
  /** optional ISO date — no new passes granted after this */
  endsAt?: string | null;
  note?: string;
}

/**
 * externalIds of products whose purchase grants an archive pass right now.
 * `ShopSetting` key `archive-pass:<externalId>` = JSON ArchivePassGrant;
 * presence = grant (disabled by deleting the row or setting `endsAt` past).
 */
async function archivePassGrants(): Promise<Map<string, ArchivePassGrant>> {
  const rows = await prisma.shopSetting.findMany({
    where: { key: { startsWith: 'archive-pass:' } },
  });
  const now = new Date();
  const grants = new Map<string, ArchivePassGrant>();
  for (const row of rows) {
    const externalId = row.key.slice('archive-pass:'.length);
    try {
      const g = JSON.parse(row.value) as ArchivePassGrant;
      if (g.endsAt && new Date(g.endsAt) <= now) continue;
      grants.set(externalId, g);
    } catch {
      continue;
    }
  }
  return grants;
}

function lineItemIds(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => (i as { externalId?: string })?.externalId)
    .filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export const ARCHIVE_REDEEM_URL =
  process.env.ARCHIVE_REDEEM_URL ?? 'https://app.zionterranova.com/zion-archive';

/**
 * Issue (or return the existing) archive pass for a paid order.
 * Idempotent per orderId — safe to call from every paid-claim site.
 * Returns null when no line item carries an archive-pass grant.
 */
export async function issueArchivePassForOrder(order: {
  orderId: string;
  customerEmail: string | null;
  items: unknown;
}): Promise<ArchiveMarketCode | null> {
  const grants = await archivePassGrants();
  if (grants.size === 0) return null;

  const productId = lineItemIds(order.items).find((id) => grants.has(id));
  if (!productId) return null;

  const store = loadStore();
  const existing = store.records.find(
    (r) => r.orderId === order.orderId && !r.revokedAt,
  );
  if (existing) return existing;

  const grant = grants.get(productId)!;
  const record: ArchiveMarketCode = {
    code: `ZAP-${randomBytes(8).toString('hex').toUpperCase()}`,
    orderId: order.orderId,
    email: order.customerEmail,
    productId,
    issuedAt: new Date().toISOString(),
    expiresAt: grant.passExpiresAt ?? null,
    revokedAt: null,
  };
  store.records.push(record);
  persistStore(store);
  console.log(`[archive-pass] issued ${record.code} for ${order.orderId}`);
  return record;
}

/** Revoke every pass tied to the order (cancel/refund path). */
export function revokeArchivePass(orderId: string): number {
  const store = loadStore();
  const now = new Date().toISOString();
  let n = 0;
  for (const r of store.records) {
    if (r.orderId === orderId && !r.revokedAt) {
      r.revokedAt = now;
      n++;
    }
  }
  if (n > 0) {
    persistStore(store);
    console.log(`[archive-pass] revoked ${n} code(s) for ${orderId}`);
  }
  return n;
}

/**
 * Put a revoked pass back in force (order restored from trash / reopened
 * after cancel). The customer's original ZAP code keeps working — issuing a
 * new code instead would leave them holding a dead code from their email.
 */
export function unrevokeArchivePass(orderId: string): number {
  const store = loadStore();
  let n = 0;
  for (const r of store.records) {
    if (r.orderId === orderId && r.revokedAt) {
      r.revokedAt = null;
      n++;
    }
  }
  if (n > 0) {
    persistStore(store);
    console.log(`[archive-pass] unrevoked ${n} code(s) for ${orderId}`);
  }
  return n;
}

/** Diagnostics — current record for an order, if any. */
export function getArchivePassForOrder(
  orderId: string,
): ArchiveMarketCode | null {
  return (
    loadStore().records.find(
      (r) => r.orderId === orderId && !r.revokedAt,
    ) ?? null
  );
}
