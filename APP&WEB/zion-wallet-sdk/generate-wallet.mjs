#!/usr/bin/env node
/**
 * Quick wallet generator for SMOS payout setup.
 * Uses built zion-wallet-sdk from dist/.
 */

import { generateMnemonic, deriveKeypairFromMnemonic, publicKeyToAddress } from './dist/index.js';

async function main() {
  const mnemonic = generateMnemonic(256); // 24 words
  const { privateKey, publicKey } = await deriveKeypairFromMnemonic(mnemonic);
  const address = publicKeyToAddress(publicKey);

  const privateKeyHex = Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const publicKeyHex = Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ZION Wallet Generated — SAVE THIS SECURELY                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('Address:        ', address);
  console.log('Mnemonic (24w): ', mnemonic);
  console.log('Private Key:    ', privateKeyHex);
  console.log('Public Key:     ', publicKeyHex);
  console.log();
  console.log('⚠️  SAVE THE MNEMONIC — it is the ONLY way to recover funds!');
  console.log('⚠️  Never share the private key or mnemonic with anyone.');
}

main().catch(e => { console.error(e); process.exit(1); });
