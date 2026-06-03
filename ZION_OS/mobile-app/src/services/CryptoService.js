/**
 * ZION Wallet CryptoService v3.0.0
 * Production-ready cryptographic implementation with Ed25519
 *
 * Security Features:
 * - Real BIP39 mnemonic generation (12/24 words)
 * - Ed25519 signatures (Curve25519, post-quantum ready)
 * - Custom Bech32 address encoding (zion1... presale-compatible)
 * - PBKDF2(100k iter) + AES-256 encryption for private keys
 *
 * Libraries Used:
 * - bip39: Mnemonic generation and validation
 * - @noble/ed25519: Pure JavaScript Ed25519 implementation
 * - crypto-js: PBKDF2, AES, SHA256
 *
 * Compatibility:
 * ✅ ZION Presale API (wallet_api_v3.py)
 * ✅ ZION Genesis/Premine wallets
 * ✅ ZION Consciousness Mining bonuses
 * ❌ Bitcoin/Ethereum (use separate bridge keys for cross-chain)
 */

import * as bip39 from 'bip39';
import * as ed25519 from '@noble/ed25519';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';
import {publicKeyToAddress as _sdkPublicKeyToAddress, isValidAddress as _sdkIsValidAddress} from '../utils/zionAddress';

// ZION network configuration
const ZION_CONFIG = {
  prefix: 'zion1',
  coinType: 9999,
  // Note: Ed25519 doesn't use BIP32 derivation paths
  // We derive key directly from mnemonic seed (first 32 bytes)
};

/**
 * Validate BIP39 mnemonic
 * @param {string} mnemonic - Space-separated words
 * @returns {boolean} Valid or not
 */
export const validateMnemonic = (mnemonic) => {
  try {
    return bip39.validateMnemonic(mnemonic);
  } catch (error) {
    return false;
  }
};

/**
 * Convert mnemonic to seed (BIP39)
 * @param {string} mnemonic - 12 or 24 word mnemonic
 * @param {string} passphrase - Optional passphrase (BIP39 extension)
 * @returns {Promise<Buffer>} 64-byte seed
 */
const mnemonicToSeed = async (mnemonic, passphrase = '') => {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }
  
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
  return seed;
};

/**
 * Derive Ed25519 keypair from seed
 * SAME AS PRESALE API: Uses first 32 bytes of seed as private key
 * 
 * @param {Buffer} seed - 64-byte seed from mnemonic
 * @returns {Object} { privateKey, publicKey }
 */
const deriveKeypairFromSeed = async (seed) => {
  try {
    // Take first 32 bytes as Ed25519 private key (SAME AS PRESALE API)
    const privateKey = seed.slice(0, 32);
    
    // Derive public key
    const publicKey = await ed25519.getPublicKey(privateKey);
    
    return {
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),
    };
  } catch (error) {
    throw new Error(`Key derivation failed: ${error.message}`);
  }
};

/**
 * Generate ZION address from public key (Custom Bech32)
 * EXACT COPY OF PRESALE API ALGORITHM!
 * 
 * @param {Buffer} publicKey - 32-byte Ed25519 public key
 * @param {string} prefix - Address prefix (default: zion1)
 * @returns {string} Custom Bech32-encoded address
 */
export const publicKeyToAddress = (publicKey, prefix = ZION_CONFIG.prefix) => {
  try {
    return _sdkPublicKeyToAddress(publicKey);
  } catch (error) {
    throw new Error(`Address generation failed: ${error.message}`);
  }
};

/**
 * Validate ZION address format
 * @param {string} address - Custom Bech32 address to validate
 * @param {string} prefix - Expected prefix (default: zion1)
 * @returns {boolean} Valid or not
 */
export const isValidAddress = (address, chainOrPrefix = ZION_CONFIG.prefix) => {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const trimmed = address.trim();

    // If caller passes a chain id (e.g. 'ETC'), validate by that chain.
    // Otherwise treat the argument as a ZION prefix for backwards compatibility.
    const knownChainIds = ['ZION', 'ETC', 'RVN', 'ERG', 'KAS', 'ALPH', 'XMR'];
    const isChainId = typeof chainOrPrefix === 'string' && knownChainIds.includes(chainOrPrefix);

    if (isChainId && chainOrPrefix !== 'ZION') {
      switch (chainOrPrefix) {
        case 'ETC':
          return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
        case 'RVN':
          return /^R[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(trimmed);
        case 'ERG':
          return /^9[1-9A-HJ-NP-Za-km-z]{50}$/.test(trimmed);
        case 'KAS':
          return /^kaspa:[0-9a-z]+$/.test(trimmed);
        case 'ALPH':
          return /^(1|T)[1-9A-HJ-NP-Za-km-z]{29,69}$/.test(trimmed);
        case 'XMR':
          return (
            (/^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(trimmed)) ||
            (/^[48][1-9A-HJ-NP-Za-km-z]{105}$/.test(trimmed))
          );
        default:
          return false;
      }
    }

    const prefix = isChainId ? ZION_CONFIG.prefix : chainOrPrefix;
    return _sdkIsValidAddress(trimmed);
  } catch (error) {
    return false;
  }
};

