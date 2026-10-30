import { getPublicKey, sign as edSign, etc } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import { sha512 } from '@noble/hashes/sha512';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(etc.concatBytes(...msgs));

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function publicKeyToAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('Invalid public key length');
  const hash = ripemd160(sha256(publicKey));
  let data = '';
  for (const byte of hash) {
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

export interface ZionWallet {
  address: string;
  publicKey: string;
  privateKeySeed: string;
}

/** Derive a ZION address the same way OasisWeb signs into ZIS. The phrase is not stored. */
export function deriveWalletFromMnemonic(mnemonic: string): ZionWallet {
  const phrase = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(phrase, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const seed = mnemonicToSeedSync(phrase);
  const privateKeySeed = seed.slice(0, 32);
  const publicKeyRaw = getPublicKey(privateKeySeed);
  return {
    address: publicKeyToAddress(publicKeyRaw),
    publicKey: toHex(publicKeyRaw),
    privateKeySeed: toHex(privateKeySeed),
  };
}

/** Sign a UTF-8 challenge. Returns the 64-byte signature as lowercase hex. */
export function signMessage(privateKeySeed: string, message: string): string {
  const signature = edSign(new TextEncoder().encode(message), fromHex(privateKeySeed));
  return toHex(signature);
}
