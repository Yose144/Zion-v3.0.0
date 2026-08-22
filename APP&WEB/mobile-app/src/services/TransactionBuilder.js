/**
 * ZION V31-native UTXO Transaction Builder — Mobile App
 *
 * Binary-compatible with V31/L1/core/src/transaction.rs + v31_wallet.rs.
 *
 * Native V31 Transaction:
 *   version: u32
 *   inputs:  [{ previous_output: [u8;32], index: u32, script: Vec<u8> }]
 *   outputs: [{ amount: u128 (string), address: { chain, bytes, encoded } }]
 *   memo:    Vec<u8>
 *
 * Transaction ID and signing message use Keccak-256.  The signing hash
 * leaves every input `script` empty so signatures are independent of txid.
 */

import {keccak_256} from '@noble/hashes/sha3';
import * as ed25519 from '@noble/ed25519';
import {sha512} from '@noble/hashes/sha512';
import {Buffer} from 'buffer';
import {
  ATOMIC_UNITS_PER_ZION,
  zionToAtomic,
  atomicToZion,
  MIN_FEE_FLOWERS,
} from '../constants/blockchain';

// Wire up @noble/ed25519 v3 synchronous SHA-512
ed25519.hashes.sha512 = sha512;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => (b & 0xff).toString(16).padStart(2, '0'))
    .join('');
}

function uint32LE(value) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return Array.from(buf);
}

function uint128LE(value) {
  const v = BigInt(value);
  const buf = Buffer.allocUnsafe(16);
  const mask = 0xFFFFFFFFFFFFFFFFn;
  buf.writeBigUInt64LE(v & mask, 0);
  buf.writeBigUInt64LE((v >> 64n) & mask, 8);
  return Array.from(buf);
}

function concatBuffers(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p instanceof Uint8Array ? p : Buffer.from(p), offset);
    offset += p.length;
  }
  return out;
}

function keccak256Hash(data) {
  return Buffer.from(keccak_256(Buffer.from(data)));
}

function makeAddressObject(encoded) {
  return {
    chain: 'zion_l1',
    bytes: [],
    encoded,
  };
}

// ---------------------------------------------------------------------------
// Fee estimation
// ---------------------------------------------------------------------------

/**
 * Estimate transaction size and fee.
 * Keeps the legacy mobile heuristic for UI compatibility.
 */
export function estimateTransactionFee(inputCount, outputCount = 2) {
  const bytes = inputCount * 250 + outputCount * 34 + 10;
  const feeAtomic = bytes;
  return {
    bytes,
    feeAtomic,
    feeZion: atomicToZion(feeAtomic),
  };
}

function estimateTxSize(numInputs, numOutputs) {
  // Matches V31/L1/core/src/fee.rs estimate_tx_size()
  return 52 + numInputs * 132 + numOutputs * 60;
}

function minimumFeeForSize(txSize) {
  const rateBased = BigInt(txSize);
  return rateBased > MIN_FEE_FLOWERS ? rateBased : MIN_FEE_FLOWERS;
}

// ---------------------------------------------------------------------------
// UTXO selection
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
    (a, b) => Number(BigInt(b.amount) - BigInt(a.amount)),
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
      `Insufficient funds. Need ${atomicToZion(needed)} ZION but only ${atomicToZion(totalIn)} ZION available.`,
    );
  }

  const change = totalIn - needed;
  return {selected, totalIn: Number(totalIn), change: Number(change)};
}

// ---------------------------------------------------------------------------
// Transaction preimage / hash
// ---------------------------------------------------------------------------

function buildPreimage(tx, scripts) {
  const parts = [];

  // version: u32 LE
  parts.push(Buffer.from(uint32LE(tx.version)));

  // inputs
  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i];
    parts.push(Buffer.from(input.previous_output));
    parts.push(Buffer.from(uint32LE(input.index)));
    parts.push(scripts[i] || Buffer.alloc(0));
  }

  // outputs
  for (const output of tx.outputs) {
    parts.push(Buffer.from(uint128LE(BigInt(output.amount))));
    parts.push(Buffer.from(output.address.encoded, 'utf8'));
  }

  // memo
  parts.push(Buffer.from(tx.memo));

  return concatBuffers(parts);
}

/**
 * Compute native V31 transaction hash (txid) — scripts included.
 */
export function transactionHash(tx) {
  const scripts = tx.inputs.map((input) => Buffer.from(input.script));
  return keccak256Hash(buildPreimage(tx, scripts));
}

function signingHash(tx) {
  const scripts = tx.inputs.map(() => Buffer.alloc(0));
  return keccak256Hash(buildPreimage(tx, scripts));
}

