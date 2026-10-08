// Native multichain wallet — derives per-chain keys from a ZION mnemonic,
// entirely in the browser (non-custodial; nothing is sent to any server).
//
// Parity-tested against the Rust `derive_addr` helper:
//   zion    bip39 seed[0:32] → ed25519 → zion1…   (web/desktop wallet compat)
//   evm     BIP32 m/44'/60'/0'/0/0 → secp256k1    (MetaMask-compatible)
//   bitcoin BIP84 m/84'/0'/0'/0/0 → P2WPKH bc1q…
//   solana  SLIP-0010 m/44'/501'/0'/0' → ed25519  (Phantom-compatible)
//   quantus ML-DSA-87 — not derivable in JS; desktop agent only.
//
// Private keys live only in memory for the duration of the session.

import { mnemonicToSeedSync } from '@scure/bip39';
import { sha256 } from '@noble/hashes/sha2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';
import * as ed25519 from '@noble/ed25519';
import { ethers } from 'ethers';

// noble-ed25519 v3 needs an explicit sha512 implementation for sync paths.
ed25519.hashes.sha512 = (...msgs: Uint8Array[]) =>
  sha512(msgs.length === 1 ? msgs[0] : concatBytesAll(msgs));

function concatBytesAll(msgs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(msgs.reduce((n, m) => n + m.length, 0));
  let off = 0;
  for (const m of msgs) { out.set(m, off); off += m.length; }
  return out;
}

const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const EVM_RPC = 'https://mainnet.base.org';
const BTC_API = 'https://mempool.space/api';
const SOL_RPC = 'https://api.mainnet-beta.solana.com';
const ZIS_URL = process.env.NEXT_PUBLIC_ZIS_URL || 'https://auth.zionterranova.com';

export interface NativeChainEntry {
  chain: string;
  address: string;
  privateKey?: string; // hex or b58 — memory only
  publicKey?: string;
  standard: string;
}

export interface NativeBundle {
  zion: NativeChainEntry;
  evm: NativeChainEntry;
  bitcoin: NativeChainEntry;
  solana: NativeChainEntry;
  quantus: NativeChainEntry | null; // ML-DSA — agent-only derivation
}

// ── encodings ────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function b58encode(buf: Uint8Array): string {
  let num = 0n;
  for (const b of buf) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + out;
}

function b64encode(buf: Uint8Array): string {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < buf.length; i += 3) {
    const a = buf[i], b = buf[i + 1], c = buf[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | (c >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

export function b58decode(s: string): Uint8Array {
  let num = 0n;
  for (const ch of s) {
    const d = B58.indexOf(ch);
    if (d < 0) throw new Error(`invalid base58 char '${ch}'`);
    num = num * 58n + BigInt(d);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hex === '00' || hex === '' ? new Uint8Array(0) : hexToBytes(hex);
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  const out = new Uint8Array(zeros + bytes.length);
  out.set(bytes, zeros);
  return out;
}

/** zion1 address from an ed25519 public key — same scheme as identity/challenge.ts. */
export function zionPublicKeyToAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('bad pubkey');
  const keyHash = ripemd160(sha256(publicKey));
  let data = '';
  for (const byte of keyHash) {
    data += ZION_BASE32[byte % 32];
    data += ZION_BASE32[Math.floor(byte / 32) % 32];
  }
  const body = data.slice(0, 35);
  const ckHash = sha256(new TextEncoder().encode('zion1' + body));
  let checksum = '';
  for (let i = 0; i < 2; i++) {
    const b = ckHash[i];
    checksum += ZION_BASE32[b % 32];
    checksum += ZION_BASE32[Math.floor(b / 32) % 32];
  }
  return 'zion1' + body + checksum;
}

/** Bech32 P2WPKH (bc1q…) from a 20-byte witness program. */
export function bech32P2wpkh(prog: Uint8Array, hrp = 'bc'): string {
  const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const polymod = (values: number[]): number => {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const v of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
    }
    return chk;
  };
  const hrpExpand = [
    ...Array.from(hrp).map((c) => c.charCodeAt(0) >> 5),
    0,
    ...Array.from(hrp).map((c) => c.charCodeAt(0) & 31),
  ];
  // witness version 0 ‖ 8→5 bit conversion
  const data = [0];
  let acc = 0;
  let bits = 0;
  for (const b of prog) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      data.push((acc >> bits) & 31);
    }
  }
  if (bits) data.push((acc << (5 - bits)) & 31);
  const mod = polymod(hrpExpand.concat(data).concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const checksum = [0, 1, 2, 3, 4, 5].map((i) => (mod >> (5 * (5 - i))) & 31);
  return hrp + '1' + data.concat(checksum).map((d) => ALPHABET[d]).join('');
}

/** SLIP-0010 Ed25519 derivation (all-hardened path). */
function slip10Ed25519(seed: Uint8Array, path: number[]): Uint8Array {
  let key = hmac(sha512, new TextEncoder().encode('ed25519 seed'), seed);
  let chain = key.slice(32);
  key = key.slice(0, 32);
  for (const i of path) {
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, i + 0x80000000, false);
    const k = hmac(sha512, chain, data);
    key = k.slice(0, 32);
    chain = k.slice(32);
  }
  return key;
}

