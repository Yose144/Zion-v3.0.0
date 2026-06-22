/**
 * ZION V3 UTXO Transaction Builder
 * Matches V3/L1/core/src/tx.rs Transaction::calculate_hash()
 */

import { blake3 } from '@noble/hashes/blake3.js';
import { signMessage } from './keypair.js';

export const FLOWERS_PER_ZION = 1_000_000_000_000n;
export const MIN_FEE_FLOWERS = 1_000_000n; // 0.000001 ZION minimum fee

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
