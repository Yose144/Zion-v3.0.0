/**
 * ZION V31-native UTXO + Account Transaction Builder
 *
 * V31-native UTXO transaction matches V31/L1/core/src/transaction.rs:
 *   version: u32
 *   inputs:  [{ previous_output: [u8;32], index: u32, script: Vec<u8> }]
 *   outputs: [{ amount: u128 (string), address: { chain, bytes, encoded } }]
 *   memo:    Vec<u8>
 *
 * Transaction ID and signing message use Keccak-256 over the same binary
 * preimage.  The signing hash leaves every input `script` empty so the
 * signatures do not affect the tx ID (SegWit-style).
 */

import { keccak_256 } from '@noble/hashes/sha3.js';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Enable sync sha512 for @noble/ed25519 in environments without WebCrypto
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export const FLOWERS_PER_ZION = 1_000_000n;
export const MIN_FEE_FLOWERS = 1n; // 1 flower minimum fee (L1 fee::MIN_TX_FEE=1, 3.0.3)
export const ACCOUNT_DEFAULT_FEE_FLOWERS = 1n; // 1 flower for account-model (L1 fee::MIN_TX_FEE=1, 3.0.3)

export interface UTXO {
  tx_hash: string;
  output_index: number;
  amount: string | number | bigint;
  address?: string;
  height?: number;
  coinbase?: boolean;
}

export interface TxInput {
  previous_output: number[]; // 32 bytes
  index: number;
  script: number[]; // 64-byte signature + 32-byte public key
}

export interface TxOutput {
  amount: string; // u128 as decimal string
  address: {
    chain: string;
    bytes: number[];
    encoded: string;
  };
}

export interface Transaction {
  version: number;
  inputs: TxInput[];
  outputs: TxOutput[];
  memo: number[];
}

export interface BuildUtxoResult {
  transaction: Transaction;
  tx_id: string;
}

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/^0x/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array | Buffer | number[]): string {
  return Array.from(bytes).map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

function uint32LE(value: number): number[] {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return Array.from(buf);
}

function uint128LE(value: bigint): number[] {
  const v = BigInt(value);
  const buf = Buffer.allocUnsafe(16);
  const mask = 0xFFFFFFFFFFFFFFFFn;
  buf.writeBigUInt64LE(v & mask, 0);
  buf.writeBigUInt64LE((v >> 64n) & mask, 8);
  return Array.from(buf);
}

function concatBuffers(arrays: (Buffer | Uint8Array | number[])[]): Buffer {
  let total = 0;
  for (const arr of arrays) total += arr.length;
  const out = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr instanceof Uint8Array ? arr : Buffer.from(arr), offset);
    offset += arr.length;
  }
  return out;
}

function keccak256Hash(data: Buffer | Uint8Array | number[]): Buffer {
  return Buffer.from(keccak_256(Buffer.from(data)));
}

/**
 * Estimate serialized transaction size in bytes.
 * Mirrors V31/L1/core/src/fee.rs estimate_tx_size().
 */
export function estimateTxSize(numInputs: number, numOutputs: number): number {
  return 52 + numInputs * 132 + numOutputs * 60;
}

/**
 * Minimum required fee for a transaction of the given size.
 * Mirrors V31/L1/core/src/fee.rs minimum_fee_for_size().
 */
export function minimumFeeForSize(txSize: number): bigint {
  const rateBased = BigInt(txSize);
  return rateBased > MIN_FEE_FLOWERS ? rateBased : MIN_FEE_FLOWERS;
}

function makeAddressObject(encoded: string): TxOutput['address'] {
  return {
    chain: 'zion_l1',
    bytes: [],
    encoded,
  };
}

/**
 * Build the binary Keccak-256 preimage for a native V31 transaction.
 * @param tx - native V31 transaction
 * @param scripts - one per input; use empty Buffer for signing hash
 */