// ── derivation ───────────────────────────────────────────────────────────────

/**
 * Derive the native multichain bundle from a BIP-39 mnemonic.
 * Quantus is null on the web (ML-DSA-87 has no browser impl) — derive it
 * in the desktop agent instead.
 */
export async function deriveNativeBundle(mnemonic: string): Promise<NativeBundle> {
  const seed = mnemonicToSeedSync(mnemonic.trim().toLowerCase());

  // zion — seed[0:32] → ed25519 (matches wallet-generator.js)
  const zionSeed = seed.slice(0, 32);
  const zionPk = await ed25519.getPublicKey(zionSeed);
  const zion: NativeChainEntry = {
    chain: 'zion-l1',
    address: zionPublicKeyToAddress(zionPk),
    publicKey: bytesToHex(zionPk),
    privateKey: bytesToHex(zionSeed),
    standard: 'zion-native seed[0:32]',
  };

  // evm — ethers HDNode m/44'/60'/0'/0/0
  const evmNode = ethers.utils.HDNode.fromSeed(seed).derivePath("m/44'/60'/0'/0/0");
  const evm: NativeChainEntry = {
    chain: 'evm',
    address: ethers.utils.computeAddress(evmNode.publicKey),
    privateKey: evmNode.privateKey.replace(/^0x/, ''),
    standard: "bip44 m/44'/60'/0'/0/0",
  };

  // bitcoin — bip84 m/84'/0'/0'/0/0 → p2wpkh
  const btcNode = ethers.utils.HDNode.fromSeed(seed).derivePath("m/84'/0'/0'/0/0");
  const btcPubCompressed = hexToBytes(ethers.utils.computePublicKey(btcNode.publicKey, true));
  const btcHash160 = ripemd160(sha256(btcPubCompressed));
  const bitcoin: NativeChainEntry = {
    chain: 'bitcoin',
    address: bech32P2wpkh(btcHash160),
    privateKey: btcNode.privateKey.replace(/^0x/, ''),
    standard: "bip84 m/84'/0'/0'/0/0",
  };

  // solana — slip-0010 m/44'/501'/0'/0' → ed25519 → base58 pubkey
  const solSeed = slip10Ed25519(seed, [44, 501, 0, 0]);
  const solPk = await ed25519.getPublicKey(solSeed);
  const solSecret = new Uint8Array(64);
  solSecret.set(solSeed, 0);
  solSecret.set(solPk, 32);
  const solana: NativeChainEntry = {
    chain: 'solana',
    address: b58encode(solPk),
    privateKey: b58encode(solSecret),
    standard: "slip-0010 m/44'/501'/0'/0'",
  };

  return { zion, evm, bitcoin, solana, quantus: null };
}

// ── balances ─────────────────────────────────────────────────────────────────

async function rpcJson(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'rpc error');
  return json.result;
}

