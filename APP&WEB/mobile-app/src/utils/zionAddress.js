import {sha256} from '@noble/hashes/sha2';
import {ripemd160} from '@noble/hashes/legacy';

const ZION_PREFIX_DEFAULT = 'zion1';
const ZION_BASE32_CHARS = '023456789acdefghjklmnpqrstuvwxyz';

/**
 * ZION custom address derivation (Python/Rust parity).
 *
 * Algorithm:
 * - sha256(public_key)
 * - ripemd160(sha256) => 20 bytes
 * - for each byte b emit 2 chars: chars[b % 32] + chars[floor(b/32) % 32]
 * - truncate to 39 chars
 * - prefix with 'zion1'
 */
export const publicKeyToZionAddress = (publicKeyBytes, prefix = ZION_PREFIX_DEFAULT) => {
  if (!publicKeyBytes) {
    throw new Error('publicKeyBytes is required');
  }

  const pk = publicKeyBytes instanceof Uint8Array ? publicKeyBytes : new Uint8Array(publicKeyBytes);

  const keyHash = ripemd160(sha256(pk)); // 20 bytes

  let addressData = '';
  for (const byte of keyHash) {
    addressData += ZION_BASE32_CHARS[byte % 32];
    addressData += ZION_BASE32_CHARS[Math.floor(byte / 32) % 32];
  }

  addressData = addressData.substring(0, 39);
  return `${prefix}${addressData}`;
};

export const isValidZionAddress = (address, prefix = ZION_PREFIX_DEFAULT) => {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const trimmed = address.trim();
  if (!trimmed.startsWith(prefix)) {
    return false;
  }

  // prefix (5 chars) + data (39 chars)
  if (trimmed.length !== prefix.length + 39) {
    return false;
  }

  const data = trimmed.substring(prefix.length);
  for (const c of data) {
    if (!ZION_BASE32_CHARS.includes(c)) {
      return false;
    }
  }

  return true;
};