// ---------------------------------------------------------------------------
// Build unsigned transaction
// ---------------------------------------------------------------------------

/**
 * Build a V31-native UTXO transaction (unsigned).
 *
 * @param {Object} params
 * @param {string} params.from - Sender zion1 address
 * @param {string} params.to - Recipient zion1 address
 * @param {number} params.amountZion - Amount in ZION
 * @param {number} [params.feeZion] - Optional fee in ZION
 * @param {Array}  params.utxos - Available UTXOs
 * @param {string} [params.memo] - Optional ASCII memo
 * @returns {{tx: Object, feeUsed: number}}
 */
export function buildTransaction({
  from,
  to,
  amountZion,
  feeZion,
  utxos,
  memo,
}) {
  if (!from || !to) throw new Error('from/to required');
  if (amountZion <= 0) throw new Error('Amount must be positive');

  const amountFlowers = BigInt(zionToAtomic(amountZion));

  // Default fee: dynamic per estimated serialized size, capped at MIN_FEE_FLOWERS
  let feeFlowers;
  if (feeZion) {
    feeFlowers = BigInt(zionToAtomic(feeZion));
  } else {
    const estimated = estimateTransactionFee(utxos?.length || 1, 2).feeAtomic;
    feeFlowers = minimumFeeForSize(estimated);
  }

  const {selected, totalIn, change} = selectUTXOs(utxos, amountFlowers, feeFlowers);

  // Build outputs
  const outputs = [
    {
      amount: amountFlowers.toString(),
      address: makeAddressObject(to),
    },
  ];
  if (change > 0) {
    outputs.push({
      amount: BigInt(change).toString(),
      address: makeAddressObject(from),
    });
  } else {
    // No change output — fee is whatever remains (still >= min for 1 output)
    feeFlowers = BigInt(totalIn) - amountFlowers;
  }

  // Build inputs (scripts empty initially — filled by signTransaction)
  const inputs = selected.map((utxo) => ({
    previous_output: hexToBytes(utxo.tx_hash || utxo.txid || ''),
    index: utxo.output_index !== undefined ? utxo.output_index : (utxo.vout || 0),
    script: [],
  }));

  const memoBytes = memo ? Array.from(Buffer.from(memo, 'utf8')) : [];

  const tx = {
    version: 1,
    inputs,
    outputs,
    memo: memoBytes,
  };

  return {tx, feeUsed: atomicToZion(Number(feeFlowers))};
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Sign a V31-native UTXO transaction.
 *
 * @param {Object} tx - Transaction from buildTransaction()
 * @param {Buffer|Uint8Array} privateKey - 32-byte Ed25519 seed
 * @returns {Object} Signed transaction with `tx_id` field added
 */
export async function signTransaction(tx, privateKey) {
  const pk =
    privateKey instanceof Uint8Array
      ? privateKey
      : Buffer.from(privateKey, 'hex');
  if (pk.length !== 32) throw new Error('Ed25519 private key must be 32 bytes');

  const publicKey = await ed25519.getPublicKey(pk);

  const msg = signingHash(tx);
  const signature = await ed25519.sign(msg, pk);
  const script = Array.from(Buffer.concat([signature, publicKey]));

  for (const input of tx.inputs) {
    input.script = script;
  }

  const txHash = transactionHash(tx);
  tx.tx_id = txHash.toString('hex');

  return tx;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify a signed V31-native transaction.
 * @returns {Promise<boolean>}
 */
export async function verifyTransaction(signedTx) {
  try {
    const msg = signingHash(signedTx);

    for (const input of signedTx.inputs) {
      if (!input.script || input.script.length !== 96) return false;
      const script = Buffer.from(input.script);
      const sig = script.slice(0, 64);
      const pub = script.slice(64, 96);
      const valid = await ed25519.verify(sig, msg, pub);
      if (!valid) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a transaction to a JSON string for broadcast.
 */
export function serializeTransaction(tx) {
  return JSON.stringify(tx);
}

// ---------------------------------------------------------------------------
// One-shot build + sign
// ---------------------------------------------------------------------------

/**
 * Full send flow: select UTXOs → build → sign → return.
 *
 * @param {Object} params
 * @returns {Promise<{tx: Object, txHash: string, feeUsed: number, hex: string}>}
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
  const {tx, feeUsed} = buildTransaction({
    from,
    to,
    amountZion,
    feeZion,
    utxos,
    memo,
  });
  const signedTx = await signTransaction(tx, privateKey);
  const txHash = signedTx.tx_id;
  const hex = serializeTransaction(signedTx);
  return {tx: signedTx, txHash, feeUsed, hex};
}
