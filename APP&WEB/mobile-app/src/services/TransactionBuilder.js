/**
 * ZION V3 UTXO Transaction Builder — Mobile App v3.0.2
 *
 * Binary-compatible desktop `utxo-builder.js` / Rust `core/src/tx.rs`.
 *
 * TX format: v2 (TX_HASH_V2) from genesis — BLAKE3 hash of length-prefixed binary
 * preimage with domain separation `ZION_TX_V2\x00`.
 *
 * @see V3/L1/core/src/tx.rs — Transaction::calculate_hash_v2()
 * @see APP&WEB/desktop-agent/src/utxo-builder.js — node-compatible reference impl
 */

import { blake3 } from '@noble/hashes/blake3';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { Buffer } from 'buffer';
import {
  ATOMIC_UNITS_PER_ZION,
  zionToAtomic,
  atomicToZion,
  MIN_FEE_FLOWERS,
} from '../constants/blockchain';

// Wire up @noble/ed25519 v3 — needs sha512 to be set explicitly
ed25519.hashes.sha512 = sha512;

// ---------------------------------------------------------------------------
// BLAKE3 hash
// ---------------------------------------------------------------------------

/**
 * Compute BLAKE3 hash (32 bytes).
 * Matches `V3/L1/core/src/crypto.rs` blake3_hash().
 * @param {Uint8Array|Buffer} data
 * @returns {Buffer} 32-byte hash
 */
function blake3Hash(data) {
  return Buffer.from(blake3(data));
}

// ---------------------------------------------------------------------------
// Transaction hash — V3 TX_HASH_V2 binary preimage
// ---------------------------------------------------------------------------

/**
 * Compute the canonical SegWit-style BLAKE3 transaction hash.
 * Matches `V3/L1/core/src/tx.rs` `calculate_hash_v2()`.
 *
 * v2 preimage (length-prefixed, domain-separated):
 *   DOMAIN  = b"ZION_TX_V2\x00"
 *   version (u32 LE)
 *   fee     (u64 LE)
 *   timestamp (u64 LE)
 *   inputs_count (u32 LE)
 *   for each input:
 *     prev_tx_hash       (32 bytes)
 *     output_index       (u32 LE)
 *     public_key length  (u32 LE)
 *     public_key bytes
 *   outputs_count (u32 LE)
 *   for each output:
 *     amount           (u64 LE)
 *     address length   (u32 LE)
 *     address bytes
 *     memo tag: 0=absent, 1=present
 *     if present: memo length (u32 LE) + memo bytes
 *
 * Signatures excluded (SegWit-style).
 */
function calculateTxHash(tx) {
  const parts = [];

  // Domain-separation tag
  parts.push(Buffer.from('ZION_TX_V2\x00', 'binary'));

  // version: u32 LE
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(tx.version);
  parts.push(versionBuf);

  // fee: u64 LE
  const feeBuf = Buffer.alloc(8);
  feeBuf.writeBigUInt64LE(BigInt(tx.fee));
  parts.push(feeBuf);

  // timestamp: u64 LE
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64LE(BigInt(tx.timestamp));
  parts.push(tsBuf);

  // inputs count: u32 LE
  const inputCountBuf = Buffer.alloc(4);
  inputCountBuf.writeUInt32LE(tx.inputs.length);
  parts.push(inputCountBuf);

  // inputs (exclude signature — SegWit-style)
  for (const input of tx.inputs) {
    parts.push(Buffer.from(input.prev_tx_hash)); // 32 bytes
    const idxBuf = Buffer.alloc(4);
    idxBuf.writeUInt32LE(input.output_index);
    parts.push(idxBuf);
    const pubKey = Buffer.from(input.public_key);
    const pkLenBuf = Buffer.alloc(4);
    pkLenBuf.writeUInt32LE(pubKey.length);
    parts.push(pkLenBuf);
    parts.push(pubKey);
  }

  // outputs count: u32 LE
  const outputCountBuf = Buffer.alloc(4);
  outputCountBuf.writeUInt32LE(tx.outputs.length);
  parts.push(outputCountBuf);

  // outputs
  for (const output of tx.outputs) {
    const amtBuf = Buffer.alloc(8);
    amtBuf.writeBigUInt64LE(BigInt(output.amount));
    parts.push(amtBuf);
    const addrBytes = Buffer.from(output.address, 'utf8');
    const addrLenBuf = Buffer.alloc(4);
    addrLenBuf.writeUInt32LE(addrBytes.length);
    parts.push(addrLenBuf);
    parts.push(addrBytes);
    if (output.memo) {
      const memoBytes = Buffer.from(output.memo, 'utf8');
      const memoLenBuf = Buffer.alloc(4);
      memoLenBuf.writeUInt32LE(memoBytes.length);
      parts.push(Buffer.from([1]));
      parts.push(memoLenBuf);
      parts.push(memoBytes);
    } else {
      parts.push(Buffer.from([0]));
    }
  }

  return blake3Hash(Buffer.concat(parts));
}

// ---------------------------------------------------------------------------
// UTXO Selection
// ---------------------------------------------------------------------------

/**
 * Select UTXOs that cover `targetAtomic + feeAtomic`.
 */
