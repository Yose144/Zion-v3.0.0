// ZION V31-native UTXO Transaction Builder — Desktop Agent
// Matches V31/L1/core/src/transaction.rs + V31/L1/core/src/v31_wallet.rs
//
// Native V31 Transaction:
//   version: u32
//   inputs:  [{ previous_output: [u8;32], index: u32, script: Vec<u8> }]
//   outputs: [{ amount: u128 (string), address: { chain, bytes, encoded } }]
//   memo:    Vec<u8>
//
// Hash (transaction ID) and signing message both use Keccak-256 over the
// same binary preimage:
//   version (u32 LE)
//   for each input:
//     previous_output (32 bytes)
//     index (u32 LE)
//     script (full script for tx.hash, empty script for signing_hash)
//   for each output:
//     amount (u128 LE)
//     address.encoded (UTF-8 bytes, no length prefix)
//   memo (raw bytes)

const crypto = require('crypto');

let keccak256;
try {
  keccak256 = require('@noble/hashes/sha3').keccak_256;
} catch {
  // Fallback: if @noble/hashes is missing, fail at build time
  keccak256 = null;
}

let blake3Fn;
try {
  blake3Fn = require('@noble/hashes/blake3').blake3;
} catch {
  blake3Fn = null;
}

const FLOWERS_PER_ZION = 1_000_000n; // 1e6 (3.0.3 decimal fork)
const MIN_TX_FEE_FLOWERS = 1n;       // L1 fee.rs MIN_TX_FEE

// ── Consensus tx-size budget (mirrors V31/L1/core fee.rs + v31_wallet.rs) ──
// The node rejects transactions whose JSON serialization exceeds 100 KB
// (`Node::validate_tx_size`, `fee::MAX_TX_SIZE`). A signed input costs
// ~560 JSON bytes (32B prev-hash array + 96B sig‖pk script array), so the
// binding cap is ~177 inputs — far below the structural MAX_TX_INPUTS=1000.
const MAX_TX_JSON_BYTES = 100_000;
const MAX_TX_INPUTS_CONSENSUS = 1_000;
const JSON_BYTES_PER_INPUT = 560;
const JSON_BYTES_PER_OUTPUT = 220;
const JSON_BYTES_PER_MEMO_BYTE = 4;
const JSON_BASE_BYTES = 300;

/**
 * Maximum inputs whose signed JSON encoding fits under the node's 100 KB
 * transaction budget. Mirrors `v31_wallet::max_tx_inputs_for`.
 */
function maxTxInputs(numOutputs, memoLen) {
  const reserved = JSON_BASE_BYTES + numOutputs * JSON_BYTES_PER_OUTPUT + memoLen * JSON_BYTES_PER_MEMO_BYTE;
  return Math.min(
    Math.floor((MAX_TX_JSON_BYTES - reserved) / JSON_BYTES_PER_INPUT),
    MAX_TX_INPUTS_CONSENSUS
  );
}

/**
 * Keccak-256 hash (32 bytes). Matches V31/L1/core transaction hashing.
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer} 32-byte hash
 */
function keccak256Hash(data) {
  if (!keccak256) throw new Error('Keccak-256 not available — install @noble/hashes');
  return Buffer.from(keccak256(data));
}

/**
 * BLAKE3 hash (32 bytes). Kept for backwards compatibility / reference.
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer} 32-byte hash
 */
function blake3Hash(data) {
  if (!blake3Fn) throw new Error('BLAKE3 not available — install @noble/hashes');
  return Buffer.from(blake3Fn(data));
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

function uint32LE(value) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return buf;
}

function uint64LE(value) {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(BigInt(value), 0);
  return buf;
}

