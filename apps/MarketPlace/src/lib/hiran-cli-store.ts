/**
 * Ephemeral file store for Hiran CLI device-codes + crypto payment intents.
 * Avoids a Prisma migration for short-lived MVP state (TTL ~10 min).
 */

import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export type DeviceStatus = 'pending' | 'approved' | 'expired' | 'redeemed';

export interface DeviceRecord {
  deviceCode: string;
  userCode: string;
  status: DeviceStatus;
  apiKey?: string;
  keyHash?: string;
  userId?: string;
  expiresAt: number;
  createdAt: number;
  redeemedAt?: number;
}

export type CryptoStatus = 'pending' | 'confirmed' | 'expired';

export interface CryptoIntent {
  id: string;
  reference: string;
  plan: 'pro' | 'team';
  keyHash: string;
  amount: string; // USDC atomic (6 decimals) as decimal string
  toAddress: string;
  tokenAddress: string;
  chainId: number;
  status: CryptoStatus;
  txHash?: string;
  expiresAt: number;
  createdAt: number;
}

interface StoreFile {
  devices: Record<string, DeviceRecord>;
  byUserCode: Record<string, string>; // userCode → deviceCode
  crypto: Record<string, CryptoIntent>;
}

const TTL_MS = 10 * 60 * 1000;

function storePath(): string {
  return (
    process.env.HIRAN_CLI_STORE_PATH?.trim() ||
    path.join(os.tmpdir(), 'zion-hiran-cli-store.json')
  );
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoreFile;
    return {
      devices: parsed.devices ?? {},
      byUserCode: parsed.byUserCode ?? {},
      crypto: parsed.crypto ?? {},
    };
  } catch {
    return { devices: {}, byUserCode: {}, crypto: {} };
  }
}

async function writeStore(data: StoreFile): Promise<void> {
  const p = storePath();
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
  await fs.rename(tmp, p);
}

function prune(data: StoreFile, now = Date.now()): void {
  for (const [dc, rec] of Object.entries(data.devices)) {
    if (rec.expiresAt < now || rec.status === 'redeemed') {
      if (rec.expiresAt < now && rec.status === 'pending') {
        rec.status = 'expired';
      }
      if (rec.expiresAt < now - TTL_MS || rec.status === 'redeemed') {
        delete data.byUserCode[rec.userCode];
        delete data.devices[dc];
      }
    }
  }
  for (const [id, intent] of Object.entries(data.crypto)) {
    if (intent.expiresAt < now && intent.status === 'pending') {
      intent.status = 'expired';
    }
    if (intent.expiresAt < now - TTL_MS) {
      delete data.crypto[id];
    }
  }
}

function userCode(): string {
  // Human-friendly: ABCD-1234
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
    if (i === 3) out += '-';
  }
  return out;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function createDevice(): Promise<DeviceRecord> {
  const data = await readStore();
  prune(data);
  const deviceCode = randomBytes(24).toString('hex');
  let code = userCode();
  while (data.byUserCode[code]) code = userCode();
  const now = Date.now();
  const rec: DeviceRecord = {
    deviceCode,
    userCode: code,
    status: 'pending',
    expiresAt: now + TTL_MS,
    createdAt: now,
  };
  data.devices[deviceCode] = rec;
  data.byUserCode[code] = deviceCode;
  await writeStore(data);
  return rec;
}

export async function getDeviceByCode(deviceCode: string): Promise<DeviceRecord | null> {
  const data = await readStore();
  prune(data);
  const rec = data.devices[deviceCode];
  if (!rec) return null;
  if (rec.expiresAt < Date.now() && rec.status === 'pending') {
    rec.status = 'expired';
    await writeStore(data);
  }
  return rec;
}

export async function getDeviceByUserCode(userCode: string): Promise<DeviceRecord | null> {
  const data = await readStore();
  prune(data);
  const dc = data.byUserCode[userCode.trim().toUpperCase()];
  if (!dc) return null;
  return data.devices[dc] ?? null;
}

/** Approve: attach minted api key. Idempotent if already approved with same user. */
export async function approveDevice(
  userCode: string,
  apiKey: string,
  userId: string,
): Promise<DeviceRecord> {
  const data = await readStore();
  prune(data);
  const dc = data.byUserCode[userCode.trim().toUpperCase()];
  if (!dc || !data.devices[dc]) {
    throw new Error('UNKNOWN_CODE');
  }
  const rec = data.devices[dc]!;
  if (rec.expiresAt < Date.now()) {
    rec.status = 'expired';
    await writeStore(data);
    throw new Error('EXPIRED');
  }
  if (rec.status === 'redeemed') {
    throw new Error('ALREADY_REDEEMED');
  }
  if (rec.status === 'approved' && rec.apiKey) {
    return rec;
  }
  rec.status = 'approved';
  rec.apiKey = apiKey;
  rec.keyHash = sha256Hex(apiKey);
  rec.userId = userId;
  await writeStore(data);
  return rec;
}

/** Poll: return key once, then mark redeemed. */
export async function redeemDevice(
  deviceCode: string,
): Promise<{ status: DeviceStatus; apiKey?: string; expiresAt: number }> {
  const data = await readStore();
  prune(data);
  const rec = data.devices[deviceCode];
  if (!rec) {
    return { status: 'expired', expiresAt: 0 };
  }
  if (rec.expiresAt < Date.now() && rec.status === 'pending') {
    rec.status = 'expired';
    await writeStore(data);
    return { status: 'expired', expiresAt: rec.expiresAt };
  }
  if (rec.status === 'approved' && rec.apiKey) {
    const key = rec.apiKey;
    rec.apiKey = undefined;
    rec.status = 'redeemed';
    rec.redeemedAt = Date.now();
    await writeStore(data);
    return { status: 'approved', apiKey: key, expiresAt: rec.expiresAt };
  }
  return { status: rec.status, expiresAt: rec.expiresAt };
}

export async function createCryptoIntent(input: {
  plan: 'pro' | 'team';
  keyHash: string;
  amount: string;
  toAddress: string;
  tokenAddress: string;
  chainId: number;
}): Promise<CryptoIntent> {
  const data = await readStore();
  prune(data);
  const id = randomBytes(16).toString('hex');
  const reference = `hiran-${input.plan}-${id.slice(0, 12)}`;
  const now = Date.now();
  const intent: CryptoIntent = {
    id,
    reference,
    plan: input.plan,
    keyHash: input.keyHash,
    amount: input.amount,
    toAddress: input.toAddress.toLowerCase(),
    tokenAddress: input.tokenAddress.toLowerCase(),
    chainId: input.chainId,
    status: 'pending',
    expiresAt: now + TTL_MS,
    createdAt: now,
  };
  data.crypto[id] = intent;
  await writeStore(data);
  return intent;
}

export async function getCryptoIntent(id: string): Promise<CryptoIntent | null> {
  const data = await readStore();
  prune(data);
  const intent = data.crypto[id];
  if (!intent) return null;
  if (intent.expiresAt < Date.now() && intent.status === 'pending') {
    intent.status = 'expired';
    await writeStore(data);
  }
  return intent;
}

export async function markCryptoConfirmed(
  id: string,
  txHash: string,
): Promise<CryptoIntent> {
  const data = await readStore();
  const intent = data.crypto[id];
  if (!intent) throw new Error('UNKNOWN_INTENT');
  if (intent.status === 'confirmed') return intent;
  if (intent.status !== 'pending') throw new Error('NOT_PENDING');
  intent.status = 'confirmed';
  intent.txHash = txHash;
  await writeStore(data);
  return intent;
}