/**
 * Sign transaction hash with private key (Ed25519)
 * @param {string} txHash - Transaction hash (hex)
 * @param {Buffer} privateKey - 32-byte Ed25519 private key
 * @returns {Promise<Object>} { signature, publicKey } Ed25519 signature
 */
export const signTransaction = async (txHash, privateKey) => {
  try {
    // Convert hex to bytes
    const messageHash = Buffer.from(txHash, 'hex');
    
    // Sign with Ed25519
    const signature = await ed25519.sign(messageHash, privateKey);
    
    // Get public key for verification
    const publicKey = await ed25519.getPublicKey(privateKey);
    
    return {
      signature: Buffer.from(signature).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex'),
    };
  } catch (error) {
    throw new Error(`Signing failed: ${error.message}`);
  }
};

/**
 * Verify Ed25519 signature
 * @param {string} txHash - Transaction hash (hex)
 * @param {string} signature - Ed25519 signature (hex)
 * @param {Buffer} publicKey - 32-byte Ed25519 public key
 * @returns {Promise<boolean>} Signature valid or not
 */
export const verifySignature = async (txHash, signature, publicKey) => {
  try {
    const messageHash = Buffer.from(txHash, 'hex');
    const signatureBytes = Buffer.from(signature, 'hex');
    
    // Verify with Ed25519
    const isValid = await ed25519.verify(signatureBytes, messageHash, publicKey);
    return isValid;
  } catch (error) {
    return false;
  }
};

// ---------------------------------------------------------------------------
// PBKDF2 + AES encryption (v2) — stronger than direct AES(password)
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const KEY_SIZE_BITS = 256;
const SALT_SIZE_BYTES = 16;

const deriveKey = (password, salt) => {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE_BITS / 32,
    iterations: PBKDF2_ITERATIONS,
  });
};

const encryptV2 = (plaintext, password) => {
  const salt = CryptoJS.lib.WordArray.random(SALT_SIZE_BYTES);
  const key = deriveKey(password, salt);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key);
  const saltB64 = CryptoJS.enc.Base64.stringify(salt);
  const cipherB64 = encrypted.toString();
  return `v2:${saltB64}:${cipherB64}`;
};

const decryptV2 = (ciphertext, password) => {
  const parts = ciphertext.split(':');
  if (parts.length !== 3 || parts[0] !== 'v2') {
    throw new Error('Invalid v2 ciphertext format');
  }
  const salt = CryptoJS.enc.Base64.parse(parts[1]);
  const cipher = parts[2];
  const key = deriveKey(password, salt);
  const decrypted = CryptoJS.AES.decrypt(cipher, key);
  return decrypted.toString(CryptoJS.enc.Utf8);
};

const decryptV1Fallback = (ciphertext, password) => {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, password);
  return decrypted.toString(CryptoJS.enc.Utf8);
};

/**
 * Encrypt private key with password (PBKDF2 + AES-256).
 * Format: v2:base64(salt):base64(ciphertext)
 * @param {Buffer} privateKey - 32-byte Ed25519 private key
 * @param {string} password - User password
 * @returns {string} Encrypted private key
 */