function uint128LE(value) {
  const v = BigInt(value);
  const buf = Buffer.allocUnsafe(16);
  const mask = 0xFFFFFFFFFFFFFFFFn;
  buf.writeBigUInt64LE(v & mask, 0);
  buf.writeBigUInt64LE((v >> 64n) & mask, 8);
  return buf;
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

/**
 * Estimate serialized transaction size in bytes.
 * Mirrors V31/L1/core/src/fee.rs estimate_tx_size().
 */
function estimateTxSize(numInputs, numOutputs) {
  return 52 + numInputs * 132 + numOutputs * 60;
}

/**
 * Minimum required fee for a transaction of the given size.
 * Mirrors V31/L1/core/src/fee.rs minimum_fee_for_size().
 */
function minimumFeeForSize(txSize) {
  const rateBased = BigInt(txSize);
  return rateBased > MIN_TX_FEE_FLOWERS ? rateBased : MIN_TX_FEE_FLOWERS;
}

/**
 * Build the binary Keccak-256 preimage for a native V31 transaction.
 * @param {Object} tx
 * @param {Array<Buffer>} scripts - one per input; use empty Buffer for signing hash
 * @returns {Buffer}
 */
function buildPreimage(tx, scripts) {
  const parts = [];

  // version: u32 LE
  parts.push(uint32LE(tx.version));

  // inputs
  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i];
    parts.push(Buffer.from(input.previous_output));
    parts.push(uint32LE(input.index));
    parts.push(scripts[i] || Buffer.alloc(0));
  }

  // outputs
  for (const output of tx.outputs) {
    parts.push(uint128LE(output.amount));
    parts.push(Buffer.from(output.address.encoded, 'utf8'));
    // Output script (empty for standard pay-to-pubkey-hash; non-empty for scripts)
    parts.push(Buffer.from(output.script || []));
  }

  // memo
  parts.push(Buffer.from(tx.memo));

  return concatBuffers(parts);
}

/**
 * Compute the native V31 transaction hash (txid).
 * Uses full input scripts.
 */
function calculateTxHash(tx) {
  const scripts = tx.inputs.map((input) => Buffer.from(input.script));
  return keccak256Hash(buildPreimage(tx, scripts));
}

/**
 * Compute the native V31 signing hash.
 * Uses empty input scripts.
 */
function calculateSigningHash(tx) {
  const scripts = tx.inputs.map(() => Buffer.alloc(0));
  return keccak256Hash(buildPreimage(tx, scripts));
}

/**
 * Sign a message with an Ed25519 private key (DER PKCS8 format).
 * @param {Buffer} privateKeyDer - DER-encoded PKCS8 Ed25519 private key
 * @param {Buffer} message - 32-byte message to sign
 * @returns {Buffer} 64-byte Ed25519 signature
 */
function ed25519Sign(privateKeyDer, message) {
  const keyObject = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8'
  });
  return crypto.sign(null, message, keyObject);
}

/**
 * Extract raw 32-byte public key from DER PKCS8 private key.
 * @param {Buffer} privateKeyDer
 * @returns {Buffer} 32-byte raw Ed25519 public key
 */
function extractPublicKey(privateKeyDer) {
  const keyObject = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8'
  });
  const pubKeyObject = crypto.createPublicKey(keyObject);
  const pubKeyDer = pubKeyObject.export({ type: 'spki', format: 'der' });
  // Raw Ed25519 pubkey is the last 32 bytes of DER SPKI encoding
  return pubKeyDer.slice(-32);
}

function makeAddressObject(encoded) {
  return {
    chain: 'zion_l1',
    bytes: [],
    encoded
  };
}

/**
 * Build a signed V31-native UTXO transaction.
 *
 * @param {Object} opts
 * @param {string} opts.fromAddress - Sender zion1 address
 * @param {string} opts.toAddress - Recipient zion1 address
 * @param {number} opts.amountZion - Amount in ZION (float)
 * @param {Array} opts.utxos - Spendable UTXOs from getUtxos RPC [{tx_hash, output_index, amount, address, height}]
 * @param {Buffer} opts.privateKeyDer - DER-encoded PKCS8 Ed25519 private key
 * @param {string} [opts.memo] - Optional memo (UTF-8)
 * @returns {{tx_id: string, transaction: Object}} V31-native Transaction JSON + hex txid
 */
