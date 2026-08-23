import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { getPublicKeyAsync, utils } from '@noble/ed25519';

const ZION_BASE32_ALPHABET = '023456789acdefghjklmnpqrstuvwxyz';

function computeAddressChecksum(body35: string): string {
  const data = new TextEncoder().encode('zion1' + body35);
  const hash = sha256(data);
  let ck = '';
  for (let i = 0; i < 2; i++) {
    const byte = hash[i];
    ck += ZION_BASE32_ALPHABET[byte % 32];
    ck += ZION_BASE32_ALPHABET[(Math.floor(byte / 32) % 32)];
  }
  return ck;
}

export function deriveZionAddress(publicKey: Uint8Array | string): string {
  const pk = typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey;
  if (pk.length !== 32) {
    throw new Error('Ed25519 public key must be 32 bytes');
  }
  const sha = sha256(pk);
  const hash = ripemd160(sha);
  let body = '';
  for (const byte of hash) {
    body += ZION_BASE32_ALPHABET[byte % 32];
    body += ZION_BASE32_ALPHABET[(Math.floor(byte / 32) % 32)];
  }
  body = body.slice(0, 35);
  const checksum = computeAddressChecksum(body);
  return `zion1${body}${checksum}`;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ZionKeypair {
  secretKeyHex: string;
  publicKeyHex: string;
  address: string;
}

export async function generateZionKeypair(): Promise<ZionKeypair> {
  const secretKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(secretKey);
  return {
    secretKeyHex: bytesToHex(secretKey),
    publicKeyHex: bytesToHex(publicKey),
    address: deriveZionAddress(publicKey),
  };
}
