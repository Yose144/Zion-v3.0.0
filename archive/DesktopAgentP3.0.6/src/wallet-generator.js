// ZION Wallet Generator Module for Desktop Agent
// Ed25519 keypair generation + ZION address derivation

const crypto = require('crypto');
const bip39 = require('bip39');
const { sha256 } = require('@noble/hashes/sha2');
const { ripemd160 } = require('@noble/hashes/legacy');
const ed25519 = require('@noble/ed25519');
const { sha512 } = require('@noble/hashes/sha512');

// Wire up sync SHA-512 for @noble/ed25519 v3
ed25519.hashes.sha512 = sha512;

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

/**
 * Derive an Ed25519 keypair deterministically from a 32-byte seed.
 *
 * Uses @noble/ed25519 for the scalar→public-key math, then imports the
 * (seed, pubkey) pair into Node.js crypto as a JWK and exports the canonical
 * PKCS8 DER that the rest of the app expects.
 *
 * @param {Uint8Array} seed - 32-byte Ed25519 private seed
 * @returns {{privateKey: Buffer, publicKey: Buffer, publicKeyRaw: Buffer}}
 */
function keypairFromSeed(seed) {
  const seedBytes = new Uint8Array(seed);
  if (seedBytes.length !== 32) {
    throw new Error(`Invalid Ed25519 seed length: expected 32, got ${seedBytes.length}`);
  }

  const publicKeyRaw = ed25519.getPublicKey(seedBytes);

  function b64url(buf) {
    return Buffer.from(buf).toString('base64url');
  }

  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: b64url(seedBytes),
    x: b64url(publicKeyRaw)
  };

  const privateKeyObj = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const publicKeyObj = crypto.createPublicKey(privateKeyObj);

  return {
    privateKey: privateKeyObj.export({ type: 'pkcs8', format: 'der' }),
    publicKey: publicKeyObj.export({ type: 'spki', format: 'der' }),
    publicKeyRaw: Buffer.from(publicKeyRaw)
  };
}

class ZionWalletGenerator {
  /**
   * Generate new ZION wallet
   * @returns {Object} Wallet with address, privateKey, publicKey, mnemonic
   */
  static generateWallet() {
    // Generate BIP39 mnemonic (12 words)
    const mnemonic = bip39.generateMnemonic(128);

    // Derive seed from mnemonic and use the first 32 bytes as Ed25519 seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const privateKeySeed = seed.slice(0, 32);

    const { privateKey, publicKeyRaw } = keypairFromSeed(privateKeySeed);

    // Derive canonical ZION address
    const address = this.deriveAddress(publicKeyRaw);

    // Export keys as hex
    const privateKeyHex = privateKey.toString('hex');
    const publicKeyHex = publicKeyRaw.toString('hex');

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

    // Derive seed from mnemonic and use the first 32 bytes as Ed25519 seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const privateKeySeed = seed.slice(0, 32);

    const { privateKey, publicKeyRaw } = keypairFromSeed(privateKeySeed);

    // Derive canonical ZION address
    const address = this.deriveAddress(publicKeyRaw);

    // Export keys as hex
    const privateKeyHex = privateKey.toString('hex');
    const publicKeyHex = publicKeyRaw.toString('hex');

    return {
      address,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
      mnemonic,
      recoveredAt: new Date().toISOString()
    };
  }

  /**
   * Import ZION wallet from raw Ed25519 secret key (32 bytes).
   *
   * For premine/canonical wallets where you have the raw secret_key_hex
   * (e.g., Genesis Projects slot). Converts to PKCS8 DER format used by
   * the rest of the desktop agent.
   *
   * @param {string} secretKeyHex - 64-char hex string (32 bytes raw Ed25519 seed)
   * @returns {Object} Wallet with address, publicKey, privateKey (PKCS8 DER hex), importedAt
   */
  static importPrivateKey(secretKeyHex) {
    if (!secretKeyHex || typeof secretKeyHex !== 'string') {
      throw new Error('Secret key hex is required');
    }

    const cleanHex = secretKeyHex.trim().replace(/^0x/, '');
    if (cleanHex.length !== 64) {
      throw new Error(`Invalid secret key length: expected 64 hex chars (32 bytes), got ${cleanHex.length}`);
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
      throw new Error('Invalid secret key format: must be hex string');
    }

    const seedBytes = new Uint8Array(Buffer.from(cleanHex, 'hex'));

    // Derive keypair using the same method as recoverWallet
    const { privateKey, publicKeyRaw } = keypairFromSeed(seedBytes);

    // Derive canonical ZION address
    const address = this.deriveAddress(publicKeyRaw);

    // Export keys as hex
    const privateKeyHex = privateKey.toString('hex');
    const publicKeyHex = publicKeyRaw.toString('hex');

    return {
      address,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
      importedAt: new Date().toISOString()
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
      // Use isValidAddress which checks format + checksum (matches V3 core is_valid_address)
      return isValidAddress(a) ? 'zion1' : 'invalid';
    }

    // Legacy format (kept only for compatibility display)
    const legacyRegex = /^ZION[A-Z2-7]{20,60}$/;
    if (legacyRegex.test(a)) return 'legacy';

    return 'invalid';
  }
}

module.exports = ZionWalletGenerator;
