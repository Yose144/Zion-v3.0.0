// ZION V3 Account-Model Transaction Builder — Desktop Agent
// Matches V3/L1/core/src/wallet.rs build_and_sign_account + lib.rs Transaction struct
//
// Account model is used for premine wallets (Humanitarian, ISSOBELLA, DAO treasury etc.)
// that have balance in the account ledger (not UTXO). No coinbase maturity needed —
// transactions are confirmed in the next block.

const crypto = require('crypto');

const FLOWERS_PER_ZION_BIGINT = 1_000_000n; // 1 ZION = 1e6 flowers (3.0.3 decimal fork)
const DEFAULT_FEE_FLOWERS = 1n; // Minimum fee (matches V3 fee::MIN_TX_FEE=1, 3.0.3)

/**
 * Sign a message with an Ed25519 private key (DER PKCS8 format).
 * @param {Buffer} privateKeyDer
 * @param {Buffer} message
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
  return pubKeyDer.slice(-32);
}

/**
 * Convert byte array to hex string.
 * @param {Buffer|Uint8Array|number[]} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a deterministic tx_id for an account transaction.
 * Matches V3/L1/core/src/wallet.rs generate_account_tx_id.
 *
 * Layout:
 *   bytes[0..16]   = timestamp nanos (LE)
 *   bytes[16..24]  = amount (u64 LE)
 *   bytes[24..32]  = nonce (u64 LE)
 *   XOR from + to address bytes cyclically into all 32 bytes
 *
 * @param {string} from - Sender zion1 address
 * @param {string} to - Recipient zion1 address
 * @param {bigint} amount - Amount in flowers
 * @param {bigint} nonce - Unique nonce per sender
 * @returns {string} 64-char hex tx_id
 */
function generateAccountTxId(from, to, amount, nonce) {
  const bytes = Buffer.alloc(32);

  // Timestamp nanos (16 bytes)
  const tsNanos = BigInt(Date.now()) * 1_000_000n;
  // Write as two u64 LE (low + high)
  bytes.writeBigUInt64LE(tsNanos & 0xFFFFFFFFFFFFFFFFn, 0);
  bytes.writeBigUInt64LE((tsNanos >> 64n) & 0xFFFFFFFFFFFFFFFFn, 8);

  // Amount (8 bytes LE)
  bytes.writeBigUInt64LE(amount & 0xFFFFFFFFFFFFFFFFn, 16);

  // Nonce (8 bytes LE)
  bytes.writeBigUInt64LE(nonce & 0xFFFFFFFFFFFFFFFFn, 24);

  // XOR-in sender and recipient address bytes cyclically
  const fromBytes = Buffer.from(from, 'utf8');
  const toBytes = Buffer.from(to, 'utf8');
  const allAddrBytes = Buffer.concat([fromBytes, toBytes]);
  for (let i = 0; i < allAddrBytes.length; i++) {
    bytes[i % 32] ^= allAddrBytes[i];
  }

  return bytesToHex(bytes);
}

/**
 * Build and sign an account-model transaction.
 *
 * @param {Object} opts
 * @param {string} opts.fromAddress - Sender zion1 address
 * @param {string} opts.toAddress - Recipient zion1 address
 * @param {number|string|bigint} opts.amountZion - Amount in ZION (float or string or bigint flowers)
 * @param {bigint} [opts.nonce] - Unique nonce (default: timestamp nanos)
 * @param {bigint} [opts.fee] - Fee in flowers (default: 1000)
 * @param {Buffer} opts.privateKeyDer - DER-encoded PKCS8 Ed25519 private key
 * @returns {Object} V3-compatible Transaction for submitAccountTransaction / submitTransaction
 */
function buildAccountTransaction({ fromAddress, toAddress, amountZion, nonce, fee, privateKeyDer }) {
  // Parse amount
  let amountFlowers;
  if (typeof amountZion === 'bigint') {
    amountFlowers = amountZion;
  } else if (typeof amountZion === 'string') {
    // String could be ZION (e.g. "1.5") or flowers (e.g. "1500000000000")
    // Treat as ZION if it contains a decimal point or is a small number
    const num = parseFloat(amountZion);
    if (amountZion.includes('.') || num < 1e6) {
      amountFlowers = BigInt(Math.floor(num * 1e6));
    } else {
      amountFlowers = BigInt(amountZion);
    }
  } else {
    amountFlowers = BigInt(Math.floor(Number(amountZion) * 1e6));
  }

  const feeFlowers = fee != null ? BigInt(fee) : DEFAULT_FEE_FLOWERS;
  // Nonce: timestamp_ms (fits in JS safe integer + Rust u64, unique per tx)
  const txNonce = nonce != null ? BigInt(nonce) : BigInt(Date.now());

  // Generate tx_id
  const txId = generateAccountTxId(fromAddress, toAddress, amountFlowers, txNonce);

  // Extract public key
  const pubKeyRaw = extractPublicKey(privateKeyDer);
  const pubKeyHex = bytesToHex(pubKeyRaw);

  // Hash the tx_id as bytes and sign
  const txIdBytes = Buffer.from(txId, 'utf8');
  const signature = ed25519Sign(privateKeyDer, txIdBytes);
  const signatureHex = bytesToHex(signature);

  // Build transaction object matching V3 core Transaction struct
  // amount_zion is u128 serialized as STRING in JSON
  return {
    tx_id: txId,
    from: fromAddress,
    to: toAddress,
    amount_zion: amountFlowers.toString(),
    fee_zion: Number(feeFlowers),
    nonce: Number(txNonce),
    signature: signatureHex,
    public_key: pubKeyHex
  };
}

module.exports = {
  buildAccountTransaction,
  generateAccountTxId,
  extractPublicKey,
  bytesToHex,
  FLOWERS_PER_ZION_BIGINT,
  DEFAULT_FEE_FLOWERS
};
