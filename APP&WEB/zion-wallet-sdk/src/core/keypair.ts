/**
 * ZION Keypair Generation
 * Ed25519 keypairs derived from BIP39 mnemonics.
 * Compatible with V3/L1/core crypto.rs.
 */

import * as bip39 from 'bip39';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Enable sync sha512 for @noble/ed25519 in environments without WebCrypto
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

/**
 * Generate a new BIP39 mnemonic.
 * @param strength Bit strength: 128 (12 words) or 256 (24 words)
 */
export function generateMnemonic(strength: 128 | 256 = 256): string {
  return bip39.generateMnemonic(strength);
}

/**
 * Validate a BIP39 mnemonic phrase.
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic.trim());
}

/**
 * Derive an Ed25519 keypair from a BIP39 mnemonic.
 * Uses first 32 bytes of the BIP39 seed as the Ed25519 private key.
 */
export async function deriveKeypairFromMnemonic(mnemonic: string): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  const normalized = mnemonic.trim();
  if (!validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const seed = await bip39.mnemonicToSeed(normalized);
  const privateKey = seed.slice(0, 32);
  const publicKey = await ed.getPublicKey(privateKey);

  return { privateKey: new Uint8Array(privateKey), publicKey };
}

/**
 * Derive an Ed25519 keypair from a raw 32-byte private key.
 */
export async function deriveKeypairFromPrivateKey(privateKeyHex: string): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  const hex = privateKeyHex.replace(/^0x/, '');
  if (hex.length !== 64) {
    throw new Error('Invalid private key length: expected 32 bytes (64 hex chars)');
  }

  const privateKey = Buffer.from(hex, 'hex');
  if (privateKey.length !== 32) {
    throw new Error('Invalid private key length');
  }

  const publicKey = await ed.getPublicKey(privateKey);
  return { privateKey: new Uint8Array(privateKey), publicKey };
}

/**
 * Sign a message with an Ed25519 private key.
 */
export async function signMessage(
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  return ed.sign(message, privateKey);
}

/**
 * Verify an Ed25519 signature.
 */
export async function verifySignature(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  return ed.verify(signature, message, publicKey);
}
