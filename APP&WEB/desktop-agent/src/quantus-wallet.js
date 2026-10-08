// Quantus (QTC / Quantus mainnet) wallet helpers for Desktop Agent.
//
// SS58 validation is pure JS (base58 + blake2b-512 "SS58PRE" checksum,
// two-byte prefix 189). Address *derivation* (ML-DSA-87 keypair +
// poseidon2 account id) is delegated to the bundled `zion-derive-addr`
// helper — Dilithium has no JS implementation in our dep tree, and the
// helper shares the exact custodial derivation path used by the ZIS
// multichain wallet (m/44'/189'/0'/0/0 → QuantusKeypair).

const { spawnSync } = require('child_process');
const { blake2b } = require('@noble/hashes/blake2b.js');
const path = require('path');
const fs = require('fs');

const QUANTUS_SS58_PREFIX = 189;
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = new Map([...B58_ALPHABET].map((c, i) => [c, BigInt(i)]));

// ── minimal base58 (no bs58 dep) ────────────────────────────────────────────
function b58decode(str) {
  if (!str) throw new Error('empty base58');
  let num = 0n;
  for (const ch of str) {
    const d = B58_MAP.get(ch);
    if (d === undefined) throw new Error(`invalid base58 char '${ch}'`);
    num = num * 58n + d;
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = hex === '00' && num === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  // leading '1's → leading zero bytes
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  return Buffer.concat([Buffer.alloc(zeros), bytes]);
}

function b58encode(buf) {
  let num = 0n;
  for (const b of buf) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    out = B58_ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + out;
}

// ── ss58 ────────────────────────────────────────────────────────────────────
function ss58Decode(addr) {
  const raw = b58decode(addr.trim());
  if (raw.length !== 35 && raw.length !== 36) {
    throw new Error(`invalid ss58 length ${raw.length}`);
  }
  let prefix, plen;
  if ((raw[0] & 0x40) === 0) {
    prefix = raw[0];
    plen = 1;
  } else {
    prefix =
      ((raw[0] & 0x3f) << 2) | (raw[1] >> 6) | ((raw[1] & 0x3f) << 8);
    plen = 2;
  }
  const bodyLen = raw.length - plen - 2;
  if (bodyLen !== 32) throw new Error(`ss58 body ${bodyLen} != 32`);
  const ctx = Buffer.concat([
    Buffer.from('SS58PRE'),
    Buffer.from(raw.subarray(0, plen + 32))
  ]);
  const checksum = blake2b(ctx, { dkLen: 64 });
  if (
    raw[plen + 32] !== checksum[0] ||
    raw[plen + 33] !== checksum[1]
  ) {
    throw new Error('ss58 checksum mismatch');
  }
  return { prefix, account: Buffer.from(raw.subarray(plen, plen + 32)) };
}

/** True iff `addr` is a valid ss58 address carrying the Quantus prefix 189. */
function isValidQuantusAddress(addr) {
  try {
    const { prefix } = ss58Decode(String(addr || ''));
    return prefix === QUANTUS_SS58_PREFIX;
  } catch {
    return false;
  }
}

/** ss58-encode a 32-byte account id for Quantus (prefix 189). */
function ss58EncodeQuantus(account32) {
  if (account32.length !== 32) throw new Error('account must be 32 bytes');
  const p = QUANTUS_SS58_PREFIX;
  const payload = Buffer.alloc(2 + 32);
  payload[0] = ((p & 0x00fc) >> 2) | 0x40;
  payload[1] = (p >> 8) | ((p & 0x03) << 6);
  account32.copy(payload, 2);
  const ctx = Buffer.concat([Buffer.from('SS58PRE'), payload]);
  const checksum = blake2b(ctx, { dkLen: 64 });
  return b58encode(Buffer.concat([payload, Buffer.from(checksum.subarray(0, 2))]));
}

// ── derivation via bundled helper ───────────────────────────────────────────
function resolveHelperPath(appRoot, isPackaged) {
  const exe = process.platform === 'win32' ? 'zion-derive-addr.exe' : 'zion-derive-addr';
  const candidates = [
    isPackaged ? path.join(process.resourcesPath, exe) : null,
    path.join(appRoot, 'resources', exe),
    path.join(appRoot, 'resources', 'bin', exe),
    exe // PATH fallback
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Derive the Quantus (QTC) ss58 address for a BIP39 mnemonic using the
 * bundled `zion-derive-addr` helper (Rust `Keyring::address(Quantus)`).
 * Returns null when the helper is unavailable or derivation fails.
 */
function deriveQuantusAddress(mnemonic, appRoot, isPackaged) {
  const helper = resolveHelperPath(appRoot, isPackaged);
  if (!helper) return null;
  try {
    const res = spawnSync(helper, [], {
      input: String(mnemonic).trim() + '\n',
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 64 * 1024
    });
    if (res.status !== 0 || !res.stdout) return null;
    const m = /(?:^|\s)qtc=([1-9A-HJ-NP-Za-km-z]+)/.exec(res.stdout);
    if (!m) return null;
    return isValidQuantusAddress(m[1]) ? m[1] : null;
  } catch {
    return null;
  }
}

// ── balance via public HTTPS JSON-RPC ───────────────────────────────────────
const DEFAULT_RPC = 'https://rpc.zionterranova.com/qtc';

// twox128("System") ‖ twox128("Account") — string-hash constants identical
// on every Substrate chain (matches the Rust adapter).
const SYS_ACCT_PREFIX = Buffer.from(
  '26aa394eea5630e07c48ae0c9558cef7' + 'b99d880ec681799c0cf30e888fb1cb00',
  'hex'
);

/**
 * Free balance (in planks, 12 decimals) for a Quantus address.
 * Reads `System.Account` via `state_getStorage` on the public HTTPS RPC.
 * Returns { free: bigint, nonce: number } or null on failure.
 */
async function quantusBalance(address, rpcUrl = DEFAULT_RPC) {
  try {
    const { account } = ss58Decode(String(address).trim());
    const key = Buffer.concat([
      SYS_ACCT_PREFIX,
      Buffer.from(blake2b(account, { dkLen: 16 })),
      account
    ]);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'state_getStorage',
        params: ['0x' + key.toString('hex')]
      })
    });
    const json = await res.json();
    const hexStr = json.result;
    if (!hexStr) return { free: 0n, nonce: 0 };
    const raw = Buffer.from(hexStr.replace(/^0x/, ''), 'hex');
    if (raw.length < 80) return null;
    // AccountInfo: nonce u32 | consumers u32 | providers u32 | sufficients u32
    //              | data { free u128 | reserved | frozen | flags }
    const nonce = raw.readUInt32LE(0);
    const free = BigInt('0x' + Buffer.from(raw.subarray(16, 32)).reverse().toString('hex') || '0');
    return { free, nonce };
  } catch {
    return null;
  }
}

module.exports = {
  QUANTUS_SS58_PREFIX,
  DEFAULT_RPC,
  isValidQuantusAddress,
  ss58EncodeQuantus,
  ss58Decode,
  deriveQuantusAddress,
  resolveHelperPath,
  quantusBalance
};
