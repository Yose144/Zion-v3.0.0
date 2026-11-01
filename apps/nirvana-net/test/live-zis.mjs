#!/usr/bin/env node
/**
 * Živý E2E test chatu se **skutečnou ZIS session**.
 *
 * 1. vygeneruje dočasný Ed25519 klíč (nic se nikam neukládá),
 * 2. projde ZIS challenge → podpis → verify a získá cookie `zion_session`,
 * 3. nastaví displayName, aby šlo poznat, že jméno opravdu přišlo ze serveru,
 * 4. připojí se na `wss://nirvana.zionterranova.com/net` a odešle zprávu,
 *    kterou musí vidět host bez přihlášení,
 * 5. **účet zase smaže** (challenge → podpis → DELETE /api/auth/me).
 *
 * Test potřebuje projít ZIS rate limitem (30/min) — po sobě jdoucí běhy
 * proto chvíli počkají.
 */

import { randomBytes } from 'node:crypto';
import { etc, getPublicKey, sign } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { sha512 } from '@noble/hashes/sha512';
import { ripemd160 } from '@noble/hashes/legacy';
import { WebSocket } from 'ws';

// @noble/ed25519 v2 potřebuje sync SHA-512 (stejně jako `apps/nirvana/src/lib/zionWallet.ts`)
etc.sha512Sync = (...messages) => sha512(etc.concatBytes(...messages));

const AUTH = process.env.ZIS_ORIGIN ?? 'https://auth.zionterranova.com';
const NET = process.env.NET_URL ?? 'wss://nirvana.zionterranova.com/net';
const ORIGIN = process.env.NET_ORIGIN ?? 'https://nirvana.zionterranova.com';
const PREFIX = 'zion1';
const ALPHABET = '023456789acdefghjklmnpqrstuvwxyz';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function addressFromPublicKey(publicKey) {
  const hash = ripemd160(sha256(publicKey));
  let data = '';
  for (const byte of hash) {
    data += ALPHABET[byte % 32];
    data += ALPHABET[Math.floor(byte / 32) % 32];
  }
  const body = data.slice(0, 35);
  const check_ = sha256(new TextEncoder().encode(PREFIX + body));
  let checksum = '';
  for (let i = 0; i < 2; i++) {
    checksum += ALPHABET[check_[i] % 32];
    checksum += ALPHABET[Math.floor(check_[i] / 32) % 32];
  }
  return PREFIX + body + checksum;
}

async function api(path, options = {}) {
  const response = await fetch(`${AUTH}${path}`, options);
  const cookies = response.headers.getSetCookie?.() ?? [];
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body, cookies };
}

async function challengeAndSign(address, seed) {
  const challenge = await api('/api/auth/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, chainType: 'zion-l1' }),
  });
  if (challenge.status !== 200) throw new Error(`challenge ${challenge.status}: ${JSON.stringify(challenge.body)}`);
  const signature = hex(await sign(new TextEncoder().encode(challenge.body.challenge), seed));
  return signature;
}

function connect(cookie) {
  const socket = new WebSocket(NET, {
    headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
  });
  socket.on('error', () => {});
  const inbox = [];
  socket.on('message', (data) => inbox.push(JSON.parse(data.toString())));
  const opened = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  opened.catch(() => {});
  return {
    socket,
    inbox,
    opened,
    send: (m) => socket.send(JSON.stringify(m)),
    async waitFor(match, ms = 8000) {
      const started = Date.now();
      for (;;) {
        const found = [...inbox].reverse().find(match);
        if (found) return found;
        if (Date.now() - started > ms) throw new Error('timeout waiting for message');
        await new Promise((r) => setTimeout(r, 60));
      }
    },
    close: () => socket.close(),
  };
}

const seed = randomBytes(32);
const publicKey = await getPublicKey(seed);
const address = addressFromPublicKey(publicKey);
console.log(`\n== živý ZIS test (${address.slice(0, 12)}…) ==`);

let cookieHeader = null;
const displayName = `Test Poutník ${address.slice(-4)}`;