export function selectUTXOs(utxos, targetAtomic, feeAtomic) {
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs available');
  }

  const needed = BigInt(targetAtomic) + BigInt(feeAtomic);
  const sorted = [...utxos].sort(
    (a, b) => Number(BigInt(b.amount) - BigInt(a.amount))
  );

  const selected = [];
  let totalIn = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalIn += BigInt(utxo.amount);
    if (totalIn >= needed) break;
  }

  if (totalIn < needed) {
    throw new Error(
      `Insufficient funds. Need ${atomicToZion(needed)} ZION but only ${atomicToZion(totalIn)} ZION available.`
    );
  }

  const change = totalIn - needed;
  return { selected, totalIn, change };
}

// ---------------------------------------------------------------------------
// Fee estimation
// ---------------------------------------------------------------------------

/**
 * Estimate tx fee. For now returns minimum fee.
 */
export function estimateTransactionFee(inputCount, outputCount = 2) {
  const feeFlowers = Number(MIN_FEE_FLOWERS);
  return {
    bytes: inputCount * 250 + outputCount * 34 + 10,
    feeAtomic: feeFlowers,
    feeZion: atomicToZion(feeFlowers),
  };
}

// ---------------------------------------------------------------------------
// Build + sign transaction
// ---------------------------------------------------------------------------

/**
 * Build and sign a V3 UTXO transaction.
 *
 * @param {Object} params
 * @param {string} params.from            - Sender zion1... address
 * @param {string} params.to              - Recipient zion1... address
 * @param {number} params.amountZion      - Amount in ZION (human units)
 * @param {number} [params.feeZion]       - Fee (auto = MIN_FEE_FLOWERS)
 * @param {Array}  params.utxos           - Available UTXOs from getUtxos RPC
 * @param {Buffer|Uint8Array} params.privateKey - 32-byte Ed25519 seed
 * @param {string} [params.memo]          - Optional UTF-8 memo
 * @returns {Promise<{ tx: Object, txHash: Buffer, feeUsed: number }>}
 */
export async function buildTransaction({
  from,
  to,
  amountZion,
  feeZion,
  utxos,
  privateKey,
  memo,
}) {
  if (!from || !to) throw new Error('from/to required');
  if (amountZion <= 0) throw new Error('Amount positive');

  const amountFlowers = BigInt(Math.round(amountZion * 1e6));
  const feeFlowers = feeZion
    ? BigInt(Math.round(feeZion * 1e6))
    : BigInt(MIN_FEE_FLOWERS);

  // Select UTXOs
  const { selected, totalIn, change } = selectUTXOs(utxos, amountFlowers, feeFlowers);

  // Build outputs
  const outputs = [{ address: to, amount: Number(amountFlowers) }];
  if (change > 0n) {
    outputs.push({ address: from, amount: Number(change) });
  }
  if (memo) {
    outputs[0].memo = memo;
  }

  // Derive public key
  const pkBytes = privateKey instanceof Uint8Array
    ? privateKey
    : Buffer.from(privateKey, 'hex');
  const pubKey = Buffer.from(await ed25519.getPublicKey(pkBytes));

  // Build inputs (signatures filled after hashing)
  const inputs = selected.map((utxo) => ({
    prev_tx_hash: Buffer.from(utxo.tx_hash || utxo.txid || '', 'hex'),
    output_index: utxo.output_index !== undefined ? utxo.output_index : (utxo.vout || 0),
    signature: new Array(64).fill(0),     // placeholder — filled after hash
    public_key: Array.from(pubKey),
  }));

  // Build tx with version 2
  const tx = {
    id: new Array(32).fill(0),
    version: 2,
    inputs,
    outputs,
    fee: Number(feeFlowers),
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Compute BLAKE3 hash
  const txHash = calculateTxHash(tx);
  tx.id = Array.from(txHash);

  // Sign each input with Ed25519
  for (const input of tx.inputs) {
    const sig = await ed25519.sign(txHash, pkBytes);
    input.signature = Array.from(sig);
  }

  return {
    tx,
    txHash,
    feeUsed: atomicToZion(feeFlowers),
  };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify a signed transaction.
 * @returns {Promise<boolean>}
 */
export async function verifyTransaction(signedTx) {
  try {
    const txHash = Buffer.from(calculateTxHash(signedTx));

    for (const input of signedTx.inputs) {
      if (!input.signature || !input.public_key) return false;
      const sig = Buffer.from(input.signature);
      const pub = Buffer.from(input.public_key || []);
      if (pub.length !== 32) return false;
      const valid = await ed25519.verify(sig, txHash, pub);
      if (!valid) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Convenience: one-shot build + sign
// ---------------------------------------------------------------------------

/**
 * Full send flow: select UTXOs → build → sign → return.
 *
 * @param {Object} params
 * @param {string} params.from
 * @param {string} params.to
 * @param {number} params.amountZion
 * @param {number} [params.feeZion]
 * @param {Array}  params.utxos
 * @param {Buffer} params.privateKey - 32-byte Ed25519 seed
 * @param {string} [params.memo]
 * @returns {Promise<{ tx: Object, txHash: Buffer, feeUsed: number }>}
 */
export async function createSignedTransaction({
  from,
  to,
  amountZion,
  feeZion,
  utxos,
  privateKey,
  memo,
}) {
  return buildTransaction({ from, to, amountZion, feeZion, utxos, privateKey, memo });
}
