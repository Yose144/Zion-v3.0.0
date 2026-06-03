#!/usr/bin/env node
/**
 * Quick wallet generator for SMOS payout setup.
 * Uses zion-wallet-sdk from the repo.
 */

import { generateMnemonic, mnemonicToSeedSync } from 'bip39';
import { getPublicKey } from '@noble/ed25519';
import { sha3_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

const ZION_BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function deriveAddress(publicKey) {
  const prefix = 'zion1';
  const hash = sha3_256(publicKey);
  const addrBody = encodeBase32(hash.slice(0, 20));
  const checksum = computeChecksum(prefix, addrBody);
  return prefix + addrBody + checksum;
}

function encodeBase32(data) {
  let out = '';
  let bits = 0;
  let val = 0;
  for (const b of data) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ZION_BASE32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ZION_BASE32[(val << (5 - bits)) & 31];
  }
  return out;
}

function computeChecksum(prefix, body) {
  const combined = new TextEncoder().encode(prefix + body);
  const hash = sha3_256(combined);
  let checksumVal = 0;
  for (let i = 0; i < 10; i++) {
    checksumVal = (checksumVal << 8) | hash[i];
  }
  let cs = '';
  for (let i = 0; i < 5; i++) {
    cs = ZION_BASE32[checksumVal & 31] + cs;
    checksumVal >>>= 5;
  }
  return cs;
}

function generateWallet() {
  const mnemonic = generateMnemonic(256); // 24 words
  const seed = mnemonicToSeedSync(mnemonic);
  const sk = seed.slice(0, 32);
  const pk = getPublicKey(sk);
  const address = deriveAddress(pk);

  return {
    mnemonic,
    address,
    privateKeyHex: bytesToHex(sk),
    publicKeyHex: bytesToHex(pk),
  };
}

const wallet = generateWallet();

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  ZION Wallet Generated — SAVE THIS SECURELY                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log();
console.log('Address:        ', wallet.address);
console.log('Mnemonic (24w): ', wallet.mnemonic);
console.log('Private Key:    ', wallet.privateKeyHex);
console.log('Public Key:     ', wallet.publicKeyHex);
console.log();
console.log('⚠️  SAVE THE MNEMONIC — it is the ONLY way to recover funds!');
console.log('⚠️  Never share the private key or mnemonic with anyone.');