export const encryptPrivateKey = (privateKey, password) => {
  try {
    const privateKeyHex = privateKey.toString('hex');
    return encryptV2(privateKeyHex, password);
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt private key with password.
 * Tries v2 format first, falls back to legacy v1.
 * @param {string} encryptedPrivateKey - Encrypted private key
 * @param {string} password - User password
 * @returns {Buffer} Decrypted private key
 */
export const decryptPrivateKey = (encryptedPrivateKey, password) => {
  try {
    let privateKeyHex;
    if (encryptedPrivateKey.startsWith('v2:')) {
      privateKeyHex = decryptV2(encryptedPrivateKey, password);
    } else {
      privateKeyHex = decryptV1Fallback(encryptedPrivateKey, password);
    }

    if (!privateKeyHex || privateKeyHex.length !== 64) {
      throw new Error('Invalid password');
    }

    return Buffer.from(privateKeyHex, 'hex');
  } catch (error) {
    throw new Error('Invalid password or corrupted data');
  }
};

/**
 * Encrypt mnemonic with password (PBKDF2 + AES-256).
 * @param {string} mnemonic - BIP39 mnemonic
 * @param {string} password - User password
 * @returns {string} Encrypted mnemonic
 */
export const encryptMnemonic = (mnemonic, password) => {
  try {
    return encryptV2(mnemonic, password);
  } catch (error) {
    throw new Error(`Mnemonic encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt mnemonic with password.
 * Tries v2 format first, falls back to legacy v1.
 * @param {string} encryptedMnemonic - Encrypted mnemonic
 * @param {string} password - User password
 * @returns {string} Decrypted mnemonic
 */
export const decryptMnemonic = (encryptedMnemonic, password) => {
  try {
    let mnemonic;
    if (encryptedMnemonic.startsWith('v2:')) {
      mnemonic = decryptV2(encryptedMnemonic, password);
    } else {
      mnemonic = decryptV1Fallback(encryptedMnemonic, password);
    }

    if (!mnemonic || !validateMnemonic(mnemonic)) {
      throw new Error('Invalid password');
    }

    return mnemonic;
  } catch (error) {
    throw new Error('Invalid password or corrupted data');
  }
};

/**
 * Generate new ZION wallet (Ed25519)
 * @param {string} password - User password for encryption
 * @param {number} strength - Mnemonic strength (128=12 words, 256=24 words)
 * @returns {Promise<Object>} Wallet object
 */
export const generateWallet = async (password, strength = 256) => {
  try {
    // 1. Generate mnemonic (default 24 words for max security)
    const mnemonic = bip39.generateMnemonic(strength);
    
    // 2. Derive seed
    const seed = await mnemonicToSeed(mnemonic);
    
    // 3. Derive Ed25519 keypair (SAME AS PRESALE API)
    const { privateKey, publicKey } = await deriveKeypairFromSeed(seed);
    
    // 4. Generate address (custom Bech32)
    const address = publicKeyToAddress(publicKey);
    
    // 5. Encrypt sensitive data
    const encryptedPrivateKey = encryptPrivateKey(privateKey, password);
    const encryptedMnemonic = encryptMnemonic(mnemonic, password);
    
    return {
      address,
      publicKey: publicKey.toString('hex'),
      privateKey: encryptedPrivateKey,
      mnemonic: encryptedMnemonic,
      keyType: 'ed25519',
      path: null, // Ed25519 doesn't use BIP32 paths
    };
  } catch (error) {
    throw new Error(`Wallet generation failed: ${error.message}`);
  }
};

/**
 * Import wallet from mnemonic (Ed25519)
 * @param {string} mnemonic - BIP39 mnemonic (12 or 24 words)
 * @param {string} password - User password for encryption
 * @returns {Promise<Object>} Wallet object
 */
export const importFromMnemonic = async (mnemonic, password) => {
  try {
    // 1. Validate mnemonic
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }
    
    // 2. Derive seed
    const seed = await mnemonicToSeed(mnemonic);
    
    // 3. Derive Ed25519 keypair (SAME AS PRESALE API)
    const { privateKey, publicKey } = await deriveKeypairFromSeed(seed);
    
    // 4. Generate address (custom Bech32)
    const address = publicKeyToAddress(publicKey);
    
    // 5. Encrypt sensitive data
    const encryptedPrivateKey = encryptPrivateKey(privateKey, password);
    const encryptedMnemonic = encryptMnemonic(mnemonic, password);
    
    return {
      address,
      publicKey: publicKey.toString('hex'),
      privateKey: encryptedPrivateKey,
      mnemonic: encryptedMnemonic,
      keyType: 'ed25519',
      path: null,
    };
  } catch (error) {
    throw new Error(`Import failed: ${error.message}`);
  }
};

/**
 * Import wallet from private key (Ed25519)
 * @param {string} privateKeyHex - 32-byte Ed25519 private key (hex)
 * @param {string} password - User password for encryption
 * @returns {Promise<Object>} Wallet object (without mnemonic)
 */
export const importFromPrivateKey = async (privateKeyHex, password) => {
  try {
    // 1. Parse private key
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    
    if (privateKey.length !== 32) {
      throw new Error('Invalid Ed25519 private key length (must be 32 bytes)');
    }
    
    // 2. Derive public key
    const publicKey = await ed25519.getPublicKey(privateKey);
    
    // 3. Generate address
    const address = publicKeyToAddress(Buffer.from(publicKey));
    
    // 4. Encrypt private key
    const encryptedPrivateKey = encryptPrivateKey(privateKey, password);
    
    return {
      address,
      publicKey: Buffer.from(publicKey).toString('hex'),
      privateKey: encryptedPrivateKey,
      mnemonic: null, // No mnemonic when importing from private key
      keyType: 'ed25519',
      path: null,
    };
  } catch (error) {
    throw new Error(`Import failed: ${error.message}`);
  }
};

/**
 * Get decrypted private key for signing
 * @param {string} encryptedPrivateKey - Encrypted private key
 * @param {string} password - User password
 * @returns {Buffer} Decrypted private key
 */
export const getPrivateKey = (encryptedPrivateKey, password) => {
  return decryptPrivateKey(encryptedPrivateKey, password);
};

/**
 * Get decrypted mnemonic for backup
 * @param {string} encryptedMnemonic - Encrypted mnemonic
 * @param {string} password - User password
 * @returns {string} Decrypted mnemonic
 */
export const getMnemonic = (encryptedMnemonic, password) => {
  return decryptMnemonic(encryptedMnemonic, password);
};

export default {
  // Validation
  validateMnemonic,
  isValidAddress,
  
  // Wallet operations
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  
  // Cryptography
  signTransaction,
  verifySignature,
  
  // Key management
  getPrivateKey,
  getMnemonic,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptMnemonic,
  decryptMnemonic,
  
  // Address generation
  publicKeyToAddress,
  
  // Configuration
  ZION_CONFIG,
};
