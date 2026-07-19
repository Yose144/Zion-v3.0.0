/**
 * ZION Explorer — Verify Message API (V4)
 *
 * Verifies an Ed25519 signature against a ZION public key.
 * The ZION node does not expose a verifyMessage RPC method, so verification
 * is done server-side using @noble/ed25519 (already a project dependency).
 *
 * ZION addresses are NOT Bech32-encoded public keys. They use a custom format:
 *   1. SHA-256(pubkey) → RIPEMD-160 → 20 bytes
 *   2. Each byte encoded as 2 base32 chars → 40 raw chars
 *   3. Truncate to 35 body chars
 *   4. Append 4-char SHA-256 checksum of "zion1" + body
 *   5. Prefix with "zion1"
 *
 * Because the address is a one-way hash of the public key, you CANNOT extract
 * the public key from the address alone. Therefore, this endpoint requires
 * either a hex public key directly, or both address + publicKey (in which case
 * it also verifies that the address matches the public key).
 *
 * POST body (JSON):
 *   {
 *     "publicKey": "8895b5...",          // 32-byte Ed25519 public key (hex, 64 chars)
 *     "message":   "Hello ZION",         // message that was signed
 *     "signature": "5caeee...",          // Ed25519 signature (hex, 128 chars)
 *     "address":   "zion1..."            // optional: if provided, verified against publicKey
 *   }
 *
 * Response:
 *   { valid: boolean, publicKey, address, message, algorithm, addressMatch? }
 *   or { error: string }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAsync } from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';

// @noble/ed25519 v2+ requires a SHA-512 implementation to be set
try {
  const { etc } = require('@noble/ed25519');
  etc.sha512Sync = (...m: Uint8Array[]) => sha512(Buffer.concat(m.map(b => Buffer.from(b))));
  etc.sha512Async = async (...m: Uint8Array[]) => sha512(Buffer.concat(m.map(b => Buffer.from(b))));
} catch { /* already set or module shape differs */ }

// ── ZION address derivation (mirrors V3/L1/core/src/crypto.rs) ──────────────

const ZION_BASE32_ALPHABET = '023456789acdefghjklmnpqrstuvwxyz';

/**
 * Derive a `zion1...` address from a 32-byte Ed25519 public key.
 * Matches the Rust implementation in `V3/L1/core/src/crypto.rs:derive_address`.
 */
function deriveZionAddress(pubkeyBytes: Uint8Array): string {
  // 1. SHA-256(pubkey) → RIPEMD-160 → 20 bytes
  const sha = sha256(pubkeyBytes);
  const keyHash = ripemd160(sha);

  // 2. Encode each byte as 2 base32 chars → 40 raw chars
  let data = '';
  for (const byte of keyHash) {
    data += ZION_BASE32_ALPHABET[byte % 32];
    data += ZION_BASE32_ALPHABET[Math.floor(byte / 32) % 32];
  }

  // 3. Truncate to 35 body chars
  data = data.slice(0, 35);

  // 4. Append 4-char SHA-256 checksum of "zion1" + body
  const ckInput = Buffer.concat([Buffer.from('zion1'), Buffer.from(data)]);
  const ckHash = sha256(ckInput);
  let checksum = '';
  for (const byte of ckHash.slice(0, 2)) {
    checksum += ZION_BASE32_ALPHABET[byte % 32];
    checksum += ZION_BASE32_ALPHABET[Math.floor(byte / 32) % 32];
  }

  // 5. Prefix with "zion1"
  return 'zion1' + data + checksum;
}

/**
 * Validate a `zion1` address (format + checksum).
 * Matches `is_valid_address` in `V3/L1/core/src/crypto.rs`.
 */
function isValidZionAddress(address: string): boolean {
  if (!address.startsWith('zion1') || address.length !== 44) return false;
  for (const c of address.slice(5)) {
    if (!/[0-9a-z]/.test(c)) return false;
  }
  const body = address.slice(5, 40);
  const expectedCk = deriveZionAddressChecksum(body);
  const actualCk = address.slice(40, 44);
  return expectedCk === actualCk;
}

function deriveZionAddressChecksum(body35: string): string {
  const ckInput = Buffer.concat([Buffer.from('zion1'), Buffer.from(body35)]);
  const ckHash = sha256(ckInput);
  let checksum = '';
  for (const byte of ckHash.slice(0, 2)) {
    checksum += ZION_BASE32_ALPHABET[byte % 32];
    checksum += ZION_BASE32_ALPHABET[Math.floor(byte / 32) % 32];
  }
  return checksum;
}

// ── API handler ─────────────────────────────────────────────────────────────

interface VerifyBody {
  publicKey?: string;
  message?: string;
  signature?: string;
  address?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: VerifyBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { publicKey, message, signature, address } = body;

    // Validate required fields
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message string is required' }, { status: 400 });
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Signature hex string is required' }, { status: 400 });
    }
    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json(
        { error: 'publicKey (hex, 64 chars) is required. ZION addresses are hashes of the public key and cannot be used to verify signatures alone.' },
        { status: 400 }
      );
    }

    // Validate public key format (32 bytes = 64 hex chars)
    const pkClean = publicKey.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(pkClean)) {
      return NextResponse.json(
        { error: `Invalid publicKey: expected 32-byte hex (64 chars), got ${pkClean.length} chars` },
        { status: 400 }
      );
    }
    const pubkeyBytes = Uint8Array.from(Buffer.from(pkClean, 'hex'));

    // Validate signature format (64 bytes = 128 hex chars)
    const sigClean = signature.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{128}$/.test(sigClean)) {
      return NextResponse.json(
        { error: `Invalid signature: expected 64-byte Ed25519 signature (128 hex chars), got ${sigClean.length} chars` },
        { status: 400 }
      );
    }
    const sigBytes = Uint8Array.from(Buffer.from(sigClean, 'hex'));

    // Message bytes (UTF-8)
    const msgBytes = Uint8Array.from(Buffer.from(message, 'utf-8'));

    // Verify Ed25519 signature
    let valid: boolean;
    try {
      valid = await verifyAsync(sigBytes, msgBytes, pubkeyBytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification error';
      return NextResponse.json(
        { valid: false, error: `Verification failed: ${msg}` },
        { status: 200 } // 200 with valid=false — the request succeeded, verification didn't
      );
    }

    // Derive address from public key (always, for reference)
    const derivedAddress = deriveZionAddress(pubkeyBytes);

    // If address was provided, check it matches the derived address
    let addressMatch: boolean | undefined;
    if (address) {
      addressMatch = address === derivedAddress;
    }

    return NextResponse.json({
      valid,
      publicKey: pkClean,
      address: derivedAddress,
      providedAddress: address ?? null,
      addressMatch,
      message,
      algorithm: 'ed25519',
    });
  } catch (error) {
    console.error('Verify message failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Verify message failed: ${msg}` }, { status: 503 });
  }
}
