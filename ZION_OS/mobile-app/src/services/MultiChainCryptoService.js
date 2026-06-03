/**
 * MultiChainCryptoService
 *
 * Plnohodnotné (non-watch-only) peněženky pro:
 * - BTC (BIP84 bech32 P2WPKH)
 * - ETH (BIP44)
 * - TRON (BIP44)
 * - SOL (SLIP-0010 Ed25519, m/44'/501'/0'/0')
 * - XLM (SLIP-0010 Ed25519, m/44'/148'/0')
 *
 * Poznámka: ZION používá vlastní CryptoService (Ed25519 + custom address).
 */

import * as bip39 from 'bip39';
import * as ed25519 from '@noble/ed25519';
import * as secp from '@noble/secp256k1';
import {HDKey} from '@scure/bip32';
import {hmac} from '@noble/hashes/hmac';
import {sha256, sha512} from '@noble/hashes/sha2';
import {ripemd160} from '@noble/hashes/legacy';
import {keccak_256} from '@noble/hashes/sha3';
import bs58 from 'bs58';
import bs58check from 'bs58check';
import {bech32} from 'bech32';
import {Buffer} from 'buffer';
import {Keypair as StellarKeypair} from 'stellar-base';

import {CHAIN_IDS} from '../constants/chains';
import CryptoService, {
  encryptPrivateKey,
  encryptMnemonic,
  decryptPrivateKey,
  decryptMnemonic,
} from './CryptoService';

const HARDENED_OFFSET = 0x80000000;

const normalizeMnemonic = (mnemonic) => mnemonic.trim().replace(/\s+/g, ' ');

const hash160 = (bytes) => ripemd160(sha256(bytes));

const uint32BE = (i) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(i >>> 0, 0);
  return b;
};

// ============ SLIP-0010 ed25519 (hardened-only) ============

const slip10Master = (seed) => {
  const I = hmac(sha512, new TextEncoder().encode('ed25519 seed'), seed);
  return {
    key: Buffer.from(I.slice(0, 32)),
    chainCode: Buffer.from(I.slice(32, 64)),
  };
};

const slip10DeriveHardened = ({key, chainCode}, index) => {
  const data = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from(key),
    uint32BE((index | HARDENED_OFFSET) >>> 0),
  ]);

  const I = hmac(sha512, Buffer.from(chainCode), data);
  return {
    key: Buffer.from(I.slice(0, 32)),
    chainCode: Buffer.from(I.slice(32, 64)),
  };
};

const deriveEd25519Slip10 = async (mnemonic, path) => {
  const normalized = normalizeMnemonic(mnemonic);
  if (!bip39.validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic');
  }

  const seed = await bip39.mnemonicToSeed(normalized);
  let node = slip10Master(seed);

  // path like m/44'/501'/0'/0'
  const parts = path
    .split('/')
    .slice(1)
    .filter(Boolean)
    .map((p) => {
      if (!p.endsWith("'")) {
        throw new Error('Ed25519 derivation requires hardened path segments');
      }
      return parseInt(p.slice(0, -1), 10);
    });

  for (const idx of parts) {
    node = slip10DeriveHardened(node, idx);
  }

  return node.key; // 32 bytes seed for ed25519
};

// ============ secp256k1 BIP32/BIP44 ============

const deriveSecp256k1PrivateKey = async (mnemonic, path) => {
  const normalized = normalizeMnemonic(mnemonic);
  if (!bip39.validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic');
  }

  const seed = await bip39.mnemonicToSeed(normalized);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(path);

  if (!child.privateKey) {
    throw new Error('Failed to derive private key');
  }

  return Buffer.from(child.privateKey);
};

// ============ Address encoders ============

const ethAddressFromPrivateKey = (privateKey) => {
  const pub = secp.getPublicKey(privateKey, false); // 65 bytes
  const hash = keccak_256(pub.slice(1));
  const addr = Buffer.from(hash.slice(-20));
  return `0x${addr.toString('hex')}`;
};