export async function fetchNativeBalances(bundle: NativeBundle): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const jobs: [string, () => Promise<string>][] = [
    ['evm', async () => (Number(BigInt(await rpcJson(EVM_RPC, 'eth_getBalance', [bundle.evm.address, 'latest']))) / 1e18).toFixed(6) + ' ETH'],
    ['bitcoin', async () => {
      const r = await fetch(`${BTC_API}/address/${bundle.bitcoin.address}`);
      if (!r.ok) throw new Error('btc api');
      const j = await r.json();
      const funded = BigInt(j.chain_stats?.funded_txo_sum ?? 0) + BigInt(j.mempool_stats?.funded_txo_sum ?? 0);
      const spent = BigInt(j.chain_stats?.spent_txo_sum ?? 0) + BigInt(j.mempool_stats?.spent_txo_sum ?? 0);
      return (Number(funded - spent) / 1e8).toFixed(8) + ' BTC';
    }],
    ['solana', async () => {
      const r = await rpcJson(SOL_RPC, 'getBalance', [bundle.solana.address]);
      return (Number(BigInt(r?.value ?? 0)) / 1e9).toFixed(6) + ' SOL';
    }],
  ];
  const res = await Promise.allSettled(jobs.map(([, f]) => f()));
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') out[jobs[i][0]] = r.value;
  });
  return out;
}

// ── ZIS linking ──────────────────────────────────────────────────────────────

