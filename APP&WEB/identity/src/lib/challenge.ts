// Auth challenge + verification for both ZION L1 (Ed25519) and EVM (SIWE).

import * as ed from 'noble-ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { blake2b } from '@noble/hashes/blake2b';
import { secp256k1 } from '@noble/curves/secp256k1';
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

  // Domain binding: the SIWE message must declare a ZION domain, otherwise a
  // signature captured on a phishing site (our nonce, their domain) could be
  // replayed here. Hosts are matched case-insensitively against the apex and
  // any subdomain; localhost is allowed for local development.
  const declaredDomain = (parsed.domain ?? '').toLowerCase();
  const domainOk =
    declaredDomain === 'zionterranova.com' ||
    declaredDomain.endsWith('.zionterranova.com') ||
    declaredDomain === 'localhost' ||
    /^localhost:\d+$/.test(declaredDomain) ||
    /^127\.0\.0\.1(:\d+)?$/.test(declaredDomain);
  if (!domainOk) return false;

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

// ── Native multichain wallet linking ────────────────────────────────────────
// The native wallet derives per-chain keys from the user's own BIP39 mnemonic
// (non-custodial). Linking proves on-chain key ownership per chain.

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str.trim()) {
    const d = B58_ALPHABET.indexOf(ch);
    if (d < 0) throw new Error(`invalid base58 char '${ch}'`);
    num = num * 58n + BigInt(d);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hex === '00' ? new Uint8Array(0) : Uint8Array.from(Buffer.from(hex, 'hex'));
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  const out = new Uint8Array(zeros + bytes.length);
  out.set(bytes, zeros);
  return out;
}

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  return [...hrp].map((c) => c.charCodeAt(0) >> 5)
    .concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));
}

/** BIP-173 bech32 encode of a segwit v0 program (P2WPKH). */
function bech32EncodeP2wpkh(prog20: Uint8Array): string {
  const hrp = 'bc';
  const data: number[] = [0]; // witness version 0
  // convertbits 8→5
  let acc = 0, bits = 0;
  for (const b of prog20) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) { bits -= 5; data.push((acc >> bits) & 31); }
  }
  if (bits) data.push((acc << (5 - bits)) & 31);
  const values = bech32HrpExpand(hrp).concat(data);
  const mod = bech32Polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const checksum = [0, 1, 2, 3, 4, 5].map((i) => (mod >> (5 * (5 - i))) & 31);
  return hrp + '1' + data.concat(checksum).map((d) => BECH32_ALPHABET[d]).join('');
}

/**
 * Verify a Solana link signature. A Solana address IS the base58-encoded
 * ed25519 public key — so the challenge signature verifies against the
 * address itself (no pubkey→address derivation needed).
 */
export async function verifySolana(
  address: string,
  signatureHex: string,
): Promise<boolean> {
  const challenge = getChallenge(address);
  if (!challenge) return false;
  let pub: Uint8Array;
  try {
    pub = b58decode(address);
    if (pub.length !== 32) return false;
  } catch {
    return false;
  }
  const ok = await ed.verify(
    Buffer.from(signatureHex, 'hex'),
    Buffer.from(challenge, 'utf8'),
    Buffer.from(pub),
  );
  if (ok) clearChallenge(address);
  return ok;
}

/**
 * Verify a Bitcoin link signature — custom proof-of-key scheme:
 *   digest = sha256("ZION-BTC-LINK-V1" ‖ 0x00 ‖ challenge_utf8)
 *   signature = 65-byte compact ECDSA (r‖s‖recid) over that digest.
 * The server recovers the pubkey, derives the P2WPKH (bc1q…) address and
 * compares it to the claimed one — real key ownership, no BIP-322 machinery.
 */
export async function verifyBitcoin(
  address: string,
  signatureHex: string,
): Promise<boolean> {
  const challenge = getChallenge(address);
  if (!challenge) return false;
  try {
    const sig = Buffer.from(signatureHex, 'hex');
    if (sig.length !== 65) return false;
    const recid = sig[64];
    if (recid > 3) return false;
    const digest = sha256(
      Buffer.concat([Buffer.from('ZION-BTC-LINK-V1'), Buffer.from([0]), Buffer.from(challenge, 'utf8')]),
    );
    const pub = secp256k1.Signature.fromCompact(sig.subarray(0, 64))
      .addRecoveryBit(recid)
      .recoverPublicKey(digest)
      .toRawBytes(true);
    const derived = bech32EncodeP2wpkh(ripemd160(sha256(pub)));
    if (derived !== address.trim()) return false;
    clearChallenge(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Quantus linking by ZION-key attestation. ML-DSA-87 has no JS implementation,
 * so the client proves ownership of the ZION key controlling the same mnemonic
 * by signing `challenge + "\nquantus:" + <qz address>` where the challenge was
 * issued for the ZION address. The qz address itself is ss58-189 validated.
 */
export async function verifyQuantusAttestation(
  zionAddress: string,
  zionPublicKey: string,
  signatureHex: string,
  qzAddress: string,
): Promise<boolean> {
  const challenge = getChallenge(zionAddress);
  if (!challenge) return false;
  if (!isValidQuantusAddress(qzAddress)) return false;
  const pub = Buffer.from(zionPublicKey, 'hex');
  if (publicKeyToAddress(Uint8Array.from(pub)) !== zionAddress) return false;
  const message = Buffer.from(`${challenge}\nquantus:${qzAddress}`, 'utf8');
  const ok = await ed.verify(Buffer.from(signatureHex, 'hex'), message, pub);
  if (ok) clearChallenge(zionAddress);
  return ok;
}

/** ss58 checksum validation for Quantus (prefix 189). */
export function isValidQuantusAddress(addr: string): boolean {
  try {
    const raw = b58decode(addr.trim());
    if (raw.length !== 36) return false;
    const prefix = ((raw[0] & 0x3f) << 2) | (raw[1] >> 6) | ((raw[1] & 0x3f) << 8);
    if (prefix !== 189) return false;
    const ctx = Buffer.concat([Buffer.from('SS58PRE'), Buffer.from(raw.subarray(0, 34))]);
    const checksum = blake2b(ctx, { dkLen: 64 });
    return raw[34] === checksum[0] && raw[35] === checksum[1];
  } catch {
    return false;
  }
}
