/**
 * ZION V3 Account-Model Transaction Builder — Mobile App v3.0.2
 *
 * Matches V3/L1/core/src/wallet.rs build_and_sign_account + lib.rs Transaction struct
 * + desktop agent's account-builder.js (identical semantics).
 *
 * Account model is used for wallets that have balance in the account ledger
 * (not UTXO). Transactions are confirmed in the next block — no coinbase
 * maturity needed. Typical accounts: premine wallets, DAO treasury,
 * converted-from-balance addresses.
 *
 * Transaction fields:
 * {
 *   tx_id: 64-char hex (deterministic from sender/recipient/amount/nonce),
 *   from: zion1... sender address,
 *   to: zion1... recipient address,
 *   amount_zion: u128 as string (in flowers, 1 ZION = 10^12 flowers),
 *   fee_zion: u64 number (MIN_FEE_FLOWERS = 1000 flowers = 0.000000001 ZION),
 *   nonce: u64 safe integer (timestamp_ms, unique per sender per tx),
 *   signature: 128-char hex Ed25519 signature over tx_id bytes,
 *   public_key: 64-char hex raw Ed25519 public key,
 * }
 */

import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { Buffer } from 'buffer';

// Wire up sync sha512 for @noble/ed25519 v3
ed25519.hashes.sha512 = sha512;

export const FLOWERS_PER_ZION = 1_000_000_000_000n;
export const MIN_FEE_FLOWERS = 1_000n;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseAmount(amountZion) {
  if (typeof amountZion === 'bigint') {
    return amountZion;
  }
  if (typeof amountZion === 'string') {
    const num = parseFloat(amountZion);
    // Treat as ZION if has decimal or is small
    if (amountZion.includes('.') || num < 1e12) {
      return BigInt(Math.floor(num * 1e12));
    }
    return BigInt(amountZion);
  }
  return BigInt(Math.floor(Number(amountZion) * 1e12));
}

// ---------------------------------------------------------------------------
// tx_id generation — matches Rust core generate_account_tx_id()
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic 64-char hex tx_id for an account transaction.
 *
 * Layout:
 *   bytes[0..16]  = timestamp_nanos (split as two u64 LE)
 *   bytes[16..24] = amount (u64 LE)
 *   bytes[24..32] = nonce (u64 LE)
 *   XOR from+to address bytes cyclically into all 32 bytes
 */
export function generateAccountTxId(from, to, amountFlowers, nonce) {
  const bytes = Buffer.alloc(32);

  // Timestamp nanos (16 bytes split into two u64 LE halves)
  const tsNanos = BigInt(Date.now()) * 1_000_000n;
  bytes.writeBigUInt64LE(tsNanos & 0xffffffffffffffffn, 0);
  bytes.writeBigUInt64LE((tsNanos >> 64n) & 0xffffffffffffffffn, 8);

  // Amount (8 bytes LE)
  bytes.writeBigUInt64LE(amountFlowers & 0xffffffffffffffffn, 16);

  // Nonce (8 bytes LE)
  bytes.writeBigUInt64LE(nonce & 0xffffffffffffffffn, 24);

  // XOR-in sender and recipient address bytes cyclically
  const fromBytes = Buffer.from(from, 'utf8');
  const toBytes = Buffer.from(to, 'utf8');
  const allAddr = Buffer.concat([fromBytes, toBytes]);
  for (let i = 0; i < allAddr.length; i++) {
    bytes[i % 32] ^= allAddr[i];
  }

  return bytesToHex(bytes);
}

// ---------------------------------------------------------------------------
// Build + sign
// ---------------------------------------------------------------------------

/**
 * Build and sign an account-model transaction.
 *
 * @param {Object} opts
 * @param {string} opts.from - Sender zion1... address
 * @param {string} opts.to - Recipient zion1... address
 * @param {number|string|bigint} opts.amountZion - Amount in ZION (human units)
 * @param {bigint|number} [opts.nonce] - Unique nonce (default: timestamp_ms)
 * @param {bigint|number} [opts.fee] - Fee in flowers (default: 1000)
 * @param {Buffer|Uint8Array|string} opts.privateKey - 32-byte Ed25519 seed
 *   (hex string or bytes, same format as CryptoService uses)
 * @returns {Object} V3-compatible AccountTransaction payload
 */
export async function buildAccountTransaction({
  from,
  to,
  amountZion,
  nonce,
  fee,
  privateKey,
}) {
  const amountFlowers = parseAmount(amountZion);
  const feeFlowers = fee != null ? BigInt(fee) : MIN_FEE_FLOWERS;
  const txNonce = nonce != null ? BigInt(nonce) : BigInt(Date.now());

  // Generate deterministic tx_id
  const txId = generateAccountTxId(from, to, amountFlowers, txNonce);

  // Normalize private key to Uint8Array
  let pkBytes;
  if (typeof privateKey === 'string') {
    pkBytes = Buffer.from(privateKey, 'hex');
  } else if (privateKey instanceof Uint8Array) {
    pkBytes = privateKey;
  } else if (Buffer.isBuffer(privateKey)) {
    pkBytes = privateKey;
  } else {
    throw new Error('privateKey must be hex string, Buffer, or Uint8Array');
  }
  if (pkBytes.length !== 32) {
    throw new Error(`Invalid private key length: expected 32 bytes, got ${pkBytes.length}`);
  }

  // Derive public key (32 bytes raw)
  const pubKey = Buffer.from(ed25519.getPublicKey(pkBytes));

  // Sign tx_id bytes with Ed25519
  const sig = ed25519.sign(Buffer.from(txId, 'utf8'), pkBytes);

  return {
    tx_id: txId,
    from,
    to,
    amount_zion: amountFlowers.toString(),
    fee_zion: Number(feeFlowers),
    nonce: Number(txNonce),
    signature: bytesToHex(sig),
    public_key: bytesToHex(pubKey),
  };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify an account transaction signature.
 * @param {Object} tx - Signed account transaction
 * @returns {boolean} signature valid?
 */
export async function verifyAccountTransaction(tx) {
  try {
    const pub = Buffer.from(tx.public_key, 'hex');
    const sig = Buffer.from(tx.signature, 'hex');
    if (pub.length !== 32 || sig.length !== 64) return false;
    return ed25519.verify(sig, Buffer.from(tx.tx_id, 'utf8'), pub);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Detect model from balance
// ---------------------------------------------------------------------------

/**
 * Return the best transaction model ('account' | 'utxo') for this balance.
 * @param {Object} balance - Response from getBalance RPC
 * @returns {{ model: string, amountFlowers: bigint }}
 */
export function preferTxModel(balance) {
  const utxoFlowers = BigInt(balance?.utxo_balance_flowers || balance?.utxo_count ? 0 : 0);
  const accountFlowers = BigInt(balance?.account_balance_flowers || 0);

  if (utxoFlowers > 0n) {
    return { model: 'utxo', amountFlowers: utxoFlowers };
  }
  if (accountFlowers > 0n) {
    return { model: 'account', amountFlowers: accountFlowers };
  }
  return { model: 'account', amountFlowers: 0n };
}

export default {
  buildAccountTransaction,
  verifyAccountTransaction,
  generateAccountTxId,
  preferTxModel,
  FLOWERS_PER_ZION,
  MIN_FEE_FLOWERS,
};
