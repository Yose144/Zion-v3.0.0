// Pearl (PRL) wallet helpers for Desktop Agent.
//
// Address format: bech32/bech32m segwit, HRP "prl" — mainnet coins sit on
// BIP86 Taproot outputs (`prl1p…`). Validation is pure JS (bech32 checksum +
// witness-program checks, same rules as the Rust multichain adapter).
// Address *derivation* is delegated to the bundled `zion-derive-addr` helper
// which runs `Keyring::address(ChainId::Pearl, 0, 0)` — m/86'/808276'/0'/0/0,
// bit-identical to what the official Oyster wallet emits for the same
// mnemonic (parity covered by a known-answer test against live oyster).
//
// Balance/history go through the public app API `GET /api/prl?addr=prl1…`
// (server-side pearld proxy: validateaddress + searchrawtransactions +
// gettxout). No direct node access from the renderer machine is needed.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_API_BASE = (process.env.ZION_APP_API_URL || 'https://app.zionterranova.com').replace(/\/+$/, '');

// ── bech32 / bech32m (BIP-173/350, minimal — decode side only) ──────────────
const B32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const B32_MAP = new Map([...B32_ALPHABET].map((c, i) => [c, i]));

const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function _b32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) chk ^= GEN[i];
    }
  }
  return chk >>> 0;
}

