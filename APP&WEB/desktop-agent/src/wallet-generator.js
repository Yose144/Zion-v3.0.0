// ZION Wallet Generator Module for Desktop Agent
// Ed25519 keypair generation + ZION address derivation

const crypto = require('crypto');
const bip39 = require('bip39');
const { randomBytes } = crypto;

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
   * Derive ZION address from public key
   * @param {Buffer} publicKey - Raw Ed25519 public key (32 bytes)
   * @returns {string} ZION address
   */
  static deriveAddress(publicKey) {
    // Create a zion1 address compatible with chain validation.
    // We deterministically map SHA256(pubkey) into the allowed bech32-like charset.
    const charset = '023456789acdefghjklmnpqrstuvwxyz';
    const hash = crypto.createHash('sha256').update(publicKey).digest();

    let data = '';
    let i = 0;
    while (data.length < 39) {
      const byte = hash[i % hash.length];
      data += charset[byte % 32];
      i++;
    }
    return 'zion1' + data;
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

    // Canonical chain format: zion1 + exactly 39 lowercase alphanumeric chars = 44 total
    // Matches L1 Rust validation: is_valid_zion1_address() accepts [0-9a-z] for body
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