async function zisFetch(endpoint: string, body?: unknown): Promise<any> {
  const res = await fetch(`${ZIS_URL}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

/** ed25519 sign helper — sha512 hint for noble v3 in browsers. */
async function zionSign(msg: Uint8Array, seed: Uint8Array): Promise<string> {
  const sig = await ed25519.sign(msg, seed);
  return bytesToHex(sig);
}

/**
 * Link all derivable native addresses to the signed-in ZIS account.
 * Requires an active zion_session cookie. Returns per-chain results.
 */
export async function linkAllToZis(bundle: NativeBundle): Promise<Record<string, { ok: boolean; error?: string; conflict?: boolean }>> {
  const results: Record<string, { ok: boolean; error?: string; conflict?: boolean }> = {};
  const hex = (b: Uint8Array) => bytesToHex(b);

  const link = async (address: string, chainType: string, payload: Record<string, string>) => {
    const r = await zisFetch('/api/auth/link', {
      address, chainType, ...payload,
    });
    if (r.status === 409) return { ok: false, conflict: true, error: 'linked to another account' };
    if (r.json?.user || r.json?.linked) return { ok: true };
    return { ok: false, error: r.json?.message || `link failed (${r.status})` };
  };

  const challenge = async (address: string, chainType: string): Promise<string> => {
    const r = await zisFetch('/api/auth/challenge', { address, chainType });
    if (!r.json?.challenge) throw new Error(`no challenge (${r.status})`);
    return r.json.challenge as string;
  };

  // zion-l1
  try {
    const ch = await challenge(bundle.zion.address, 'zion-l1');
    const sig = await zionSign(new TextEncoder().encode(ch), hexToBytes(bundle.zion.privateKey!));
    results.zion = await link(bundle.zion.address, 'zion-l1', { publicKey: bundle.zion.publicKey!, signature: sig });
  } catch (e: any) {
    results.zion = { ok: false, error: e.message };
  }

  // solana
  try {
    const ch = await challenge(bundle.solana.address, 'solana');
    const seed = b58decode(bundle.solana.privateKey!).slice(0, 32);
    const sig = await zionSign(new TextEncoder().encode(ch), seed);
    results.solana = await link(bundle.solana.address, 'solana', { signature: sig });
  } catch (e: any) {
    results.solana = { ok: false, error: e.message };
  }

  // bitcoin — recoverable ecdsa over sha256("ZION-BTC-LINK-V1"‖0x00‖challenge)
  try {
    const { secp256k1 } = await import('@noble/curves/secp256k1.js');
    const ch = await challenge(bundle.bitcoin.address, 'bitcoin');
    const digest = sha256(new Uint8Array([
      ...new TextEncoder().encode('ZION-BTC-LINK-V1'),
      0,
      ...new TextEncoder().encode(ch),
    ]));
    const sk = hexToBytes(bundle.bitcoin.privateKey!);
    const sig = secp256k1.sign(digest, sk, { lowS: true });
    // noble v1/2: recover public key via signature.recovery — build compact+recid
    const sigBytes = sig.toCompactRawBytes();
    // find the recovery bit matching our compressed pubkey
    const myPub = secp256k1.getPublicKey(sk, true);
    let recid = -1;
    for (let r = 0; r < 4; r++) {
      try {
        const recovered = secp256k1.Signature.fromCompact(sigBytes)
          .addRecoveryBit(r)
          .recoverPublicKey(digest)
          .toRawBytes(true);
        if (bytesToHex(recovered) === bytesToHex(myPub)) { recid = r; break; }
      } catch { /* try next */ }
    }
    if (recid < 0) throw new Error('recovery bit not found');
    const sig65 = new Uint8Array(65);
    sig65.set(sigBytes, 0);
    sig65[64] = recid;
    results.bitcoin = await link(bundle.bitcoin.address, 'bitcoin', { signature: hex(sig65) });
  } catch (e: any) {
    results.bitcoin = { ok: false, error: e.message };
  }

  // evm — SIWE-style message over the challenge nonce
  try {
    const wallet = new ethers.Wallet('0x' + bundle.evm.privateKey);
    const ch = await challenge(bundle.evm.address, 'evm');
    const nonce = /nonce: ([^\n]+)/i.exec(ch)?.[1];
    const message = [
      'app.zionterranova.com wants you to sign in with your Ethereum account:',
      bundle.evm.address, '', 'Link your native EVM address to ZION.', '',
      'URI: https://app.zionterranova.com', 'Version: 1', 'Chain ID: 8453',
      `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`,
    ].join('\n');
    const signature = await wallet.signMessage(message);
    results.evm = await link(bundle.evm.address, 'evm', { chainId: 'base', message, signature });
  } catch (e: any) {
    results.evm = { ok: false, error: e.message };
  }

  return results;
}

// ── sends (memory keys only) ─────────────────────────────────────────────────

export async function sendEvm(privateKeyHex: string, to: string, amountEth: string): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(EVM_RPC);
    const wallet = new ethers.Wallet('0x' + privateKeyHex, provider);
    const tx = await wallet.sendTransaction({ to, value: ethers.utils.parseEther(amountEth) });
    return { ok: true, txHash: tx.hash };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function sendSolana(secretKeyB58: string, toAddress: string, amountSol: string): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    const secret = b58decode(secretKeyB58);
    if (secret.length !== 64) throw new Error('bad key');
    const seed = secret.slice(0, 32);
    const fromPk = await ed25519.getPublicKey(seed);
    const toPk = b58decode(toAddress);
    if (toPk.length !== 32) throw new Error('invalid recipient');
    const bh = await rpcJson(SOL_RPC, 'getLatestBlockhash', [{ commitment: 'finalized' }]);
    const blockhash = b58decode(bh.blockhash);
    const SYSTEM = new Uint8Array(32);
    const compact = (n: number): Uint8Array => {
      const out: number[] = [];
      let x = n;
      do { let b = x & 0x7f; x = Math.floor(x / 128); if (x) b |= 0x80; out.push(b); } while (x);
      return new Uint8Array(out);
    };
    const ixData = new Uint8Array(12);
    new DataView(ixData.buffer).setUint32(0, 2, true);
    new DataView(ixData.buffer).setBigUint64(4, BigInt(Math.round(Number(amountSol) * 1e9)), true);
    const concat = (...parts: Uint8Array[]) => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let off = 0;
      for (const p of parts) { out.set(p, off); off += p.length; }
      return out;
    };
    const keys = [fromPk, toPk, SYSTEM];
    const message = concat(
      new Uint8Array([1, 0, 1]),
      compact(keys.length), ...keys, blockhash,
      compact(1),
      new Uint8Array([2]), compact(2), new Uint8Array([0, 1]),
      compact(ixData.length), ixData,
    );
    const sig = await ed25519.sign(message, seed);
    const wire = concat(compact(1), sig, message);
    const txHash = await rpcJson(SOL_RPC, 'sendTransaction', [
      b64encode(wire),
      { encoding: 'base64', preflightCommitment: 'confirmed' },
    ]);
    return { ok: true, txHash };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
