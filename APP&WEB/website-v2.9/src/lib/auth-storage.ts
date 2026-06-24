/**
 * File-based storage for auth (users + nonces).
 *
 * Uses JSON files with atomic writes (write to temp, rename).
 * Suitable for small-to-medium user bases on a single Edge server.
 * No native dependencies — works in any Node.js environment.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const DATA_DIR = join(process.cwd(), 'data', 'auth');
const USERS_FILE = join(DATA_DIR, 'users.json');
const NONCES_FILE = join(DATA_DIR, 'nonces.json');

export interface UserRecord {
  id: string;
  walletAddress: string;
  displayName: string | null;
  createdAt: number;
  lastLogin: number;
  loginCount: number;
}

interface NonceRecord {
  address: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDir();
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, path);
}

// ─── Users ─────────────────────────────────────────────────────────────────

export async function getUserByAddress(address: string): Promise<UserRecord | null> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE, {});
  return users[address] ?? null;
}

export async function upsertUser(address: string): Promise<UserRecord> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE, {});
  const now = Date.now();

  if (users[address]) {
    users[address].lastLogin = now;
    users[address].loginCount = (users[address].loginCount ?? 0) + 1;
  } else {
    users[address] = {
      id: randomBytes(16).toString('hex'),
      walletAddress: address,
      displayName: null,
      createdAt: now,
      lastLogin: now,
      loginCount: 1,
    };
  }

  await writeJson(USERS_FILE, users);
  return users[address];
}

export async function updateUserName(address: string, name: string): Promise<UserRecord | null> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE, {});
  if (!users[address]) return null;
  users[address].displayName = name.slice(0, 50);
  await writeJson(USERS_FILE, users);
  return users[address];
}

export async function countUsers(): Promise<number> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE, {});
  return Object.keys(users).length;
}

// ─── Nonces ────────────────────────────────────────────────────────────────

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export async function createNonce(address: string): Promise<string> {
  const nonces = await readJson<Record<string, NonceRecord>>(NONCES_FILE, {});
  const nonce = randomBytes(32).toString('hex');
  const now = Date.now();

  nonces[address] = {
    address,
    nonce,
    createdAt: now,
    expiresAt: now + NONCE_EXPIRY_MS,
    used: false,
  };

  await writeJson(NONCES_FILE, nonces);
  return nonce;
}

export async function consumeNonce(address: string, nonce: string): Promise<boolean> {
  const nonces = await readJson<Record<string, NonceRecord>>(NONCES_FILE, {});
  const record = nonces[address];

  if (!record) return false;
  if (record.used) return false;
  if (record.nonce !== nonce) return false;
  if (Date.now() > record.expiresAt) return false;

  record.used = true;
  await writeJson(NONCES_FILE, nonces);
  return true;
}

// Cleanup expired nonces (call periodically)
export async function cleanupNonces(): Promise<void> {
  const nonces = await readJson<Record<string, NonceRecord>>(NONCES_FILE, {});
  const now = Date.now();
  let changed = false;

  for (const [addr, record] of Object.entries(nonces)) {
    if (record.used || now > record.expiresAt) {
      delete nonces[addr];
      changed = true;
    }
  }

  if (changed) {
    await writeJson(NONCES_FILE, nonces);
  }
}
