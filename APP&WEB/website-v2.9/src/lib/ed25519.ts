/**
 * @noble/ed25519 v3 requires the sha512 implementation to be injected
 * explicitly — the package ships no default. Any module that signs,
 * verifies or derives public keys must go through this wrapper so the
 * hashes are guaranteed to be set regardless of import order.
 *
 *   const ed = await import('@/lib/ed25519');
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

if (!ed.hashes.sha512) {
  ed.hashes.sha512 = sha512;
}
if (!ed.hashes.sha512Async) {
  ed.hashes.sha512Async = (msg: Uint8Array) => Promise.resolve(sha512(msg));
}

export * from '@noble/ed25519';
