// Auth challenge + verification for both ZION L1 (Ed25519) and EVM (SIWE).

import * as ed from 'noble-ed25519';
import { randomBytes, createHash } from 'node:crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min

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

  // Derive expected address from pubkey (sha256 truncated) for cross-check
  const expectedAddr = 'zion1' + createHash('sha256').update(pub).digest('hex').slice(0, 38);
  if (expectedAddr !== address) return false;

  const ok = await ed.verify(sig, messageBytes, pub);
  if (ok) clearChallenge(address);
  return ok;
}

/**
 * Verify an EVM SIWE message + signature (EIP-191 personal_sign / EIP-712).
 * Caller is expected to have already parsed the SIWE message; we just check
 * the recovered address matches and the challenge nonce is known.
 */
export function verifySiwe(
  address: string,
  recoveredAddress: string,
  nonceFromMessage: string,
): boolean {
  const challenge = getChallenge(address);
  if (!challenge) return false;
  if (address.toLowerCase() !== recoveredAddress.toLowerCase()) return false;
  if (!challenge.includes(`nonce: ${nonceFromMessage}`)) return false;
  clearChallenge(address);
  return true;
}
