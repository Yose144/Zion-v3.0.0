/**
 * ZION UTXO Transaction Builder v3.0.0
 *
 * Client-side UTXO selection and transaction construction
 * compatible with the Rust core (core/src/tx.rs).
 *
 * Transaction format:
 * {
 *   version: 1,
 *   inputs: [{ txid, vout, signature, public_key }],
 *   outputs: [{ address, amount }],   // amount in atomic units
 * }
 *
 * Serialisation: canonical JSON → SHA256 → Ed25519 sign per input.
 * Broadcast: hex-encoded JSON via RPC `sendrawtransaction`.
 */

import CryptoJS from 'crypto-js';
import * as ed25519 from '@noble/ed25519';
import { Buffer } from 'buffer';
import {
  ATOMIC_UNITS_PER_ZION,
  zionToAtomic,
  atomicToZion,
  MIN_FEE_PER_BYTE,
} from '../constants/blockchain';

// ---------------------------------------------------------------------------
// UTXO Selection (largest-first greedy)
// ---------------------------------------------------------------------------

/**
 * Select UTXOs that cover `targetAtomic + feeAtomic`.
 *
 * @param {Array<{txid:string, vout:number, amount:number}>} utxos
 *   Available UTXOs (amount in **atomic** units).
 * @param {number} targetAtomic - Amount to send (atomic).
 * @param {number} feeAtomic   - Fee (atomic).
 * @returns {{ selected: Array, totalIn: number, change: number }}
 */
export function selectUTXOs(utxos, targetAtomic, feeAtomic) {
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs available');
  }

  const needed = targetAtomic + feeAtomic;
  // Sort descending by amount (largest-first)
  const sorted = [...utxos].sort((a, b) => b.amount - a.amount);

  const selected = [];
  let totalIn = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalIn += utxo.amount;
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
// Estimate fee based on input/output count
// ---------------------------------------------------------------------------

/**
 * Estimate transaction size and fee.
 * Heuristic: ~250 bytes per input, ~34 bytes per output, 10 bytes overhead.
 *
 * @param {number} inputCount
 * @param {number} outputCount
 * @returns {{ bytes: number, feeAtomic: number, feeZion: number }}
 */
export function estimateTransactionFee(inputCount, outputCount = 2) {
  const bytes = inputCount * 250 + outputCount * 34 + 10;
  const feeAtomic = bytes * MIN_FEE_PER_BYTE;
  return {
    bytes,
    feeAtomic,
    feeZion: atomicToZion(feeAtomic),
  };
}

// ---------------------------------------------------------------------------
// Build unsigned transaction
// ---------------------------------------------------------------------------

/**
 * Build an unsigned ZION transaction.
 *
 * @param {Object} params
 * @param {string} params.from            - Sender address
 * @param {string} params.to              - Recipient address
 * @param {number} params.amountZion      - Amount to send (ZION, human units)
 * @param {number} [params.feeZion]       - Fee (ZION). Auto-estimated if omitted.
 * @param {Array}  params.utxos           - Available UTXOs (amount in atomic)
 * @returns {{ tx: Object, feeUsed: number }}
 */
export function buildTransaction({ from, to, amountZion, feeZion, utxos }) {
  if (!from || !to) throw new Error('From and to addresses required');
  if (amountZion <= 0) throw new Error('Amount must be positive');

  const amountAtomic = zionToAtomic(amountZion);

  // Estimate fee if not provided
  let feeAtomic;
  if (feeZion !== undefined && feeZion !== null) {
    feeAtomic = zionToAtomic(feeZion);
  } else {
    // First pass estimate (assume 1 input, 2 outputs)
    feeAtomic = estimateTransactionFee(1, 2).feeAtomic;
  }

  // Select UTXOs
  const { selected, change } = selectUTXOs(utxos, amountAtomic, feeAtomic);

  // Re-estimate fee with actual input count
  if (feeZion === undefined || feeZion === null) {
    const outputCount = change > 0 ? 2 : 1;
    const reEstimate = estimateTransactionFee(selected.length, outputCount);
    feeAtomic = reEstimate.feeAtomic;

    // Re-select with updated fee
    const reSelect = selectUTXOs(utxos, amountAtomic, feeAtomic);
    selected.length = 0;
    reSelect.selected.forEach(u => selected.push(u));
    const newChange = reSelect.totalIn - amountAtomic - feeAtomic;

    // Build outputs
    const outputs = [{ address: to, amount: amountAtomic }];
    if (newChange > 0) {
      outputs.push({ address: from, amount: newChange });
    }

    const tx = {
      version: 1,
      inputs: selected.map(u => ({
        txid: u.txid,
        vout: u.vout,
        signature: null,     // filled by signTransaction
        public_key: null,    // filled by signTransaction
      })),
      outputs,
    };

    return { tx, feeUsed: atomicToZion(feeAtomic) };
  }

  // Build outputs with provided fee
  const outputs = [{ address: to, amount: amountAtomic }];
  if (change > 0) {
    outputs.push({ address: from, amount: change });
  }

  const tx = {
    version: 1,
    inputs: selected.map(u => ({
      txid: u.txid,
      vout: u.vout,
      signature: null,
      public_key: null,
    })),
    outputs,
  };

  return { tx, feeUsed: atomicToZion(feeAtomic) };
}

