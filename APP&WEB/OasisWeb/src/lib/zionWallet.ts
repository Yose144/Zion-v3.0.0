import { getPublicKey, etc } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import { sha512 } from '@noble/hashes/sha512';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(etc.concatBytes(...msgs));

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface ZionWallet {
  address: string;
  publicKey: string;
  privateKeySeed: string;
  mnemonic: string;
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

export function isValidZionAddress(address: string): boolean {
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

export function getAddressType(address: string): 'zion1' | 'legacy' | 'pilgrim' | 'invalid' {
  const a = (address ?? '').trim();
  if (!a) return 'invalid';
  if (a.startsWith('pilgrim-')) return 'pilgrim';
  if (a.startsWith(ZION_PREFIX)) return isValidZionAddress(a) ? 'zion1' : 'invalid';
  if (/^ZION[A-Z2-7]{20,60}$/.test(a)) return 'legacy';
  return 'invalid';
}

export function generateZionWallet(): ZionWallet {
  const mnemonic = generateMnemonic(wordlist, 128);
  return deriveWalletFromMnemonic(mnemonic);
}

export function deriveWalletFromMnemonic(mnemonic: string): ZionWallet {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const seed = mnemonicToSeedSync(mnemonic);
  const privateKeySeed = seed.slice(0, 32);
  const publicKeyRaw = getPublicKey(privateKeySeed);
  const address = publicKeyToAddress(publicKeyRaw);
  return {
    address,
    publicKey: toHex(publicKeyRaw),
    privateKeySeed: toHex(privateKeySeed),
    mnemonic,
  };
}

export function validatePilgrimOrZionAddress(address: string): boolean {
  const type = getAddressType(address);
  return type === 'zion1' || type === 'pilgrim' || type === 'legacy';
}
