import { randomBytes } from 'crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';

// Archive Pass entitlements — identity-bound access records for Zion Archive.
// Stored as a small JSON file outside the app tree (EDGE2:
// /opt/zion/data/archive-entitlements.json, override via
// ARCHIVE_ENTITLEMENTS_PATH). Records bind a ZIS identity (`zis:<userId>`)
// to an archive pass — created when a logged-in user claims a valid code,
// or issued by the operator / future marketplace backend via the admin API.
// Writes are atomic (tmp + fsync + rename + fsync dir, per the F1.2
// durability standard). A corrupt file is quarantined, never overwritten.

export type EntitlementType = 'b2b' | 'market' | 'promo';

export interface ArchiveEntitlement {
  id: string;
  /** identity subject, e.g. `zis:<userId>` */
  subject: string;
  type: EntitlementType;
  org?: string;
  note?: string;
  /** how the entitlement was granted: 'code' | 'admin' | 'purchase' */
  claimedVia?: string;
  issuedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

interface EntitlementStore {
  version: 1;
  records: ArchiveEntitlement[];
}

export function entitlementsPath(): string {
  return (
    process.env.ARCHIVE_ENTITLEMENTS_PATH ??
    '/opt/zion/data/archive-entitlements.json'
  );
}

// ── lazy cache: re-read only when the file changed (mtime+size) ────────
let cache: { mtimeMs: number; size: number; store: EntitlementStore } | null =
  null;

function emptyStore(): EntitlementStore {
  return { version: 1, records: [] };
}

function loadStore(): EntitlementStore {
  const path = entitlementsPath();
  try {
    const st = statSync(path);
    if (cache && cache.mtimeMs === st.mtimeMs && cache.size === st.size) {
      return cache.store;
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as EntitlementStore;
    const store =
      parsed && parsed.version === 1 && Array.isArray(parsed.records)
        ? parsed
        : emptyStore();
    cache = { mtimeMs: st.mtimeMs, size: st.size, store };
    return store;
  } catch {
    // missing or unreadable/corrupt → fail-closed: no entitlements
    return emptyStore();
  }
}

function persistStore(store: EntitlementStore): void {
  const path = entitlementsPath();
  const dir = dirname(path);
  const tmp = join(dir, `.archive-entitlements.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
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
  cache = null; // force reload from the file we just wrote
}

function isActive(e: ArchiveEntitlement, now = new Date()): boolean {
  if (e.revokedAt) return false;
  if (e.expiresAt && new Date(e.expiresAt) <= now) return false;
  return true;
}

export function isEntitled(subject: string): boolean {
  return loadStore().records.some(
    (e) => e.subject === subject && isActive(e),
  );
}

export function getEntitlement(subject: string): ArchiveEntitlement | null {
  return (
    loadStore().records.find((e) => e.subject === subject && isActive(e)) ??
    null
  );
}

export function grantEntitlement(input: {
  subject: string;
  type: EntitlementType;
  org?: string;
  note?: string;
  claimedVia?: string;
  expiresAt?: string | null;
}): ArchiveEntitlement {
  const store = loadStore();
  const existing = store.records.find(
    (e) =>
      e.subject === input.subject && e.type === input.type && isActive(e),
  );
  if (existing) return existing;
  const record: ArchiveEntitlement = {
    id: `ent_${randomBytes(8).toString('hex')}`,
    subject: input.subject,
    type: input.type,
    org: input.org,
    note: input.note,
    claimedVia: input.claimedVia,
    issuedAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
  };
  store.records.push(record);
  persistStore(store);
  return record;
}

export function revokeEntitlement(id: string): boolean {
  const store = loadStore();
  const rec = store.records.find((e) => e.id === id);
  if (!rec || rec.revokedAt) return false;
  rec.revokedAt = new Date().toISOString();
  persistStore(store);
  return true;
}

export function listEntitlements(): ArchiveEntitlement[] {
  return loadStore().records;
}
