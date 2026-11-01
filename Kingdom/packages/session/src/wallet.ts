/**
 * ZION peněženka pro přihlášení.
 *
 * Převzato z `apps/nirvana/src/lib/zionWallet.ts` (stejná derivace jako OasisWeb).
 * Fráze se nikdy neukládá a nikdy neopouští prohlížeč — do ZIS jde jen podpis.
 */
import { getPublicKey, sign as edSign, etc } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import { sha512 } from '@noble/hashes/sha512';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/* noble/ed25519 potřebuje synchronní SHA-512. */
etc.sha512Sync = (...messages: Uint8Array[]) => sha512(etc.concatBytes(...messages));

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Ed25519 veřejný klíč → `zion1…` adresa (ripemd160(sha256(pk)) + checksum). */
export function addressFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('Invalid public key length');

  const hash = ripemd160(sha256(publicKey));
  let data = '';
  for (const byte of hash) {
    data += ZION_BASE32[byte % 32];
    data += ZION_BASE32[Math.floor(byte / 32) % 32];
  }

  const body = data.slice(0, 35);
  const checksumHash = sha256(new TextEncoder().encode(ZION_PREFIX + body));
  let checksum = '';
  for (let i = 0; i < 2; i += 1) {
    const byte = checksumHash[i] ?? 0;
    checksum += ZION_BASE32[byte % 32];
    checksum += ZION_BASE32[Math.floor(byte / 32) % 32];
  }

  return ZION_PREFIX + body + checksum;
}

export interface ZionWallet {
  address: string;
  publicKey: string;
  /** hex 32 bajtů — jen v paměti prohlížeče, nikdy se neposílá */
  privateKeySeed: string;
}

/** Odvodí peněženku z 12/24 slov. Fráze se neukládá. */
export function deriveWalletFromMnemonic(mnemonic: string): ZionWallet {
  const phrase = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(phrase, wordlist)) {
    throw new Error('Neplatná fráze');
  }

  const seed = mnemonicToSeedSync(phrase);
  const privateKeySeed = seed.slice(0, 32);
  const publicKeyRaw = getPublicKey(privateKeySeed);

  return {
    address: addressFromPublicKey(publicKeyRaw),
    publicKey: toHex(publicKeyRaw),
    privateKeySeed: toHex(privateKeySeed),
  };
}

/** Podepíše UTF-8 text. Vrací 64bajtový podpis jako hex. */
export function signMessage(privateKeySeed: string, message: string): string {
  return toHex(edSign(new TextEncoder().encode(message), fromHex(privateKeySeed)));
}

/** Je fráze validní? Pro okamžitou zpětnou vazbu ve formuláři. */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim().replace(/\s+/g, ' '), wordlist);
}