function buildUtxoTransaction({
  fromAddress,
  toAddress,
  amountZion,
  utxos,
  privateKeyDer,
  memo
}) {
  if (!fromAddress || !toAddress) throw new Error('fromAddress and toAddress are required');
  if (amountZion <= 0) throw new Error('Amount must be positive');
  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('No UTXOs provided');

  const amountFlowers = BigInt(Math.floor(amountZion * 1e6));
  const pubKeyRaw = extractPublicKey(privateKeyDer);

  // Sort UTXOs by amount descending for efficient selection
  const sortedUtxos = [...utxos]
    .filter((u) => String(u.address || '') === fromAddress && BigInt(u.amount) > 0n)
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)));

  if (sortedUtxos.length === 0) {
    throw new Error('No spendable UTXOs for the sender address');
  }

  // Greedy largest-first selection with dynamic fee, capped by the node's
  // 100 KB JSON tx budget (~177 signed inputs). Mirrors
  // `v31_wallet::select_utxos` — hitting the cap before target yields a
  // fragmentation error, not an oversized transaction the node would reject.
  const memoBuf = memo ? Buffer.from(memo, 'utf8') : Buffer.alloc(0);
  const numOutputs = 2; // assume change output initially
  const inputCap = Math.max(1, maxTxInputs(numOutputs, memoBuf.length));

  const selected = [];
  let inputSum = 0n;
  let feeFlowers = 0n;
  let changeFlowers = 0n;

  for (const utxo of sortedUtxos) {
    if (selected.length >= inputCap) {
      const coveredZion = (Number(inputSum) / 1e6).toFixed(6);
      throw new Error(
        `UTXO set too fragmented: the largest ${inputCap} inputs cover only ${coveredZion} of ${amountZion} + fee ZION — consolidate the wallet UTXOs first`
      );
    }
    selected.push(utxo);
    inputSum += BigInt(utxo.amount);

    feeFlowers = minimumFeeForSize(estimateTxSize(selected.length, numOutputs));
    changeFlowers = inputSum - amountFlowers - feeFlowers;

    if (inputSum >= amountFlowers + feeFlowers) {
      break;
    }
  }

  if (inputSum < amountFlowers + feeFlowers) {
    const balanceZion = Number(inputSum) / 1e6;
    throw new Error(
      `Insufficient balance: need ${amountZion} + fee ZION, have ${balanceZion.toFixed(6)} ZION spendable`
    );
  }

  // Build outputs (script: [] = standard pay-to-pubkey-hash, matches V31 core)
  const outputs = [
    {
      amount: amountFlowers.toString(),
      address: makeAddressObject(toAddress),
      script: []
    }
  ];

  if (changeFlowers > 0n) {
    outputs.push({
      amount: changeFlowers.toString(),
      address: makeAddressObject(fromAddress),
      script: []
    });
  } else {
    // No change output — fee is whatever remains (still >= min for 1 output)
    feeFlowers = inputSum - amountFlowers;
  }

  // Build inputs (scripts empty initially — filled after signing hash)
  const inputs = selected.map((utxo) => ({
    previous_output: hexToBytes(utxo.tx_hash),
    index: utxo.output_index,
    script: []
  }));

  // Native V31 transaction structure
  const tx = {
    version: 1,
    inputs,
    outputs,
    memo: Array.from(memoBuf)
  };

  // Compute signing hash (scripts excluded), sign it, then fill scripts
  const signingHash = calculateSigningHash(tx);
  const signature = ed25519Sign(privateKeyDer, signingHash);
  const script = Array.from(Buffer.concat([signature, pubKeyRaw]));

  for (const input of tx.inputs) {
    input.script = script;
  }

  // Compute transaction hash (txid) with scripts included
  const txHash = calculateTxHash(tx);

  return {
    tx_id: bytesToHex(txHash),
    transaction: tx
  };
}

