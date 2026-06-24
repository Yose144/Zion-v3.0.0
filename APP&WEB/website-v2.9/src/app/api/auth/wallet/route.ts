/**
 * POST /api/auth/wallet
 *
 * Verifies a wallet signature and issues a JWT session.
 *
 * Body: { address, publicKey, signature, nonce }
 *   - address:   zion1... wallet address
 *   - publicKey: hex-encoded Ed25519 public key (32 bytes)
 *   - signature: hex-encoded Ed25519 signature (64 bytes)
 *   - nonce:     the nonce from /api/auth/nonce
 *
 * The server verifies:
 *   1. The nonce is valid and not expired
 *   2. The Ed25519 signature is valid for (nonce, publicKey)
 *   3. The publicKey corresponds to the address (via address derivation)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { consumeNonce, upsertUser } from '@/lib/auth-storage';
import { createSession, AUTH_COOKIE, COOKIE_OPTIONS } from '@/lib/auth';

// ZION address derivation (must match wallet SDK)
const ZION_BASE32_ALPHABET = '023456789acdefghjklmnpqrstuvwxyz';

function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ZION_BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ZION_BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function checksum(data: Uint8Array): Uint8Array {
  const hash1 = sha256(data);
  const hash2 = sha256(hash1);
  // Take first 4 bytes of double SHA-256, but ZION uses RIPEMD160 variant
  // Actually, let's use the SDK's approach: SHA256 then first 4 bytes
  return hash2.slice(0, 4);
}

/**
 * Derive a zion1 address from an Ed25519 public key.
 * Must match the wallet SDK's publicKeyToAddress function.
 */
function publicKeyToAddress(publicKey: Uint8Array): string {
  // SHA-256 of public key
  const sha = sha256(publicKey);
  // RIPEMD-160 of SHA-256
  const rip = ripemd160(sha);

  // Build payload: version byte (0x00) + RIPEMD-160
  const version = new Uint8Array([0x00]);
  const payload = new Uint8Array(version.length + rip.length);
  payload.set(version, 0);
  payload.set(rip, version.length);

  // Checksum: first 4 bytes of double-SHA256(payload)
  const cs = sha256(sha256(payload)).slice(0, 4);

  // Full binary: payload + checksum
  const binary = new Uint8Array(payload.length + cs.length);
  binary.set(payload, 0);
  binary.set(cs, payload.length);

  // Base32 encode
  const encoded = base32Encode(binary);

  return 'zion1' + encoded;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, publicKey, signature, nonce } = body;

    if (!address || !publicKey || !signature || !nonce) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!address.startsWith('zion1')) {
      return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
    }

    // 1. Consume the nonce (validates it exists, is unused, and not expired)
    const nonceValid = await consumeNonce(address, nonce);
    if (!nonceValid) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    // 2. Convert hex strings to bytes
    const pubKeyBytes = hexToBytes(publicKey);
    const sigBytes = hexToBytes(signature);
    const nonceBytes = hexToBytes(nonce);

    if (pubKeyBytes.length !== 32) {
      return NextResponse.json({ error: 'Invalid public key length' }, { status: 400 });
    }
    if (sigBytes.length !== 64) {
      return NextResponse.json({ error: 'Invalid signature length' }, { status: 400 });
    }

    // 3. Verify the Ed25519 signature
    const isValid = await ed.verify(sigBytes, nonceBytes, pubKeyBytes);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 4. Verify the public key corresponds to the address
    const derivedAddress = publicKeyToAddress(pubKeyBytes);
    if (derivedAddress !== address) {
      return NextResponse.json({
        error: 'Public key does not match wallet address',
        detail: { derived: derivedAddress, provided: address },
      }, { status: 401 });
    }

    // 5. Create or update user record
    const user = await upsertUser(address);

    // 6. Issue JWT
    const jwt = await createSession(address, user.displayName);

    // 7. Set cookie and return success
    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        address: user.walletAddress,
        displayName: user.displayName,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });

    response.cookies.set(AUTH_COOKIE, jwt, COOKIE_OPTIONS);

    return response;
  } catch (err: any) {
    console.error('[auth/wallet] Error:', err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