function _hrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >>> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function _convertBits(data, fromBits, toBits, pad) {
  let acc = 0, bits = 0;
  const maxv = (1 << toBits) - 1;
  const out = [];
  for (const v of data) {
    if (v < 0 || (v >>> fromBits) !== 0) return null;
    acc = (acc << fromBits) | v;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      out.push((acc >>> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    return null;
  }
  return out;
}

/**
 * Decode a segwit address. Returns { hrp, version, program:Buffer } or null.
 * Version 0 → bech32, version ≥1 → bech32m (BIP-350).
 */
function segwitDecode(addr) {
  try {
    const s = String(addr || '').trim();
    if (s.length < 8 || s.length > 90) return null;
    const lower = s.toLowerCase();
    if (lower !== s && s.toUpperCase() !== s) return null; // mixed case
    const a = lower;
    const sep = a.lastIndexOf('1');
    if (sep < 1 || sep + 7 > a.length) return null;
    const hrp = a.slice(0, sep);
    const data = [];
    for (const c of a.slice(sep + 1)) {
      const v = B32_MAP.get(c);
      if (v === undefined) return null;
      data.push(v);
    }
    const pm = _b32Polymod([..._hrpExpand(hrp), ...data]);
    if (pm !== BECH32_CONST && pm !== BECH32M_CONST) return null;
    const payload = data.slice(0, data.length - 6);
    if (payload.length === 0) return null;
    const version = payload[0];
    if (version > 16) return null;
    const program = _convertBits(payload.slice(1), 5, 8, false);
    if (!program || program.length < 2 || program.length > 40) return null;
    if (version === 0 && program.length !== 20 && program.length !== 32) return null;
    // BIP-350: v0 must use bech32, v1+ must use bech32m
    const expectConst = version === 0 ? BECH32_CONST : BECH32M_CONST;
    if (pm !== expectConst) return null;
    return { hrp, version, program: Buffer.from(program) };
  } catch {
    return null;
  }
}

/** True iff `addr` is a valid Pearl segwit address (hrp `prl`). */
function isValidPearlAddress(addr) {
  const d = segwitDecode(addr);
  return !!d && d.hrp === 'prl';
}

// ── derivation via bundled helper ───────────────────────────────────────────
function resolveHelperPath(appRoot, isPackaged) {
  const exe = process.platform === 'win32' ? 'zion-derive-addr.exe' : 'zion-derive-addr';
  const candidates = [
    isPackaged && process.resourcesPath ? path.join(process.resourcesPath, exe) : null,
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
 * Derive the Pearl (PRL) `prl1…` address for a BIP39 mnemonic using the
 * bundled `zion-derive-addr` helper — m/86'/808276'/0'/0/0, identical to the
 * address oyster emits for index 0 of the same phrase.
 * Returns `{ address }` or `{ error }` (same contract as quantus-wallet).
 */
function derivePearlAddressDetailed(mnemonic, appRoot, isPackaged) {
  const helper = resolveHelperPath(appRoot, isPackaged);
  if (!helper) {
    return { error: 'zion-derive-addr helper not found (resources/, resources/bin/, PATH)' };
  }
  const scrub = (s) => String(s || '').replace(/(sk|pk)=[0-9a-fA-F]+/g, '$1=<redacted>');
  let res;
  try {
    res = spawnSync(helper, [], {
      input: String(mnemonic).trim() + '\n',
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 64 * 1024
    });
  } catch (e) {
    return { error: `helper spawn failed: ${e.message}` };
  }
  if (res.error) return { error: `helper spawn error: ${res.error.message}` };
  if (res.status !== 0) {
    const tail = scrub(res.stderr || res.stdout).trim().split('\n').pop();
    return { error: `helper exited ${res.status}${tail ? `: ${tail.slice(0, 160)}` : ''}` };
  }
  const m = /(?:^|\s)prl=(prl1[0-9a-z]+)/.exec(res.stdout || '');
  if (!m) {
    const tail = scrub(res.stdout || res.stderr).trim().split('\n').pop() || 'empty output';
    return { error: `helper output missing prl= address (${tail.slice(0, 160)})` };
  }
  if (!isValidPearlAddress(m[1])) {
    return { error: 'helper produced an invalid prl1 address' };
  }
  return { address: m[1] };
}

function derivePearlAddress(mnemonic, appRoot, isPackaged) {
  return derivePearlAddressDetailed(mnemonic, appRoot, isPackaged).address || null;
}

// ── balance / history via the public app API ────────────────────────────────
const DEFAULT_API = `${APP_API_BASE}/api/prl`;

function _fetch(url, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => clearTimeout(t));
}

/**
 * Balance snapshot for a prl1 address. Returns
 * { confirmed_prl, utxo_unspent, utxo_checked } or null on failure.
 * Backed by pearld gettxout over the address-indexed outputs.
 */
async function pearlBalance(address, apiUrl = DEFAULT_API) {
  const addr = String(address || '').trim();
  if (!isValidPearlAddress(addr)) return null;
  const j = await _fetch(`${apiUrl}?addr=${encodeURIComponent(addr)}`);
  const bal = j?.wallet?.balance;
  if (!bal) return null;
  return {
    confirmed_prl: Number(bal.confirmed_prl ?? 0),
    utxo_unspent: bal.utxo_unspent ?? null,
    utxo_checked: bal.utxo_checked ?? null,
  };
}

/**
 * Recent transactions for a prl1 address (address index on the public node).
 * Returns [{txid, direction, amountPrl, confirmations, blockhash, ts}] or null.
 */
async function pearlHistory(address, limit = 20, apiUrl = DEFAULT_API) {
  const addr = String(address || '').trim();
  if (!isValidPearlAddress(addr)) return null;
  const j = await _fetch(`${apiUrl}?addr=${encodeURIComponent(addr)}`);
  const rows = j?.wallet?.history;
  if (!Array.isArray(rows)) return null;
  return rows.slice(0, Math.min(Math.max(1, limit | 0), 50)).map((r) => ({
    txid: r.txid || null,
    direction: r.direction === 'out' ? 'out' : 'in',
    amountPrl: Number(r.amount_prl ?? 0).toFixed(8),
    confirmations: r.confirmations ?? null,
    blockhash: r.blockhash || null,
    ts: r.ts || null,
  }));
}

module.exports = {
  isValidPearlAddress,
  segwitDecode,
  derivePearlAddress,
  derivePearlAddressDetailed,
  resolveHelperPath,
  pearlBalance,
  pearlHistory,
  DEFAULT_API,
};
