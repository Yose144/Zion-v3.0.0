import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import * as bip39 from 'bip39';

ed.hashes.sha512 = sha512;

const ZION_PREFIX = 'zion1';
const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';

function publicKeyToAddress(publicKey: Uint8Array): string {
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

async function main() {
  const mnemonic = process.env.ZION_WALLET_MNEMONIC!;
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const privateKey = seed.slice(0, 32);
  const publicKey = ed.getPublicKey(privateKey);
  const address = publicKeyToAddress(publicKey);
  const publicKeyHex = Buffer.from(publicKey).toString('hex');
  console.log('address', address);
  console.log('pubkey', publicKeyHex);

  const challengeRes = await fetch('https://auth.zionterranova.com/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chainType: 'zion-l1' }),
  });
  if (!challengeRes.ok) throw new Error(`challenge failed: ${challengeRes.status} ${await challengeRes.text()}`);
  const challenge = await challengeRes.json();
  console.log('challenge', challenge);

  const challengeBytes = new TextEncoder().encode(challenge.challenge);
  const signature = ed.sign(challengeBytes, privateKey);
  const signatureHex = Buffer.from(signature).toString('hex');

  const verifyRes = await fetch('https://auth.zionterranova.com/api/auth/verify/ed25519', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, publicKey: publicKeyHex, signature: signatureHex }),
  });
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`);
  const setCookie = verifyRes.headers.get('set-cookie');
  console.log('set-cookie', setCookie);
  const body = await verifyRes.json();
  console.log('verify body', body);
}

main().catch(e => { console.error(e); process.exit(1); });