function buildPreimage(tx: Transaction, scripts: Buffer[]): Buffer {
  const parts: (Buffer | number[])[] = [];

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
 * Compute the native V31 transaction hash (txid) — scripts included.
 */
export function calculateTxHash(tx: Transaction): Buffer {
  const scripts = tx.inputs.map((input) => Buffer.from(input.script));
  return keccak256Hash(buildPreimage(tx, scripts));
}

/**
 * Compute the native V31 signing hash — input scripts are empty.
 */
export function calculateSigningHash(tx: Transaction): Buffer {
  const scripts = tx.inputs.map(() => Buffer.alloc(0));
  return keccak256Hash(buildPreimage(tx, scripts));
}

/**
 * Build a signed V31-native UTXO transaction.
 *
 * @param fromAddress - Sender zion1 address
 * @param toAddress - Recipient zion1 address
 * @param amountZion - Amount in ZION (float)
 * @param utxos - Spendable UTXOs from getUtxos RPC
 * @param privateKey - Raw 32-byte Ed25519 private key seed
 * @param memo - Optional UTF-8 memo
 * @returns {{transaction: Transaction, tx_id: string}} V31-native payload + hex txid
 */
export async function buildUtxoTransaction({
  fromAddress,
  toAddress,
  amountZion,
  utxos,
  privateKey,
  memo,
}: {
  fromAddress: string;
  toAddress: string;
  amountZion: number;
  utxos: UTXO[];
  privateKey: Uint8Array;
  memo?: string;
}): Promise<BuildUtxoResult> {
  if (!fromAddress || !toAddress) throw new Error('fromAddress and toAddress are required');
  if (amountZion <= 0) throw new Error('Amount must be positive');
  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('No UTXOs provided');

  const amountFlowers = BigInt(Math.floor(amountZion * 1e6));
  const publicKey = await ed.getPublicKey(privateKey);

  // Sort UTXOs by amount descending for efficient selection.  The RPC already
  // returns UTXOs for `fromAddress`, so the address filter is best-effort.
  const sortedUtxos = [...utxos]
    .filter((u) => {
      const addr = u.address;
      return !addr || addr === fromAddress;
    })
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)));

  if (sortedUtxos.length === 0) {
    throw new Error('No spendable UTXOs for the sender address');
  }

  // Greedy selection with dynamic fee based on selected input/output count.
  const selected: UTXO[] = [];
  let inputSum = 0n;
  let feeFlowers = 0n;
  let changeFlowers = 0n;
  let numOutputs = 2; // assume change output initially

  for (const utxo of sortedUtxos) {
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

  // Build outputs
  const outputs: TxOutput[] = [
    {
      amount: amountFlowers.toString(),
      address: makeAddressObject(toAddress),
    },
  ];

  if (changeFlowers > 0n) {
    outputs.push({
      amount: changeFlowers.toString(),
      address: makeAddressObject(fromAddress),
    });
  } else {
    // No change output — fee is whatever remains (still >= min for 1 output)
    feeFlowers = inputSum - amountFlowers;
  }

  // Build inputs (scripts empty initially — filled after signing hash)
  const inputs: TxInput[] = selected.map((utxo) => ({
    previous_output: hexToBytes(utxo.tx_hash),
    index: utxo.output_index,
    script: [],
  }));

  // Native V31 transaction structure
  const memoBytes = memo ? Array.from(Buffer.from(memo, 'utf8')) : [];
  const tx: Transaction = {
    version: 1,
    inputs,
    outputs,
    memo: memoBytes,
  };

  // Compute signing hash (scripts excluded), sign it, then fill scripts
  const signingHash = calculateSigningHash(tx);
  const signature = await ed.sign(signingHash, privateKey);
  const script = Array.from(Buffer.concat([signature, publicKey]));

  for (const input of tx.inputs) {
    input.script = script;
  }

  // Compute transaction hash (txid) with scripts included
  const txHash = calculateTxHash(tx);

  return {
    tx_id: bytesToHex(txHash),
    transaction: tx,
  };
}

/**
 * Convert a V31-native transaction to the JSON-RPC payload format.
 * submitUtxoTransaction expects the native V31 Transaction shape.
 */
export function transactionToRpcPayload(tx: Transaction): Record<string, unknown> {
  return {
    version: tx.version,
    inputs: tx.inputs.map((input) => ({
      previous_output: input.previous_output,
      index: input.index,
      script: input.script,
    })),
    outputs: tx.outputs,
    memo: tx.memo,
  };
}

// ─── Account-Model Transaction Builder ───────────────────────────────
// Matches V31/L1/core/src/v3_wallet.rs build_and_sign_account
// Used for premine wallets (Humanitarian, ISSOBELLA, DAO treasury, Genesis Creator)
// that have balance in the account ledger (not UTXO).

