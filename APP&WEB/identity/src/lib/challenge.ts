// Auth challenge + verification for both ZION L1 (Ed25519) and EVM (SIWE).

import * as ed from 'noble-ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { randomBytes } from 'node:crypto';
import { SiweMessage } from 'siwe';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min
const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

const challenges = new Map<string, { challenge: string; expires: number }>();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (v.expires < now) challenges.delete(k);
  }
}, 60_000).unref();

export function createChallenge(address: string): string {
  const nonce = randomBytes(16).toString('hex');
  const issued = new Date().toISOString();
  const challenge = [
    'ZION-AUTH-V1',
    `address: ${address}`,
    `nonce: ${nonce}`,
    `issued: ${issued}`,
    `ttl: ${CHALLENGE_TTL_MS}ms`,
  ].join('\n');

  challenges.set(address.toLowerCase(), {
    challenge,
    expires: Date.now() + CHALLENGE_TTL_MS,
  });
  return challenge;
}

export function getChallenge(address: string): string | null {
  const entry = challenges.get(address.toLowerCase());
  if (!entry || entry.expires < Date.now()) {
    challenges.delete(address.toLowerCase());
    return null;
  }
  return entry.challenge;
}

export function clearChallenge(address: string): void {
  challenges.delete(address.toLowerCase());
}

/**
 * Derive a canonical ZION V3 address from a raw Ed25519 public key.
 * Mirrors zion-wallet-sdk/src/core/address.ts.
 */
function publicKeyToAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${publicKey.length}`);
  }

  const sha = sha256(publicKey);
  const keyHash = ripemd160(sha); // 20 bytes

  let data = '';
  for (const byte of keyHash) {
    data += ZION_BASE32[byte % 32];
    data += ZION_BASE32[Math.floor(byte / 32) % 32];
  }

  const body = data.slice(0, 35);
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
 * Verify an Ed25519 signature (ZION L1 native auth).
 * Signature is over the challenge bytes (UTF-8).
 */
export async function verifyEd25519(
  address: string,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  const challenge = getChallenge(address);
  if (!challenge) return false;

  const messageBytes = Buffer.from(challenge, 'utf8');
  const sig = Buffer.from(signatureHex, 'hex');
  const pub = Buffer.from(publicKeyHex, 'hex');

  // Derive expected address from pubkey and ensure it matches the claimed address.
  const expectedAddr = publicKeyToAddress(Uint8Array.from(pub));
  if (expectedAddr !== address) return false;

  const ok = await ed.verify(sig, messageBytes, pub);
  if (ok) clearChallenge(address);
  return ok;
}

/**
 * Verify an EVM SIWE message + signature (EIP-191 personal_sign / EIP-712).
 *
 * Parses the SIWE message, recovers the signer address from the signature,
 * and ensures the nonce matches a challenge issued by this service.
 */
export async function verifySiwe(
  address: string,
  signature: string,
  message: string,
): Promise<boolean> {
  const challenge = getChallenge(address);
  if (!challenge) return false;

  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(message);
  } catch {
    return false;
  }

  // The nonce in the SIWE message must be the nonce from the active challenge.
  if (!challenge.includes(`nonce: ${parsed.nonce}`)) return false;

  // Verify the EIP-191 signature and recover the signing address.
  const { success, data } = await parsed.verify({
    signature,
    domain: parsed.domain,
    nonce: parsed.nonce,
  });
  if (!success || !data) return false;
  if (data.address.toLowerCase() !== address.toLowerCase()) return false;

  clearChallenge(address);
  return true;
}