/**
 * Build a signed consolidation transaction: spend the `inputCap` largest
 * UTXOs into ONE output back to the sender (amount = sum - fee).
 *
 * Mirrors the Rust `zion wallet consolidate` round
 * (`v31_wallet::plan_consolidation` + `build_send_with_memo` to self):
 * merging the top of the set produces the biggest possible merged output
 * per round, which unblocks large sends in the fewest transactions.
 *
 * @param {Object} opts
 * @param {string} opts.fromAddress - Sender zion1 address (also recipient)
 * @param {Array} opts.utxos - Spendable UTXOs [{tx_hash, output_index, amount, address}]
 * @param {Buffer} opts.privateKeyDer - DER-encoded PKCS8 Ed25519 private key
 * @param {string} [opts.memo] - Optional memo (UTF-8); CLI uses "CONSOLIDATE"
 * @returns {{tx_id: string, transaction: Object, fee_flowers: string, input_count: number, output_amount: string}}
 */
function buildUtxoSelfSpend({ fromAddress, utxos, privateKeyDer, memo }) {
  if (!fromAddress) throw new Error('fromAddress is required');
  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('No UTXOs provided');

  const memoBuf = memo ? Buffer.from(memo, 'utf8') : Buffer.alloc(0);
  const inputCap = Math.max(2, maxTxInputs(1, memoBuf.length));

  const sortedUtxos = [...utxos]
    .filter((u) => String(u.address || '') === fromAddress && BigInt(u.amount) > 0n)
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)));

  const selected = sortedUtxos.slice(0, inputCap);
  if (selected.length < 2) {
    throw new Error('Need at least 2 UTXOs to consolidate');
  }

  let inputSum = 0n;
  for (const utxo of selected) inputSum += BigInt(utxo.amount);

  // Price the fee against the 2-output bound (a change output is possible in
  // the generic builder) — same conservative bound the Rust consolidate CLI
  // uses, so the fee always clears the node's 1-output minimum.
  const feeFlowers = minimumFeeForSize(estimateTxSize(selected.length, 2));
  const outputAmount = inputSum - feeFlowers;
  if (outputAmount <= 0n) {
    throw new Error(
      `Consolidation batch of ${selected.length} UTXOs totals ${(Number(inputSum) / 1e6).toFixed(6)} ZION — below the ${feeFlowers} flower fee`
    );
  }

  const pubKeyRaw = extractPublicKey(privateKeyDer);
  const inputs = selected.map((utxo) => ({
    previous_output: hexToBytes(utxo.tx_hash),
    index: utxo.output_index,
    script: []
  }));

  const tx = {
    version: 1,
    inputs,
    outputs: [
      {
        amount: outputAmount.toString(),
        address: makeAddressObject(fromAddress),
        script: []
      }
    ],
    memo: Array.from(memoBuf)
  };

  const signingHash = calculateSigningHash(tx);
  const signature = ed25519Sign(privateKeyDer, signingHash);
  const script = Array.from(Buffer.concat([signature, pubKeyRaw]));

  for (const input of tx.inputs) {
    input.script = script;
  }

  const txHash = calculateTxHash(tx);

  return {
    tx_id: bytesToHex(txHash),
    transaction: tx,
    fee_flowers: feeFlowers.toString(),
    input_count: selected.length,
    output_amount: outputAmount.toString()
  };
}

module.exports = {
  buildUtxoTransaction,
  buildUtxoSelfSpend,
  calculateTxHash,
  calculateSigningHash,
  blake3Hash,
  keccak256Hash,
  bytesToHex,
  hexToBytes,
  extractPublicKey,
  estimateTxSize,
  minimumFeeForSize,
  maxTxInputs,
  FLOWERS_PER_ZION,
  MIN_TX_FEE_FLOWERS
};