const tronAddressFromPrivateKey = (privateKey) => {
  const pub = secp.getPublicKey(privateKey, false);
  const hash = keccak_256(pub.slice(1));
  const addr20 = Buffer.from(hash.slice(-20));
  const tronBytes = Buffer.concat([Buffer.from([0x41]), addr20]);
  return bs58check.encode(tronBytes);
};

const btcBech32AddressFromPrivateKey = (privateKey) => {
  const pub = secp.getPublicKey(privateKey, true); // compressed
  const program = Buffer.from(hash160(pub)); // 20 bytes
  const words = bech32.toWords(program);
  // segwit v0: prepend witness version 0
  return bech32.encode('bc', [0, ...words]);
};

const solAddressFromPrivateKey = async (privateKey) => {
  const pub = await ed25519.getPublicKey(privateKey);
  return bs58.encode(Buffer.from(pub));
};

const xlmKeypairFromSeed = (seed32) => {
  // Stellar ed25519 seed is 32 bytes
  return StellarKeypair.fromRawEd25519Seed(Uint8Array.from(seed32));
};

// ============ Public API ============

export const validateMnemonic = (mnemonic) => {
  try {
    return bip39.validateMnemonic(normalizeMnemonic(mnemonic));
  } catch {
    return false;
  }
};

export const generateWallet = async (chainId, password, strength = 256) => {
  if (chainId === CHAIN_IDS.ZION) {
    return CryptoService.generateWallet(password, strength);
  }

  const mnemonic = bip39.generateMnemonic(strength);
  return importFromMnemonic(chainId, mnemonic, password);
};

export const importFromMnemonic = async (chainId, mnemonic, password) => {
  const normalized = normalizeMnemonic(mnemonic);
  if (!validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic');
  }

  let privateKey;
  let publicKeyHex;
  let address;
  let path;
  let keyType;

  if (chainId === CHAIN_IDS.BTC) {
    path = "m/84'/0'/0'/0/0";
    keyType = 'secp256k1';
    privateKey = await deriveSecp256k1PrivateKey(normalized, path);
    publicKeyHex = Buffer.from(secp.getPublicKey(privateKey, true)).toString('hex');
    address = btcBech32AddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.ETH) {
    path = "m/44'/60'/0'/0/0";
    keyType = 'secp256k1';
    privateKey = await deriveSecp256k1PrivateKey(normalized, path);
    publicKeyHex = Buffer.from(secp.getPublicKey(privateKey, true)).toString('hex');
    address = ethAddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.TRX) {
    path = "m/44'/195'/0'/0/0";
    keyType = 'secp256k1';
    privateKey = await deriveSecp256k1PrivateKey(normalized, path);
    publicKeyHex = Buffer.from(secp.getPublicKey(privateKey, true)).toString('hex');
    address = tronAddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.SOL) {
    path = "m/44'/501'/0'/0'";
    keyType = 'ed25519';
    privateKey = await deriveEd25519Slip10(normalized, path);
    publicKeyHex = Buffer.from(await ed25519.getPublicKey(privateKey)).toString('hex');
    address = await solAddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.XLM) {
    path = "m/44'/148'/0'";
    keyType = 'ed25519';
    privateKey = await deriveEd25519Slip10(normalized, path);
    const kp = xlmKeypairFromSeed(privateKey);
    publicKeyHex = Buffer.from(kp.rawPublicKey()).toString('hex');
    address = kp.publicKey();
  } else {
    throw new Error('Unsupported chain for full wallet');
  }

  const encryptedPrivateKey = encryptPrivateKey(Buffer.from(privateKey), password);
  const encryptedMnemonic = encryptMnemonic(normalized, password);

  return {
    address,
    publicKey: publicKeyHex,
    privateKey: encryptedPrivateKey,
    mnemonic: encryptedMnemonic,
    keyType,
    path,
  };
};

