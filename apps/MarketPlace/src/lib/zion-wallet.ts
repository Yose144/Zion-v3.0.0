// ── Browser-safe ZION L1 wallet derivation ───────────────────────────
// Same derivation as server-side zion-l1.ts but without Node APIs
// (Buffer/fs) — usable in client components for local-only signing.
// Secret material never leaves the browser.

import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const ZION_BASE32_ALPHABET = '023456789acdefghjklmnpqrstuvwxyz';

function zionBase32Encode(data: Uint8Array): string {
  let out = '';
  for (const byte of data) {
    out += ZION_BASE32_ALPHABET[byte % 32];
    out += ZION_BASE32_ALPHABET[Math.floor(byte / 32) % 32];
  }
  return out;
}

function computeAddressChecksum(body: string): string {
  const hash = sha256(new TextEncoder().encode('zion1' + body));
  return zionBase32Encode(hash.slice(0, 2));
}

export function deriveZionAddress(publicKey: Uint8Array): string {
  const keyHash = ripemd160(sha256(publicKey));
  const body = zionBase32Encode(keyHash).slice(0, 35);
  return `zion1${body}${computeAddressChecksum(body)}`;
}

export interface ZionKeypair {
  address: string;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Derive a ZION keypair from a secret: BIP39 mnemonic (12/24 words)
 * or a 32-byte secret key hex string (with or without 0x).
 */
export function walletFromSecret(secret: string): ZionKeypair {
  const trimmed = secret.trim();
  let secretKey: Uint8Array;
  if (trimmed.includes(' ')) {
    const mnemonic = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (!validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
    secretKey = mnemonicToSeedSync(mnemonic).slice(0, 32);
  } else {
    const hex = trimmed.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error('Expected a 12/24-word mnemonic or a 32-byte hex secret key');
    }
    secretKey = hexToBytes(hex);
  }
  const publicKey = ed25519.getPublicKey(secretKey);
  return { address: deriveZionAddress(publicKey), publicKey, secretKey };
}

export function bytesHex(b: Uint8Array): string {
  return bytesToHex(b);
}

export { ed25519 };
