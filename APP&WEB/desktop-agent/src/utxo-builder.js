// ZION V3 UTXO Transaction Builder — Desktop Agent
// Matches V3/L1/core/src/tx.rs + V3/L1/core/src/crypto.rs

const crypto = require('crypto');
let blake3Fn;
try {
  blake3Fn = require('@noble/hashes/blake3').blake3;
} catch {
  // Fallback: if @noble/hashes is not installed, use null and fail at build time
  blake3Fn = null;
}

/**
 * BLAKE3 hash (32 bytes). Matches V3/L1/core/src/crypto.rs blake3_hash().
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer} 32-byte hash
 */
function blake3Hash(data) {
  if (!blake3Fn) throw new Error('BLAKE3 not available — install @noble/hashes');
  return Buffer.from(blake3Fn(data));
}

/**
 * Compute the canonical SegWit-style transaction hash.
 * Matches V3/L1/core/src/tx.rs Transaction::calculate_hash().
 *
 * Data layout:
 *   version (u32 LE)
 *   for each input: prev_tx_hash (32B) + output_index (u32 LE) + public_key (32B)
 *   for each output: amount (u64 LE) + address bytes + optional memo bytes
 *   fee (u64 LE)
 *   timestamp (u64 LE)
 *
 * Signatures are excluded (SegWit-style immutable ID).
 */
function calculateTxHash(tx) {
  const parts = [];

  // version: u32 LE
  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(tx.version);
  parts.push(versionBuf);

  // inputs (exclude signature — SegWit-style)
  for (const input of tx.inputs) {
    parts.push(Buffer.from(input.prev_tx_hash)); // 32 bytes
    const idxBuf = Buffer.alloc(4);
    idxBuf.writeUInt32LE(input.output_index);
    parts.push(idxBuf);
    parts.push(Buffer.from(input.public_key)); // 32 bytes
  }

  // outputs
  for (const output of tx.outputs) {
    const amtBuf = Buffer.alloc(8);
    amtBuf.writeBigUInt64LE(BigInt(output.amount));
    parts.push(amtBuf);
    parts.push(Buffer.from(output.address, 'utf8'));
    if (output.memo) {
      parts.push(Buffer.from(output.memo, 'utf8'));
    }
  }

  // fee: u64 LE
  const feeBuf = Buffer.alloc(8);
  feeBuf.writeBigUInt64LE(BigInt(tx.fee));
  parts.push(feeBuf);

  // timestamp: u64 LE
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

const FLOWERS_PER_ZION = 1_000_000_000_000n; // 1e12
const MIN_FEE_FLOWERS = 1_000_000n; // 0.000001 ZION minimum fee

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
  const amountFlowers = BigInt(Math.round(amountZion * 1e12));
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
    const balanceZion = Number(inputSum) / 1e12;
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

  // Build transaction structure
  const tx = {
    id: new Uint8Array(32), // placeholder
    version: 1,
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

/**
 * Build a signed account-model transaction for V3.
 * Matches V3/L1/core/src/bin/fund-bridge-vault.rs logic.
 *
 * @param {Object} opts
 * @param {string} opts.fromAddress - Sender zion1 address
 * @param {string} opts.toAddress - Recipient zion1 address
 * @param {number} opts.amountZion - Amount in ZION (float)
 * @param {Buffer} opts.privateKeyDer - DER-encoded PKCS8 Ed25519 private key
 * @param {number} [opts.nonce] - Transaction nonce (must be unique per sender)
 * @param {number} [opts.feeFlowers] - Fee in flowers (default MIN_FEE_FLOWERS)
 * @returns {Object} V3-compatible account Transaction for submitAccountTransaction
 */
function buildAccountTransaction({ fromAddress, toAddress, amountZion, privateKeyDer, nonce, feeFlowers }) {
  const amountFlowers = BigInt(Math.round(amountZion * 1e12));
  const fee = feeFlowers || Number(MIN_FEE_FLOWERS);
  const txNonce = typeof nonce === 'number' && nonce >= 0 ? BigInt(nonce) : BigInt(Math.floor(Date.now() / 1000));

  // Deterministic tx_id = hex(blake3_hash("account_tx:{from}:{to}:{amount}:{fee}:{nonce}"))
  const preimage = `account_tx:${fromAddress}:${toAddress}:${amountFlowers}:${fee}:${txNonce}`;
  const txIdBytes = blake3Hash(Buffer.from(preimage, 'utf8'));
  const txId = bytesToHex(txIdBytes);

  // Sign the hex string tx_id (as UTF-8 bytes) — matches verify_signature in core
  const sig = ed25519Sign(privateKeyDer, Buffer.from(txId, 'utf8'));
  const signature = bytesToHex(sig);

  const pubKeyRaw = extractPublicKey(privateKeyDer);
  const publicKey = bytesToHex(pubKeyRaw);

  return {
    tx_id: txId,
    from: fromAddress,
    to: toAddress,
    amount_zion: amountFlowers.toString(), // u128 serialized as string for JSON
    fee_zion: fee,
    nonce: Number(txNonce),
    signature,
    public_key: publicKey
  };
}

module.exports = {
  buildUtxoTransaction,
  buildAccountTransaction,
  calculateTxHash,
  blake3Hash,
  bytesToHex,
  hexToBytes,
  extractPublicKey,
  FLOWERS_PER_ZION,
  MIN_FEE_FLOWERS
};
