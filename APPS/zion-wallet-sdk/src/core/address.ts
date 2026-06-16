/**
 * ZION V3 Address Derivation
 *
 * Matches V3/L1/core/src/crypto.rs derive_address():
 *   1. SHA-256(pubkey) → RIPEMD-160 → 20 bytes
 *   2. Each byte → 2 base32 chars → 40 chars
 *   3. Truncate to 35 body chars
 *   4. Append 4-char checksum of "zion1" + body
 *   5. Result: "zion1" + body(35) + checksum(4) = 44 chars
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';

export const ZION_PREFIX = 'zion1';
export const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

/**
 * Derive a V3-compatible ZION address from a raw Ed25519 public key (32 bytes).
 */
export function publicKeyToAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${publicKey.length}`);
  }

  // SHA-256 → RIPEMD-160
  const sha = sha256(publicKey);
  const keyHash = ripemd160(sha); // 20 bytes

  // Each byte → 2 base32 chars
  let data = '';
  for (const byte of keyHash) {
    data += ZION_BASE32[byte % 32];
    data += ZION_BASE32[Math.floor(byte / 32) % 32];
  }

  // Truncate to 35 body chars
  const body = data.slice(0, 35);

  // 4-char checksum: SHA-256("zion1" + body), first 2 bytes → 4 base32 chars
  const ckHash = sha256(new TextEncoder().encode(ZION_PREFIX + body));
  let checksum = '';
  for (let i = 0; i < 2; i++) {
    const b = ckHash[i];
    checksum += ZION_BASE32[b % 32];
    checksum += ZION_BASE32[Math.floor(b / 32) % 32];
  }

  return ZION_PREFIX + body + checksum;
}

/**
 * Validate a zion1 address (format + checksum).
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const a = address.trim();
  if (!a.startsWith(ZION_PREFIX)) return false;
  if (a.length !== 44) return false;

  // Check all chars are in ZION_BASE32
  for (let i = 5; i < 44; i++) {
    if (!ZION_BASE32.includes(a[i])) return false;
  }

  // Verify checksum
  const body = a.slice(5, 40);
  const actualCk = a.slice(40, 44);
  const ckHash = sha256(new TextEncoder().encode(ZION_PREFIX + body));
  let expectedCk = '';
  for (let i = 0; i < 2; i++) {
    const b = ckHash[i];
    expectedCk += ZION_BASE32[b % 32];
    expectedCk += ZION_BASE32[Math.floor(b / 32) % 32];
  }

  return expectedCk === actualCk;
}

/**
 * Get address type.
 * - 'zion1': canonical chain-compatible address
 * - 'legacy': old desktop-agent style (ZION...)
 * - 'invalid': unknown/invalid
 */
export function getAddressType(address: string): 'zion1' | 'legacy' | 'invalid' {
  if (typeof address !== 'string') return 'invalid';
  const a = address.trim();
  if (!a) return 'invalid';

  if (a.startsWith(ZION_PREFIX)) {
    return isValidAddress(a) ? 'zion1' : 'invalid';
  }

  // Legacy format
  const legacyRegex = /^ZION[A-Z2-7]{20,60}$/;
  if (legacyRegex.test(a)) return 'legacy';

  return 'invalid';
}
