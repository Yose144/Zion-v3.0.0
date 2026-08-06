// ZION V3 UTXO Transaction Builder — Desktop Agent
// Matches V31/L1/core/src/tx.rs + V31/L1/core/src/crypto.rs

const crypto = require('crypto');
let blake3Fn;
try {
  blake3Fn = require('@noble/hashes/blake3').blake3;
} catch {
  // Fallback: if @noble/hashes is not installed, use null and fail at build time
  blake3Fn = null;
}

/**
 * BLAKE3 hash (32 bytes). Matches V31/L1/core/src/crypto.rs blake3_hash().
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer} 32-byte hash
 */
function blake3Hash(data) {
  if (!blake3Fn) throw new Error('BLAKE3 not available — install @noble/hashes');
  return Buffer.from(blake3Fn(data));
}

/**
 * Compute the canonical SegWit-style transaction hash.
 * Matches V31/L1/core/src/tx.rs Transaction::calculate_hash_v2()
 * (active from genesis for TX_HASH_V2_VERSION = 2).
 *
 * v2 preimage (length-prefixed, domain-separated):
 *   DOMAIN = b"ZION_TX_V2\x00"
 *   version (u32 LE)
 *   fee (u64 LE)
 *   timestamp (u64 LE)
 *   inputs count (u32 LE)
 *   for each input:
 *     prev_tx_hash (32B)
 *     output_index (u32 LE)
 *     public_key len (u32 LE)
 *     public_key bytes
 *   outputs count (u32 LE)
 *   for each output:
 *     amount (u64 LE)
 *     address len (u32 LE)
 *     address bytes
 *     memo tag: 0 = absent, 1 = present
 *     if present: memo len (u32 LE) + memo bytes
 *
 * Signatures are excluded (SegWit-style immutable ID).
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

/**
 * Legacy v1 preimage kept only for reference/tests.
 * Do not use for new mainnet transactions — v2 is required from genesis.
 */
function calculateTxHashV1(tx) {
  const parts = [];
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(tx.version);
  parts.push(versionBuf);
  for (const input of tx.inputs) {
    parts.push(Buffer.from(input.prev_tx_hash));
    const idxBuf = Buffer.alloc(4);
    idxBuf.writeUInt32LE(input.output_index);
    parts.push(idxBuf);
    parts.push(Buffer.from(input.public_key));
  }
  for (const output of tx.outputs) {
    const amtBuf = Buffer.alloc(8);
    amtBuf.writeBigUInt64LE(BigInt(output.amount));
    parts.push(amtBuf);
    parts.push(Buffer.from(output.address, 'utf8'));
    if (output.memo) {
      parts.push(Buffer.from(output.memo, 'utf8'));
    }
  }
  const feeBuf = Buffer.alloc(8);
  feeBuf.writeBigUInt64LE(BigInt(tx.fee));
  parts.push(feeBuf);
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64LE(BigInt(tx.timestamp));
  parts.push(tsBuf);
  return blake3Hash(Buffer.concat(parts));
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

const FLOWERS_PER_ZION = 1_000_000n; // 1e6 (3.0.3 decimal fork)
const MIN_FEE_FLOWERS = 1n; // 1 flower minimum fee (L1 fee.rs MIN_TX_FEE=1, 3.0.3)

/**
 * Build a signed UTXO transaction for V3.
 *
 * @param {Object} opts
 * @param {string} opts.fromAddress - Sender zion1 address
 * @param {string} opts.toAddress - Recipient zion1 address
 * @param {number} opts.amountZion - Amount in ZION (float)
 * @param {Array} opts.utxos - Spendable UTXOs from getUtxos RPC [{tx_hash, output_index, amount, address, height}]
 * @param {Buffer} opts.privateKeyDer - DER-encoded PKCS8 Ed25519 private key
 * @param {string} [opts.memo] - Optional memo
 * @returns {Object} V3-compatible tx::Transaction for submitTransaction
 */
function buildUtxoTransaction({ fromAddress, toAddress, amountZion, utxos, privateKeyDer, memo }) {
  // Convert ZION to flowers with precise decimal handling
  const amountFlowers = BigInt(Math.floor(amountZion * 1e6));
  const feeFlowers = MIN_FEE_FLOWERS;
  const totalNeeded = amountFlowers + feeFlowers;

  // Sort UTXOs by amount descending for efficient selection
  const sortedUtxos = [...utxos]
    .filter(u => u.address === fromAddress && BigInt(u.amount) > 0n)
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)));

  // Simple greedy UTXO selection
  const selected = [];
  let inputSum = 0n;
  for (const utxo of sortedUtxos) {
    selected.push(utxo);
    inputSum += BigInt(utxo.amount);
    if (inputSum >= totalNeeded) break;
  }

  if (inputSum < totalNeeded) {
    const balanceZion = Number(inputSum) / 1e6;
    throw new Error(
      `Insufficient balance: need ${amountZion} + fee ZION, have ${balanceZion.toFixed(6)} ZION spendable`
    );
  }

  const change = inputSum - totalNeeded;
  const pubKeyRaw = extractPublicKey(privateKeyDer);

  // Build outputs
  const outputs = [
    {
      amount: Number(amountFlowers),
      address: toAddress,
      ...(memo ? { memo } : {})
    }
  ];

  // Change output (back to sender)
  if (change > 0n) {
    outputs.push({
      amount: Number(change),
      address: fromAddress
    });
  }

  // Build inputs (signatures empty initially — filled after hash computation)
  const inputs = selected.map(utxo => ({
    prev_tx_hash: hexToBytes(utxo.tx_hash),
    output_index: utxo.output_index,
    signature: new Uint8Array(64), // placeholder
    public_key: Array.from(pubKeyRaw)
  }));

  // Build transaction structure (v2 required from genesis for TX_HASH_V2)
  const tx = {
    id: new Uint8Array(32), // placeholder
    version: 2,
    inputs,
    outputs,
    fee: Number(feeFlowers),
    timestamp: Math.floor(Date.now() / 1000)
  };

  // Compute BLAKE3 hash (SegWit-style, excludes signatures)
  const txHash = calculateTxHash(tx);
  tx.id = Array.from(txHash);

  // Sign each input with the transaction hash
  for (const input of tx.inputs) {
    const sig = ed25519Sign(privateKeyDer, txHash);
    input.signature = Array.from(sig);
  }

  return tx;
}

/**
 * Convert hex string to byte array.
 * @param {string} hex
 * @returns {number[]}
 */
function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * Convert byte array to hex string.
 * @param {number[]|Uint8Array|Buffer} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

module.exports = {
  buildUtxoTransaction,
  calculateTxHash,
  blake3Hash,
  bytesToHex,
  hexToBytes,
  extractPublicKey,
  FLOWERS_PER_ZION,
  MIN_FEE_FLOWERS
};
