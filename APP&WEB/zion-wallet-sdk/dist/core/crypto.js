/**
 * ZION Wallet Crypto — AES-256-GCM encryption + PBKDF2 key derivation.
 * Uses Node.js crypto module (works in Node 18+) and Web Crypto API for browsers.
 */
import { sha256 } from '@noble/hashes/sha2.js';
// Use Node.js crypto when available, otherwise Web Crypto API
let nodeCrypto = null;
try {
    if (typeof require !== 'undefined') {
        nodeCrypto = require('crypto');
    }
} catch (_a) {
    // Browser environment — use Web Crypto API fallback
}
/** Legacy PBKDF2 iteration count (v1.0.0 wallets). */
export const LEGACY_PBKDF2_ITERATIONS = 100000;
/** Current PBKDF2 iteration count (OWASP 2023 recommendation). */
export const CURRENT_PBKDF2_ITERATIONS = 600000;
function getRandomBytes(size) {
    if (nodeCrypto) {
        return new Uint8Array(nodeCrypto.randomBytes(size));
    }
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        return crypto.getRandomValues(new Uint8Array(size));
    }
    throw new Error('No secure random source available');
}
async function deriveKey(password, salt, iterations = CURRENT_PBKDF2_ITERATIONS) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        const derived = await crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt,
            iterations,
            hash: 'SHA-256',
        }, keyMaterial, 256);
        return new Uint8Array(derived);
    }
    // Node.js fallback
    if (nodeCrypto) {
        return new Uint8Array(nodeCrypto.pbkdf2Sync(password, Buffer.from(salt), iterations, 32, 'sha256'));
    }
    throw new Error('No PBKDF2 implementation available');
}
/**
 * Encrypt data with AES-256-GCM using the current PBKDF2 iteration count.
 */
export async function encrypt(data, password) {
    const salt = getRandomBytes(16);
    const iv = getRandomBytes(12);
    const key = await deriveKey(password, salt, CURRENT_PBKDF2_ITERATIONS);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoder.encode(data));
        const ciphertext = new Uint8Array(encrypted.slice(0, -16));
        const authTag = new Uint8Array(encrypted.slice(-16));
        return {
            ciphertext: Buffer.from(ciphertext).toString('hex'),
            salt: Buffer.from(salt).toString('hex'),
            iv: Buffer.from(iv).toString('hex'),
            authTag: Buffer.from(authTag).toString('hex'),
            iterations: CURRENT_PBKDF2_ITERATIONS,
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
            iterations: CURRENT_PBKDF2_ITERATIONS,
        };
    }
    throw new Error('No AES-GCM implementation available');
}
/**
 * Decrypt data encrypted with AES-256-GCM.
 * Automatically detects legacy payloads (missing `iterations` → 100k).
 */
export async function decrypt(payload, password) {
    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');
    const iterations = payload.iterations ?? LEGACY_PBKDF2_ITERATIONS;
    const key = await deriveKey(password, new Uint8Array(salt), iterations);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
        const encrypted = new Uint8Array(ciphertext.length + authTag.length);
        encrypted.set(ciphertext, 0);
        encrypted.set(authTag, ciphertext.length);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);
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
 * Re-encrypt a decrypted plaintext with the current (higher) iteration count.
 * Use this to migrate legacy wallets to stronger PBKDF2 after successful unlock.
 */
export async function upgradeEncryption(plaintext, password) {
    return encrypt(plaintext, password);
}
/**
 * Hash a password for storage (not for encryption — use encrypt/decrypt for that).
 * Uses SHA-256 for quick comparison. For secure password storage, use bcrypt/argon2.
 */
export function hashPassword(password) {
    return Buffer.from(sha256(new TextEncoder().encode(password))).toString('hex');
}
/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
//# sourceMappingURL=crypto.js.map