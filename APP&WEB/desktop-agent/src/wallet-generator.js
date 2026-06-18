// ZION Wallet Generator Module for Desktop Agent
// Ed25519 keypair generation + ZION address derivation

const crypto = require('crypto');
const bip39 = require('bip39');
const { sha256 } = require('@noble/hashes/sha2');
const { ripemd160 } = require('@noble/hashes/legacy');

const { randomBytes } = crypto;

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

function publicKeyToAddress(publicKey) {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${publicKey.length}`);
  }
  const sha = sha256(publicKey);
  const keyHash = ripemd160(sha);
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

function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false;
  const a = address.trim();
  if (!a.startsWith(ZION_PREFIX)) return false;
  if (a.length !== 44) return false;
  for (let i = 5; i < 44; i++) {
    if (!ZION_BASE32.includes(a[i])) return false;
  }
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

function getAddressType(address) {
  if (typeof address !== 'string') return 'invalid';
  const a = address.trim();
  if (!a) return 'invalid';
  if (a.startsWith(ZION_PREFIX)) {
    return isValidAddress(a) ? 'zion1' : 'invalid';
  }
  const legacyRegex = /^ZION[A-Z2-7]{20,60}$/;
  if (legacyRegex.test(a)) return 'legacy';
  return 'invalid';
}

class ZionWalletGenerator {
  /**
   * Generate new ZION wallet
   * @returns {Object} Wallet with address, privateKey, publicKey, mnemonic
   */
  static generateWallet() {
    // Generate BIP39 mnemonic (12 words)
    const mnemonic = bip39.generateMnemonic(128);
    
    // Derive seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // Generate Ed25519 keypair from seed (using first 32 bytes as private key seed)
    // Note: In production, use SLIP-0010 or similar for proper HD derivation
    const privateKeySeed = seed.slice(0, 32);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      publicKeyEncoding: { type: 'spki', format: 'der' },
      seed: privateKeySeed
    });

    // Extract raw public key (last 32 bytes of DER encoding)
    const pubKeyRaw = publicKey.slice(-32);
    
    // Derive canonical ZION address
    const address = this.deriveAddress(pubKeyRaw);
    
    // Export keys as hex
    const privateKeyHex = privateKey.toString('hex');
    const publicKeyHex = pubKeyRaw.toString('hex');
    
    return {
      address,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
      mnemonic,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Recover ZION wallet from mnemonic
   * @param {string} mnemonic - 12-word BIP39 mnemonic
   * @returns {Object} Wallet with address, privateKey, publicKey, mnemonic
   */
  static recoverWallet(mnemonic) {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Derive seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // Generate Ed25519 keypair from seed (using first 32 bytes as private key seed)
    const privateKeySeed = seed.slice(0, 32);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      publicKeyEncoding: { type: 'spki', format: 'der' },
      seed: privateKeySeed
    });

    // Extract raw public key (last 32 bytes of DER encoding)
    const pubKeyRaw = publicKey.slice(-32);
    
    // Derive canonical ZION address
    const address = this.deriveAddress(pubKeyRaw);
    
    // Export keys as hex
    const privateKeyHex = privateKey.toString('hex');
    const publicKeyHex = pubKeyRaw.toString('hex');
    
    return {
      address,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
      mnemonic,
      recoveredAt: new Date().toISOString()
    };
  }

  /**
   * Derive ZION address from public key (V3-compatible).
   *
   * Must match V3/L1/core/src/crypto.rs derive_address():
   *   1. SHA-256(pubkey) → RIPEMD-160 → 20 bytes
   *   2. Each byte → 2 base32 chars → 40 chars
   *   3. Truncate to 35 body chars
   *   4. Append 4-char checksum of "zion1" + body
   *   5. Result: "zion1" + body(35) + checksum(4) = 44 chars
   *
   * @param {Buffer} publicKey - Raw Ed25519 public key (32 bytes)
   * @returns {string} ZION address (44 chars)
   */
  static deriveAddress(publicKey) {
    return publicKeyToAddress(new Uint8Array(publicKey));
  }

  /**
   * Validate a zion1 address (format + checksum, matches V3 is_valid_address).
   * @param {string} address
   * @returns {boolean}
   */
  static isValidAddress(address) {
    return isValidAddress(address);
  }

  /**
   * Base32 encoding (RFC 4648)
   */
  static base32Encode(buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    // Pad to multiple of 8
    while (output.length % 8 !== 0) {
      output += '=';
    }

    return output;
  }

  /**
   * Generate 12-word mnemonic seed phrase
   * Uses standard BIP39 implementation
   */
  static generateMnemonic() {
    return bip39.generateMnemonic(128);
  }

  /**
   * Encrypt private key with password (AES-256-GCM)
   */
  static encryptPrivateKey(privateKeyHex, password) {
    if (!password || typeof password !== 'string' || password.length < 1) {
      throw new Error('Password is required for wallet encryption');
    }
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    
    // Derive key from password using PBKDF2
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(privateKeyHex, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    
    // Return encrypted data with metadata
    return {
      encrypted: encrypted.toString('hex'),
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt private key
   */
  static decryptPrivateKey(encryptedData, password) {
    const { encrypted, salt, iv, authTag } = encryptedData;
    
    // Derive key
    const key = crypto.pbkdf2Sync(
      password,
      Buffer.from(salt, 'hex'),
      100000,
      32,
      'sha256'
    );
    
    // Decrypt
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Validate ZION address format
   */
  static validateAddress(address) {
    return this.getAddressType(address) === 'zion1';
  }

  /**
   * Identify address type.
   * - zion1: canonical chain-compatible address
   * - legacy: old desktop-agent style (ZION...)
   * - invalid: unknown/invalid
   */
  static getAddressType(address) {
    if (typeof address !== 'string') return 'invalid';
    const a = address.trim();
    if (!a) return 'invalid';

    if (a.startsWith('zion1')) {
      if (a.length !== 44) return 'invalid';
      const data = a.slice(5);
      if (!/^[0-9a-z]{39}$/.test(data)) return 'invalid';
      return 'zion1';
    }

    // Legacy format (kept only for compatibility display)
    const legacyRegex = /^ZION[A-Z2-7]{20,60}$/;
    if (legacyRegex.test(a)) return 'legacy';

    return 'invalid';
  }
}

module.exports = ZionWalletGenerator;