try {
  // ── 1) přihlášení ────────────────────────────────────────────────────
  const signature = await challengeAndSign(address, seed);
  const verified = await api('/api/auth/verify/ed25519', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, publicKey: hex(publicKey), signature }),
  });
  check('ZIS přihlášení', verified.status === 200 && Boolean(verified.cookies.length),
    `${verified.status} ${JSON.stringify(verified.body)}`);
  cookieHeader = verified.cookies.map((c) => c.split(';')[0]).join('; ');
  const userId = verified.body?.user?.id;
  check('ZIS vrátil uživatele', typeof userId === 'string', JSON.stringify(verified.body?.user));

  // ── 2) jméno do profilu (důkaz, že jméno jde ze serveru) ────────────
  const patched = await api('/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: cookieHeader },
    body: JSON.stringify({ displayName }),
  });
  check('displayName nastaven', patched.status === 200, `${patched.status} ${JSON.stringify(patched.body)}`);

  // ── 2b) avatar z rosteru (ZIS musí avatarId přijmout a vydat zpět) ──
  const AVATAR_ID = 42;
  const avatarPatched = await api('/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: cookieHeader },
    body: JSON.stringify({
      avatar3d: { avatarId: AVATAR_ID, callsign: 'Test Avatar', bodyType: 'standard' },
    }),
  });
  check('avatar uložen do ZIS', avatarPatched.status === 200,
    `${avatarPatched.status} ${JSON.stringify(avatarPatched.body)}`);
  const me = await api('/api/auth/me', { headers: { cookie: cookieHeader } });
  check('ZIS vrací avatarId', me.body?.avatar3d?.avatarId === AVATAR_ID,
    JSON.stringify(me.body?.avatar3d));

  // ── 3) host (bez cookie) poslouchá ──────────────────────────────────
  const guest = connect(null);
  await guest.opened;
  guest.send({ t: 'hello', proto: 3 });
  const guestWelcome = await guest.waitFor((m) => m.t === 'welcome');
  check('host: role guest', guestWelcome.you.role === 'guest');

  // ── 4) přihlášený hráč ──────────────────────────────────────────────
  const player = connect(cookieHeader);
  await player.opened;
  player.send({ t: 'hello', proto: 3 });
  const welcome = await player.waitFor((m) => m.t === 'welcome');
  check('zis: role zis', welcome.you.role === 'zis', welcome.you.role);
  // callsign z `avatar3d` má přednost před displayName (tak to dělá ZIS i web)
  check('zis: jméno = callsign z avatar3d', welcome.you.name === 'Test Avatar', welcome.you.name);
  check('zis: id z ZIS', welcome.you.id === `u_${userId}`, welcome.you.id);
  check('zis: seznam přítomných', Array.isArray(welcome.members) && welcome.members.length >= 2,
    String(welcome.members?.length));

  player.send({ t: 'chat', text: 'Živý test z produkce — M1 ✅' });
  const seen = await guest.waitFor((m) => m.t === 'event' && m.event.kind === 'chat');
  check('host dostane zprávu', seen.event.text.includes('Živý test'), seen.event.text);
  check('autor = jméno ze ZIS', seen.event.name === 'Test Avatar', seen.event.name);

  // ── 5) úklid: smazat účet ───────────────────────────────────────────
  const deleteSignature = await challengeAndSign(address, seed);
  const deleted = await api('/api/auth/me', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', cookie: cookieHeader },
    body: JSON.stringify({
      address,
      chainType: 'zion-l1',
      publicKey: hex(publicKey),
      signature: deleteSignature,
    }),
  });
  check('účet smazán', deleted.status === 200, `${deleted.status} ${JSON.stringify(deleted.body)}`);

  guest.close();
  player.close();
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
} finally {
  console.log(`\nŽIVÝ TEST ${failures === 0 ? 'OK' : `FAILED (${failures})`}`);
  console.log(`(dočasný účet ${address.slice(0, 12)}… ${failures === 0 ? 'byl smazán' : 'MOŽNÁ ZŮSTAL — zkontroluj /api/auth/me'})`);
}

process.exit(failures === 0 ? 0 : 1);
