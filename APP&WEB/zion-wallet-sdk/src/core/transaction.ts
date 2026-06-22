/**
 * ZION V3 UTXO + Account Transaction Builder
 * Matches V3/L1/core/src/tx.rs Transaction::calculate_hash()
 * Matches V3/L1/core/src/wallet.rs build_and_sign_account
 */

import { blake3 } from '@noble/hashes/blake3.js';
import { signMessage } from './keypair.js';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Enable sync sha512 for @noble/ed25519
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export const FLOWERS_PER_ZION = 1_000_000_000_000n;
export const MIN_FEE_FLOWERS = 1_000_000n; // 0.000001 ZION minimum fee (UTXO)
export const ACCOUNT_DEFAULT_FEE_FLOWERS = 1_000n; // Minimum fee for account-model (matches V3 fee::MIN_TX_FEE)

export interface UTXO {
  tx_hash: string;
  output_index: number;
  amount: string | number | bigint;
  address: string;
  height?: number;
  coinbase?: boolean;
}

export interface TxInput {
  prev_tx_hash: number[]; // 32 bytes
  output_index: number;
  signature: number[]; // 64 bytes
  public_key: number[]; // 32 bytes
}

export interface TxOutput {
  amount: number;
  address: string;
  memo?: string;
}

export interface Transaction {
  id: number[]; // 32 bytes
  version: number;
  inputs: TxInput[];
  outputs: TxOutput[];
  fee: number;
  timestamp: number;
}

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/^0x/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return bytes;
}

function uint32LE(value: number): number[] {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value >>> 0, 0);
  return Array.from(buf);
}

function uint64LE(value: bigint): number[] {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(value, 0);
  return Array.from(buf);
}

