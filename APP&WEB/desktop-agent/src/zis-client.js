// ZIS Client — ZION Identity Service integration for the desktop agent.
//
// Handles Ed25519 (ZION L1) and SIWE (EVM) login, session storage,
// API key management, and authenticated public-API calls for multichain.
// Runs in the Electron main process.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bip39 = require('bip39');
const ed25519 = require('@noble/ed25519');
const { sha256 } = require('@noble/hashes/sha2');
const { ripemd160 } = require('@noble/hashes/legacy');
const { sha512 } = require('@noble/hashes/sha512');
const { ethers } = require('ethers');

// Wire up sync SHA-512 for @noble/ed25519 v3
ed25519.hashes.sha512 = sha512;

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

const DEFAULT_ZIS_URL = 'https://auth.zionterranova.com';
const ZIS_SESSION_COOKIE = 'zion_session';

let _storageDir = '';
let _zisUrl = DEFAULT_ZIS_URL;
let _publicApiBase = 'https://app.zionterranova.com';

function zionAddressFromPublicKey(publicKey) {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${publicKey.length}`);
  }
  const sha = sha256(publicKey);
  const keyHash = ripemd160(sha);
  let data = '';
  for (const byte of keyHash) {
    data += ZION_BASE32[byte % 32];
    data += ZION_BASE32[Math.floor(byte / 32) % 32];
  }
  const body = data.slice(0, 35);
  const ckHash = sha256(Buffer.from(ZION_PREFIX + body, 'utf8'));
  let checksum = '';
  for (let i = 0; i < 2; i++) {
    const b = ckHash[i];
    checksum += ZION_BASE32[b % 32];
    checksum += ZION_BASE32[Math.floor(b / 32) % 32];
  }
  return ZION_PREFIX + body + checksum;
}

function sessionFile() {
  if (!_storageDir) throw new Error('ZIS storage directory not set');
  return path.join(_storageDir, 'zis-session.json');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSession() {
  try {
    const f = sessionFile();
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (e) {
    console.error('[ZIS] loadSession error:', e.message);
  }
  return { token: null, user: null, expiresAt: null, apiKey: null, mode: null };
}

function saveSession(session) {
  try {
    ensureDir(_storageDir);
    fs.writeFileSync(sessionFile(), JSON.stringify(session, null, 2));
  } catch (e) {
    console.error('[ZIS] saveSession error:', e.message);
  }
}

let _inMemorySession = loadSession();

async function zisFetch(method, endpoint, body, headers = {}) {
  const url = `${_zisUrl}${endpoint}`;
  const opts = {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* raw text */ }
  return { status: resp.status, ok: resp.ok, text, json };
}

function authHeaders() {
  const headers = {};
  const session = _inMemorySession;
  if (session.token) {
    headers.Cookie = `${ZIS_SESSION_COOKIE}=${session.token}`;
  }
  if (session.apiKey) {
    headers.Authorization = `Bearer ${session.apiKey}`;
  }
  return headers;
}

function publicApiUrl(path) {
  return `${_publicApiBase}${path.startsWith('/') ? path : '/' + path}`;
}

async function publicApi(method, apiPath, body, extraHeaders = {}) {
  const url = publicApiUrl(apiPath);
  const opts = {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...authHeaders(), ...extraHeaders },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* raw text */ }
  return { status: resp.status, ok: resp.ok, text, json };
}

async function ed25519KeypairFromSeed(seed) {
  const seedBytes = new Uint8Array(seed);
  if (seedBytes.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
  const publicKeyRaw = ed25519.getPublicKey(seedBytes);
  const publicKeyHex = Buffer.from(publicKeyRaw).toString('hex');
  const address = zionAddressFromPublicKey(publicKeyRaw);
  return { seed: seedBytes, publicKey: publicKeyRaw, publicKeyHex, address };
}

async function ed25519KeypairFromMnemonic(mnemonic) {
  if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid BIP39 mnemonic');
  const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32);
  return ed25519KeypairFromSeed(seed);
}

async function ed25519SignChallenge(seed, challenge) {
  const msg = new TextEncoder().encode(challenge);
  const sig = await ed25519.sign(msg, seed);
  return Buffer.from(sig).toString('hex');
}

function extractNonce(challenge) {
  const m = challenge.match(/nonce: ([a-f0-9]+)/i);
  if (m) return m[1];
  throw new Error('Could not extract nonce from ZIS challenge');
}

function formatSiweMessage({ address, nonce, domain = 'auth.zionterranova.com', uri = 'https://auth.zionterranova.com', chainId = '8453', statement = 'Sign in to ZION Identity Service' }) {
  const issuedAt = new Date().toISOString();
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
}

class ZisClient {
  setStorageDir(dir) {
    _storageDir = dir;
    _inMemorySession = loadSession();
  }

  setZisUrl(url) {
    _zisUrl = (url || DEFAULT_ZIS_URL).replace(/\/$/, '');
  }

  setPublicApiBase(url) {
    _publicApiBase = (url || 'https://app.zionterranova.com').replace(/\/$/, '');
  }

  getSession() {
    return { ..._inMemorySession };
  }

  isLoggedIn() {
    const s = _inMemorySession;
    if (!s.token && !s.apiKey) return false;
    if (s.expiresAt && new Date(s.expiresAt) < new Date()) return false;
    return true;
  }

  async loginWithMnemonic(mnemonic) {
    const keypair = await ed25519KeypairFromMnemonic(mnemonic);
    const { json } = await zisFetch('POST', '/api/auth/challenge', { address: keypair.address, chainType: 'zion-l1' });
    if (!json || !json.challenge) throw new Error('No challenge from ZIS');
    const signature = await ed25519SignChallenge(keypair.seed, json.challenge);
    const result = await zisFetch('POST', '/api/auth/verify/ed25519', {
      address: keypair.address,
      publicKey: keypair.publicKeyHex,
      signature,
    });
    if (!result.ok || !result.json || !result.json.token) {
      throw new Error(result.json?.message || result.json?.error || `ZIS auth failed (${result.status})`);
    }
    _inMemorySession = {
      token: result.json.token,
      user: result.json.user,
      expiresAt: result.json.expiresAt,
      apiKey: null,
      mode: 'ed25519',
    };
    saveSession(_inMemorySession);
    return this.getSession();
  }

  async loginWithPrivateKey(privateKeyHex) {
    // Accept 64-char raw seed or 128-char raw Ed25519 secret (seed + pub).
    const hex = privateKeyHex.replace(/^0x/, '').trim();
    let seed;
    if (hex.length === 64) {
      seed = Buffer.from(hex, 'hex');
    } else if (hex.length === 128) {
      seed = Buffer.from(hex.slice(0, 64), 'hex');
    } else {
      throw new Error('Private key must be 64 or 128 hex chars (raw Ed25519 seed)');
    }
    const keypair = await ed25519KeypairFromSeed(seed);
    const { json } = await zisFetch('POST', '/api/auth/challenge', { address: keypair.address, chainType: 'zion-l1' });
    if (!json || !json.challenge) throw new Error('No challenge from ZIS');
    const signature = await ed25519SignChallenge(keypair.seed, json.challenge);
    const result = await zisFetch('POST', '/api/auth/verify/ed25519', {
      address: keypair.address,
      publicKey: keypair.publicKeyHex,
      signature,
    });
    if (!result.ok || !result.json || !result.json.token) {
      throw new Error(result.json?.message || result.json?.error || `ZIS auth failed (${result.status})`);
    }
    _inMemorySession = {
      token: result.json.token,
      user: result.json.user,
      expiresAt: result.json.expiresAt,
      apiKey: null,
      mode: 'ed25519',
    };
    saveSession(_inMemorySession);
    return this.getSession();
  }

  async loginWithSiwe(privateKeyHex) {
    const key = privateKeyHex.replace(/^0x/, '').trim();
    const wallet = new ethers.Wallet(key);
    const { json } = await zisFetch('POST', '/api/auth/challenge', { address: wallet.address, chainType: 'evm' });
    if (!json || !json.challenge) throw new Error('No challenge from ZIS');
    const nonce = extractNonce(json.challenge);
    const message = formatSiweMessage({ address: wallet.address, nonce });
    const signature = await wallet.signMessage(message);
    const result = await zisFetch('POST', '/api/auth/verify/siwe', {
      address: wallet.address,
      message,
      signature,
    });
    if (!result.ok || !result.json || !result.json.token) {
      throw new Error(result.json?.message || result.json?.error || `ZIS SIWE auth failed (${result.status})`);
    }
    _inMemorySession = {
      token: result.json.token,
      user: result.json.user,
      expiresAt: result.json.expiresAt,
      apiKey: null,
      mode: 'siwe',
    };
    saveSession(_inMemorySession);
    return this.getSession();
  }

  async me() {
    const { json } = await zisFetch('GET', '/api/auth/me', null, authHeaders());
    return json;
  }

  async logout() {
    await zisFetch('POST', '/api/auth/logout', null, authHeaders());
    _inMemorySession = { token: null, user: null, expiresAt: null, apiKey: null, mode: null };
    saveSession(_inMemorySession);
    return { ok: true };
  }

  async listApiKeys() {
    const { json } = await zisFetch('GET', '/api/keys', null, authHeaders());
    return json;
  }

  async createApiKey(label) {
    const { json } = await zisFetch('POST', '/api/keys', { label }, authHeaders());
    if (json?.key) {
      _inMemorySession.apiKey = json.key;
      saveSession(_inMemorySession);
    }
    return json;
  }

  async revokeApiKey(id) {
    const { json } = await zisFetch('DELETE', `/api/keys/${id}`, null, authHeaders());
    return json;
  }

  async setApiKey(key) {
    _inMemorySession.apiKey = key;
    saveSession(_inMemorySession);
    return this.getSession();
  }

  // ── Authenticated public multichain API helpers ───────────────────
  async bridgeSubmit({ direction, from, to, amount, sourceAddress, targetAddress }) {
    return publicApi('POST', '/api/bridge/submit', { direction, from, to, amount: String(amount), source_address: sourceAddress, target_address: targetAddress });
  }

  async swapQuote({ from, to, amount, decimals }) {
    return publicApi('POST', '/api/swap/quote', { from, to, amount: String(amount), decimals });
  }

  async swapExecute({ from, to, amount, decimals }) {
    return publicApi('POST', '/api/swap/execute', { from, to, amount: String(amount), decimals });
  }

  async htlcLock({ from, to, amount, hashHex, timelock, sourceAddress, targetAddress, sourcePubkeyHex, targetPubkeyHex }) {
    return publicApi('POST', '/api/swap/htlc/lock', {
      from, to, amount: String(amount), hash_hex: hashHex, timelock,
      source_address: sourceAddress, target_address: targetAddress,
      source_pubkey_hex: sourcePubkeyHex, target_pubkey_hex: targetPubkeyHex,
    });
  }

  async htlcClaim({ hash, preimage, recipient, token }) {
    return publicApi('POST', '/api/swap/htlc/claim', { hash, preimage, recipient, token });
  }

  async htlcRefund({ hash, token }) {
    return publicApi('POST', '/api/swap/htlc/refund', { hash, token });
  }

  async htlcPending() {
    return publicApi('GET', '/api/swap/htlc/pending');
  }

  async htlcEscrow() {
    return publicApi('GET', '/api/swap/htlc/escrow');
  }

  async htlcGet(hash) {
    return publicApi('GET', `/api/swap/htlc/${encodeURIComponent(hash)}`);
  }
}

module.exports = new ZisClient();