/**
 * Generate a deterministic tx_id for an account transaction.
 * Matches V31/L1/core/src/v3_wallet.rs generate_account_tx_id.
 *
 * Layout:
 *   bytes[0..16]  = timestamp nanos (two u64 LE: low + high)
 *   bytes[16..24] = amount (u64 LE)
 *   bytes[24..32] = nonce (u64 LE)
 *   XOR from + to address bytes cyclically into all 32 bytes
 */
export function generateAccountTxId(from: string, to: string, amount: bigint, nonce: bigint, memo?: string): string {
  const bytes = Buffer.alloc(32);

  // Timestamp nanos (16 bytes = two u64 LE)
  const tsNanos = BigInt(Date.now()) * 1_000_000n;
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

  // XOR-in memo bytes if present, so the tx_id commits to the memo.
  if (memo) {
    const memoBytes = Buffer.from(memo, 'utf8');
    for (let i = 0; i < memoBytes.length; i++) {
      bytes[i % 32] ^= memoBytes[i];
    }
  }

  return bytesToHex(bytes);
}

export interface AccountTransaction {
  tx_id: string;
  from: string;
  to: string;
  amount_zion: string; // u128 serialized as STRING in JSON
  fee_zion: number;
  nonce: number;
  signature: string; // 64-byte Ed25519 signature hex
  public_key: string; // 32-byte raw Ed25519 public key hex
  memo?: string; // Optional ASCII memo, max 256 bytes
}

/**
 * Build and sign an account-model transaction.
 * Uses raw 32-byte Ed25519 private key (web SDK format).
 *
 * @param fromAddress Sender zion1 address
 * @param toAddress Recipient zion1 address
 * @param amountZion Amount in ZION (float) or flowers (bigint)
 * @param privateKey Raw 32-byte Ed25519 private key
 * @param nonce Unique nonce (default: Date.now() ms)
 * @param fee Fee in flowers (default: 1, L1 MIN_TX_FEE)
 * @param memo Optional ASCII memo (max 256 bytes)
 */
export async function buildAccountTransaction({
  fromAddress,
  toAddress,
  amountZion,
  privateKey,
  nonce,
  fee,
  memo,
}: {
  fromAddress: string;
  toAddress: string;
  amountZion: number | string | bigint;
  privateKey: Uint8Array;
  nonce?: bigint;
  fee?: bigint;
  memo?: string;
}): Promise<AccountTransaction> {
  // Parse amount to flowers (bigint)
  let amountFlowers: bigint;
  if (typeof amountZion === 'bigint') {
    amountFlowers = amountZion;
  } else if (typeof amountZion === 'string') {
    const num = parseFloat(amountZion);
    if (amountZion.includes('.') || num < 1e6) {
      amountFlowers = BigInt(Math.floor(num * 1e6));
    } else {
      amountFlowers = BigInt(amountZion);
    }
  } else {
    amountFlowers = BigInt(Math.floor(Number(amountZion) * 1e6));
  }

  if (memo) {
    const memoBytes = Buffer.from(memo, 'utf8');
    if (memoBytes.length > 256) {
      throw new Error('memo exceeds 256 bytes');
    }
    if (!/^[-]*$/.test(memo)) {
      throw new Error('memo must be ASCII');
    }
  }

  const feeFlowers = fee != null ? fee : ACCOUNT_DEFAULT_FEE_FLOWERS;
  const txNonce = nonce != null ? nonce : BigInt(Date.now());

  // Generate tx_id
  const txId = generateAccountTxId(fromAddress, toAddress, amountFlowers, txNonce, memo);

  // Derive public key from private key
  const publicKey = await ed.getPublicKey(privateKey);
  const pubKeyHex = bytesToHex(publicKey);

  // Sign the tx_id (as UTF-8 bytes) with Ed25519
  const txIdBytes = Buffer.from(txId, 'utf8');
  const signature = await ed.sign(txIdBytes, privateKey);
  const signatureHex = bytesToHex(signature);

  const tx: AccountTransaction = {
    tx_id: txId,
    from: fromAddress,
    to: toAddress,
    amount_zion: amountFlowers.toString(),
    fee_zion: Number(feeFlowers),
    nonce: Number(txNonce),
    signature: signatureHex,
    public_key: pubKeyHex,
  };
  if (memo) {
    tx.memo = memo;
  }
  return tx;
}
