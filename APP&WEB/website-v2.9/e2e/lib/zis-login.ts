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

export interface ZisCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  expires: number;
}

export async function loginWithMnemonic(mnemonic: string, zisUrl = 'https://auth.zionterranova.com'): Promise<ZisCookie> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const privateKey = seed.slice(0, 32);
  const publicKey = ed.getPublicKey(privateKey);
  const address = publicKeyToAddress(publicKey);

  const challengeRes = await fetch(`${zisUrl}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chainType: 'zion-l1' }),
  });
  if (!challengeRes.ok) throw new Error(`challenge failed: ${challengeRes.status}`);
  const { challenge, expiresInMs } = (await challengeRes.json()) as { challenge: string; expiresInMs: number };

  const signature = ed.sign(new TextEncoder().encode(challenge), privateKey);
  const publicKeyHex = Buffer.from(publicKey).toString('hex');
  const signatureHex = Buffer.from(signature).toString('hex');

  const verifyRes = await fetch(`${zisUrl}/api/auth/verify/ed25519`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, publicKey: publicKeyHex, signature: signatureHex }),
  });
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`);

  const setCookie = verifyRes.headers.get('set-cookie');
  if (!setCookie) throw new Error('no set-cookie header from ZIS verify');

  // Parse the zion_session cookie attributes.
  const match = setCookie.match(/zion_session=([^;]+)/);
  if (!match) throw new Error('zion_session cookie not found in set-cookie header');
  const value = match[1];

  const domainMatch = setCookie.match(/Domain=([^;]+)/);
  // Keep the leading dot so Playwright treats the cookie as valid for
  // all subdomains of zionterranova.com (app, auth, ...).
  const domain = domainMatch ? domainMatch[1] : '.zionterranova.com';
  const pathMatch = setCookie.match(/Path=([^;]+)/);
  const path = pathMatch ? pathMatch[1] : '/';
  const httpOnly = setCookie.toLowerCase().includes('httponly');
  const secure = setCookie.toLowerCase().includes('secure');
  const sameSiteMatch = setCookie.match(/SameSite=([^;]+)/i);
  const sameSite = (sameSiteMatch ? sameSiteMatch[1] : 'None') as 'Lax' | 'Strict' | 'None';

  const expiresMatch = setCookie.match(/Expires=([^;]+)/);
  let expires = Math.floor(Date.now() / 1000) + 86400 * 7;
  if (expiresMatch) {
    const d = new Date(expiresMatch[1]);
    if (!isNaN(d.getTime())) expires = Math.floor(d.getTime() / 1000);
  }

  return {
    name: 'zion_session',
    value,
    domain,
    path,
    httpOnly,
    secure,
    sameSite,
    expires,
  };
}
