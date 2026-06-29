// Generate 5 DAO guardian keypairs
const crypto = require('crypto');
const bip39 = require('bip39');
const ed25519 = require('@noble/ed25519');
const { sha256 } = require('@noble/hashes/sha2');
const { ripemd160 } = require('@noble/hashes/legacy');
const { sha512 } = require('@noble/hashes/sha512');

ed25519.hashes.sha512 = sha512;

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

function publicKeyToAddress(publicKey) {
  const sha = sha256(publicKey);
  const keyHash = ripemd160(sha);
  let data = '';
  for (const byte of keyHash) {
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

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  console.log('# ── DAO Guardian Keys (generated 2026-06-29) ──');
  console.log('# DO NOT COMMIT private keys to git!');
  console.log('# Store mnemonics in F:\\ZION_V3_MAINNET_WALLETS.txt');
  console.log('');

  const guardians = [];
  for (let i = 1; i <= 5; i++) {
    const mnemonic = bip39.generateMnemonic(128);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const privateKeySeed = seed.slice(0, 32);
    const seedBytes = new Uint8Array(privateKeySeed);
    const publicKeyRaw = ed25519.getPublicKey(seedBytes);
    const address = publicKeyToAddress(publicKeyRaw);
    const pubKeyHex = bytesToHex(publicKeyRaw);

    console.log(`# Guardian ${i}:`);
    console.log(`#   Mnemonic: ${mnemonic}`);
    console.log(`#   Private seed: ${bytesToHex(seedBytes)}`);
    console.log(`[[guardians]]`);
    console.log(`name       = "guardian-${i}"`);
    console.log(`address    = "${address}"`);
    console.log(`public_key = "${pubKeyHex}"`);
    console.log('');

    guardians.push({ name: `guardian-${i}`, address, publicKey: pubKeyHex, mnemonic });
  }

  // Output JSON for backup
  console.log('# ── JSON backup (for F:\\ZION_V3_MAINNET_WALLETS.txt) ──');
  console.log(JSON.stringify(guardians, null, 2));
}

main().catch(console.error);