export const importFromPrivateKey = async (chainId, privateKeyInput, password) => {
  if (chainId === CHAIN_IDS.ZION) {
    // ZION expects 32-byte hex
    return CryptoService.importFromPrivateKey(privateKeyInput, password);
  }

  const trimmed = (privateKeyInput || '').trim();

  let privateKey;
  let publicKeyHex;
  let address;
  let path = null;
  let keyType;

  if (chainId === CHAIN_IDS.BTC) {
    keyType = 'secp256k1';
    privateKey = Buffer.from(trimmed.replace(/^0x/i, ''), 'hex');
    if (privateKey.length !== 32) {
      throw new Error('Invalid BTC private key (expected 32-byte hex)');
    }
    publicKeyHex = Buffer.from(secp.getPublicKey(privateKey, true)).toString('hex');
    address = btcBech32AddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.ETH) {
    keyType = 'secp256k1';
    privateKey = Buffer.from(trimmed.replace(/^0x/i, ''), 'hex');
    if (privateKey.length !== 32) {
      throw new Error('Invalid ETH private key (expected 32-byte hex)');
    }
    publicKeyHex = Buffer.from(secp.getPublicKey(privateKey, true)).toString('hex');
    address = ethAddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.TRX) {
    keyType = 'secp256k1';
    privateKey = Buffer.from(trimmed.replace(/^0x/i, ''), 'hex');
    if (privateKey.length !== 32) {
      throw new Error('Invalid TRON private key (expected 32-byte hex)');
    }
    publicKeyHex = Buffer.from(secp.getPublicKey(privateKey, true)).toString('hex');
    address = tronAddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.SOL) {
    keyType = 'ed25519';
    privateKey = Buffer.from(trimmed, 'hex');
    if (privateKey.length !== 32) {
      throw new Error('Invalid SOL private key (expected 32-byte hex seed)');
    }
    publicKeyHex = Buffer.from(await ed25519.getPublicKey(privateKey)).toString('hex');
    address = await solAddressFromPrivateKey(privateKey);
  } else if (chainId === CHAIN_IDS.XLM) {
    keyType = 'ed25519';

    // Accept Stellar secret seed (S...) or 32-byte hex
    if (/^S[0-9A-Z]{55}$/.test(trimmed)) {
      const kp = StellarKeypair.fromSecret(trimmed);
      privateKey = Buffer.from(kp.rawSecretKey());
      publicKeyHex = Buffer.from(kp.rawPublicKey()).toString('hex');
      address = kp.publicKey();
    } else {
      privateKey = Buffer.from(trimmed, 'hex');
      if (privateKey.length !== 32) {
        throw new Error('Invalid XLM seed (expected S... or 32-byte hex)');
      }
      const kp = xlmKeypairFromSeed(privateKey);
      publicKeyHex = Buffer.from(kp.rawPublicKey()).toString('hex');
      address = kp.publicKey();
    }
  } else {
    throw new Error('Unsupported chain for full wallet');
  }

  const encryptedPrivateKey = encryptPrivateKey(Buffer.from(privateKey), password);

  return {
    address,
    publicKey: publicKeyHex,
    privateKey: encryptedPrivateKey,
    mnemonic: null,
    keyType,
    path,
  };
};

export const getPrivateKey = (encryptedPrivateKey, password) => {
  return decryptPrivateKey(encryptedPrivateKey, password);
};

export const getMnemonic = (encryptedMnemonic, password) => {
  return decryptMnemonic(encryptedMnemonic, password);
};

export const signMessageHex = async (chainId, messageHex, privateKey) => {
  const msg = Buffer.from(messageHex.replace(/^0x/i, ''), 'hex');

  if (chainId === CHAIN_IDS.ZION || chainId === CHAIN_IDS.SOL || chainId === CHAIN_IDS.XLM) {
    const sig = await ed25519.sign(msg, privateKey);
    return Buffer.from(sig).toString('hex');
  }

  if (chainId === CHAIN_IDS.BTC || chainId === CHAIN_IDS.ETH || chainId === CHAIN_IDS.TRX) {
    const [sig, recid] = await secp.sign(msg, privateKey, {recovered: true, der: false});
    // 64-byte compact + recovery id
    return `${Buffer.from(sig).toString('hex')}${recid.toString(16).padStart(2, '0')}`;
  }

  throw new Error('Unsupported chain');
};

export default {
  validateMnemonic,
  generateWallet,
  importFromMnemonic,
  importFromPrivateKey,
  getPrivateKey,
  getMnemonic,
  signMessageHex,
};