function concatBytes(arrays: (number[] | Uint8Array | Buffer)[]): Uint8Array {
  let total = 0;
  for (const arr of arrays) total += arr.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr instanceof Uint8Array ? arr : new Uint8Array(arr), offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Compute the canonical SegWit-style BLAKE3 transaction hash.
 * Excludes signatures.
 */
export function calculateTxHash(tx: Transaction): Uint8Array {
  const parts: (number[] | Uint8Array | Buffer)[] = [];

  // version: u32 LE
  parts.push(uint32LE(tx.version));

  // inputs (exclude signature — SegWit-style)
  for (const input of tx.inputs) {
    parts.push(input.prev_tx_hash);
    parts.push(uint32LE(input.output_index));
    parts.push(input.public_key);
  }

  // outputs
  for (const output of tx.outputs) {
    parts.push(uint64LE(BigInt(output.amount)));
    parts.push(Buffer.from(output.address, 'utf8'));
    if (output.memo) {
      parts.push(Buffer.from(output.memo, 'utf8'));
    }
  }

  // fee: u64 LE
  parts.push(uint64LE(BigInt(tx.fee)));

  // timestamp: u64 LE
  parts.push(uint64LE(BigInt(tx.timestamp)));

  return blake3(concatBytes(parts));
}

/**
 * Extract raw 32-byte Ed25519 public key from DER PKCS8 private key.
 */
export function extractPublicKeyFromPrivateKey(_privateKeyDer: Uint8Array): Uint8Array {
  // For raw 32-byte Ed25519 private keys, the public key is derived via getPublicKey
  // This function assumes the caller provides the raw private key seed
  throw new Error('Use deriveKeypairFromPrivateKey from keypair.ts to get publicKey');
}

/**
 * Build a signed UTXO transaction for V3.
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
}): Promise<Transaction> {
  const amountFlowers = BigInt(Math.round(amountZion * 1e12));
  const feeFlowers = MIN_FEE_FLOWERS;
  const totalNeeded = amountFlowers + feeFlowers;

  // Sort UTXOs by amount descending for efficient selection
  const sortedUtxos = [...utxos]
    .filter((u) => u.address === fromAddress && BigInt(u.amount) > 0n)
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)));

  // Simple greedy UTXO selection
  const selected: UTXO[] = [];
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

  // Derive public key from private key
  const { publicKey } = await import('./keypair').then((m) => m.deriveKeypairFromPrivateKey(Buffer.from(privateKey).toString('hex')));

  // Build outputs
  const outputs: TxOutput[] = [
    {
      amount: Number(amountFlowers),
      address: toAddress,
      ...(memo ? { memo } : {}),
    },
  ];

  // Change output (back to sender)
  if (change > 0n) {
    outputs.push({
      amount: Number(change),
      address: fromAddress,
    });
  }

  // Build inputs (signatures empty initially — filled after hash computation)
  const inputs: TxInput[] = selected.map((utxo) => ({
    prev_tx_hash: hexToBytes(utxo.tx_hash),
    output_index: utxo.output_index,
    signature: new Array(64).fill(0),
    public_key: Array.from(publicKey),
  }));

  // Build transaction structure
  const tx: Transaction = {
    id: new Array(32).fill(0),
    version: 1,
    inputs,
    outputs,
    fee: Number(feeFlowers),
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Compute BLAKE3 hash (SegWit-style, excludes signatures)
  const txHash = calculateTxHash(tx);
  tx.id = Array.from(txHash);

  // Sign each input with the transaction hash
  for (const input of tx.inputs) {
    const sig = await signMessage(txHash, privateKey);
    input.signature = Array.from(sig);
  }

  return tx;
}

/**
 * Convert a transaction to the JSON-RPC payload format.
 */
export function transactionToRpcPayload(tx: Transaction): Record<string, unknown> {
  return {
    id: tx.id.map((b) => b.toString(16).padStart(2, '0')).join(''),
    version: tx.version,
    inputs: tx.inputs.map((input) => ({
      prev_tx_hash: input.prev_tx_hash.map((b) => b.toString(16).padStart(2, '0')).join(''),
      output_index: input.output_index,
      signature: input.signature.map((b) => b.toString(16).padStart(2, '0')).join(''),
      public_key: input.public_key.map((b) => b.toString(16).padStart(2, '0')).join(''),
    })),
    outputs: tx.outputs,
    fee: tx.fee,
    timestamp: tx.timestamp,
  };
}

// ─── Account-Model Transaction Builder ───────────────────────────────
// Matches V3/L1/core/src/wallet.rs build_and_sign_account + lib.rs Transaction struct
// Used for premine wallets (Humanitarian, ISSOBELLA, DAO treasury, Genesis Creator)
// that have balance in the account ledger (not UTXO).

function bytesToHex(bytes: Uint8Array | Buffer | number[]): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a deterministic tx_id for an account transaction.
 * Matches V3/L1/core/src/wallet.rs generate_account_tx_id.
 *
 * Layout:
 *   bytes[0..16]  = timestamp nanos (two u64 LE: low + high)
 *   bytes[16..24] = amount (u64 LE)
 *   bytes[24..32] = nonce (u64 LE)
 *   XOR from + to address bytes cyclically into all 32 bytes
 */
export function generateAccountTxId(from: string, to: string, amount: bigint, nonce: bigint): string {
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
 * @param fee Fee in flowers (default: 1000)
 */
export async function buildAccountTransaction({
  fromAddress,
  toAddress,
  amountZion,
  privateKey,
  nonce,
  fee,
}: {
  fromAddress: string;
  toAddress: string;
  amountZion: number | string | bigint;
  privateKey: Uint8Array;
  nonce?: bigint;
  fee?: bigint;
}): Promise<AccountTransaction> {
  // Parse amount to flowers (bigint)
  let amountFlowers: bigint;
  if (typeof amountZion === 'bigint') {
    amountFlowers = amountZion;
  } else if (typeof amountZion === 'string') {
    const num = parseFloat(amountZion);
    if (amountZion.includes('.') || num < 1e12) {
      amountFlowers = BigInt(Math.floor(num * 1e12));
    } else {
      amountFlowers = BigInt(amountZion);
    }
  } else {
    amountFlowers = BigInt(Math.floor(Number(amountZion) * 1e12));
  }

  const feeFlowers = fee != null ? fee : ACCOUNT_DEFAULT_FEE_FLOWERS;
  const txNonce = nonce != null ? nonce : BigInt(Date.now());

  // Generate tx_id
  const txId = generateAccountTxId(fromAddress, toAddress, amountFlowers, txNonce);

  // Derive public key from private key
  const publicKey = await ed.getPublicKey(privateKey);
  const pubKeyHex = bytesToHex(publicKey);

  // Sign the tx_id (as UTF-8 bytes) with Ed25519
  const txIdBytes = Buffer.from(txId, 'utf8');
  const signature = await ed.sign(txIdBytes, privateKey);
  const signatureHex = bytesToHex(signature);

  return {
    tx_id: txId,
    from: fromAddress,
    to: toAddress,
    amount_zion: amountFlowers.toString(),
    fee_zion: Number(feeFlowers),
    nonce: Number(txNonce),
    signature: signatureHex,
    public_key: pubKeyHex,
  };
}