// ---------------------------------------------------------------------------
// Transaction signing
// ---------------------------------------------------------------------------

/**
 * Compute the signing hash of a transaction.
 * Canonical JSON of { version, inputs (without sig), outputs }.
 *
 * @param {Object} tx - Transaction object
 * @returns {Uint8Array} SHA-256 hash (32 bytes)
 */
export function transactionHash(tx) {
  // Strip signatures for hashing
  const forHash = {
    version: tx.version,
    inputs: tx.inputs.map(i => ({ txid: i.txid, vout: i.vout })),
    outputs: tx.outputs.map(o => ({ address: o.address, amount: o.amount })),
  };

  const json = JSON.stringify(forHash, Object.keys(forHash).sort());
  const hashHex = CryptoJS.SHA256(json).toString();
  return Buffer.from(hashHex, 'hex');
}

/**
 * Sign a transaction with Ed25519.
 * Signs each input with the same private key (single-owner wallet).
 *
 * @param {Object} tx          - Unsigned transaction from buildTransaction()
 * @param {Buffer} privateKey  - 32-byte Ed25519 private key
 * @returns {Promise<Object>}  - Signed transaction (signature + public_key filled)
 */
export async function signTransaction(tx, privateKey) {
  const txHash = transactionHash(tx);
  const pubKey = await ed25519.getPublicKey(privateKey);
  const signature = await ed25519.sign(txHash, privateKey);

  const signedTx = {
    ...tx,
    inputs: tx.inputs.map(input => ({
      ...input,
      signature: Buffer.from(signature).toString('hex'),
      public_key: Buffer.from(pubKey).toString('hex'),
    })),
  };

  return signedTx;
}

/**
 * Verify a signed transaction.
 *
 * @param {Object} signedTx - Signed transaction
 * @returns {Promise<boolean>}
 */
export async function verifyTransaction(signedTx) {
  try {
    const txHash = transactionHash(signedTx);

    for (const input of signedTx.inputs) {
      if (!input.signature || !input.public_key) return false;

      const sig = Buffer.from(input.signature, 'hex');
      const pub = Buffer.from(input.public_key, 'hex');
      const valid = await ed25519.verify(sig, txHash, pub);
      if (!valid) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Serialize a signed transaction to hex for broadcast.
 *
 * @param {Object} signedTx
 * @returns {string} Hex-encoded JSON
 */
export function serializeTransaction(signedTx) {
  const json = JSON.stringify(signedTx);
  return Buffer.from(json, 'utf-8').toString('hex');
}

// ---------------------------------------------------------------------------
// Convenience: build + sign + serialize in one call
// ---------------------------------------------------------------------------

/**
 * Full send flow: select UTXOs → build → sign → serialize.
 *
 * @param {Object} params
 * @param {string} params.from
 * @param {string} params.to
 * @param {number} params.amountZion
 * @param {number} [params.feeZion]
 * @param {Array}  params.utxos
 * @param {Buffer} params.privateKey - Decrypted 32-byte Ed25519 key
 * @returns {Promise<{ hex: string, txHash: string, feeUsed: number }>}
 */
export async function createSignedTransaction({ from, to, amountZion, feeZion, utxos, privateKey }) {
  const { tx, feeUsed } = buildTransaction({ from, to, amountZion, feeZion, utxos });
  const signedTx = await signTransaction(tx, privateKey);
  const hex = serializeTransaction(signedTx);
  const hash = Buffer.from(transactionHash(signedTx)).toString('hex');

  return { hex, txHash: hash, feeUsed, tx: signedTx };
}
