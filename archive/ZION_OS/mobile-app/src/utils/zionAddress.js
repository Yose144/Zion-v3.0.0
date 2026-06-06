/**
 * ZION Address Utilities (SDK-backed, V3-compatible).
 * Re-exports from zion-wallet-sdk for consistent address derivation + checksum.
 */

import { publicKeyToAddress, isValidAddress } from 'zion-wallet-sdk';

export { publicKeyToAddress, isValidAddress };

/**
 * Backward-compat alias used by some legacy screens.
 * @deprecated Use isValidAddress from zion-wallet-sdk directly.
 */
export const isValidZionAddress = isValidAddress;
