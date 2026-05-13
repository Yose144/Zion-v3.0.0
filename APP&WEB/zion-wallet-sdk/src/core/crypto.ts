/**
 * ZION Wallet Crypto — AES-256-GCM encryption + PBKDF2 key derivation.
 * Uses Node.js crypto module (works in Node 18+) and Web Crypto API for browsers.
 */

import { sha256 } from '@noble/hashes/sha2.js';

// Use Node.js crypto when available, otherwise Web Crypto API
const nodeCrypto = typeof require !== 'undefined' ? require('crypto') : null;

interface EncryptedPayload {
  ciphertext: string; // hex
  salt: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

function getRandomBytes(size: number): Uint8Array {
  if (nodeCrypto) {
    return new Uint8Array(nodeCrypto.randomBytes(size));
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint8Array(size));
  }
  throw new Error('No secure random source available');
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Web Crypto API — cast to any to work around TS 5.3 DOM lib strict typing
    const encoder = new TextEncoder();
    const keyMaterial = await (crypto.subtle.importKey as any)(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derived = await (crypto.subtle.deriveBits as any)(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return new Uint8Array(derived);
  }

  // Node.js fallback
  if (nodeCrypto) {
    return new Uint8Array(
      nodeCrypto.pbkdf2Sync(password, Buffer.from(salt), 100000, 32, 'sha256')
    );
  }

  throw new Error('No PBKDF2 implementation available');
}

/**
 * Encrypt data with AES-256-GCM.
 */
export async function encrypt(data: string, password: string): Promise<EncryptedPayload> {
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveKey(password, salt);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await (crypto.subtle.importKey as any)('raw', key, 'AES-GCM', false, ['encrypt']);
    const encoder = new TextEncoder();
    const encrypted = await (crypto.subtle.encrypt as any)(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(data)
    );
    const ciphertext = new Uint8Array(encrypted.slice(0, -16));
    const authTag = new Uint8Array(encrypted.slice(-16));
    return {
      ciphertext: Buffer.from(ciphertext).toString('hex'),
      salt: Buffer.from(salt).toString('hex'),
      iv: Buffer.from(iv).toString('hex'),
      authTag: Buffer.from(authTag).toString('hex'),
    };
  }

  // Node.js fallback
  if (nodeCrypto) {
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv));
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString('hex'),
      salt: Buffer.from(salt).toString('hex'),
      iv: Buffer.from(iv).toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  throw new Error('No AES-GCM implementation available');
}

/**
 * Decrypt data encrypted with AES-256-GCM.
 */
export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  const salt = Buffer.from(payload.salt, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');
  const key = await deriveKey(password, new Uint8Array(salt));

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await (crypto.subtle.importKey as any)('raw', key, 'AES-GCM', false, ['decrypt']);
    const encrypted = new Uint8Array(ciphertext.length + authTag.length);
    encrypted.set(ciphertext, 0);
    encrypted.set(authTag, ciphertext.length);

    const decrypted = await (crypto.subtle.decrypt as any)(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  }

  // Node.js fallback
  if (nodeCrypto) {
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv));
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  throw new Error('No AES-GCM implementation available');
}

/**
 * Hash a password for storage (not for encryption — use encrypt/decrypt for that).
 * Uses SHA-256 for quick comparison. For secure password storage, use bcrypt/argon2.
 */
export function hashPassword(password: string): string {
  return Buffer.from(sha256(new TextEncoder().encode(password))).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
