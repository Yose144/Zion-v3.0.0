// Tests for the WebAuthn / passkey routes.
//
// Runs on a minimal Fastify app (cookie + jwt + in-memory prisma fake)
// — src/server.ts is NOT imported (it calls start() on import).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { webauthnRoutes, type WebAuthnDeps } from '../src/routes/webauthn.js';
import {
  getWebAuthnConfig,
  createCeremony,
  setWebAuthnClock,
} from '../src/lib/webauthn.js';

const JWT_SECRET = 'test-secret';

// ── In-memory prisma fake ────────────────────────────────────────────

function makeFakePrisma() {
  const users = new Map<string, Record<string, unknown>>();
  const credentials = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>(); // key: jwtJti
  const linkedAddresses = new Map<string, Record<string, unknown>>(); // key: address
  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  return {
    _state: { users, credentials, sessions, linkedAddresses },
    user: {
      findUnique: async ({ where }: { where: { id?: string; primaryAddress?: string } }) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.primaryAddress) {
          return [...users.values()].find((u) => u.primaryAddress === where.primaryAddress) ?? null;
        }
        return null;
      },
      update: async ({ where, data }: {
        where: { id: string };
        data: { lastLogin?: Date; loginCount?: { increment: number } };
      }) => {
        const u = users.get(where.id);
        if (!u) throw new Error('user not found');
        if (data.lastLogin) u.lastLogin = data.lastLogin;
        if (data.loginCount?.increment) {
          u.loginCount = ((u.loginCount as number) ?? 0) + data.loginCount.increment;
        }
        return u;
      },
    },
    webAuthnCredential: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        [...credentials.values()]
          .filter((c) => c.userId === where.userId)
          .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime()),
      findUnique: async ({ where }: { where: { credentialId?: string; id?: string } }) => {
        if (where.credentialId) {
          return [...credentials.values()].find((c) => c.credentialId === where.credentialId) ?? null;
        }
        if (where.id) return credentials.get(where.id) ?? null;
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if ([...credentials.values()].some((c) => c.credentialId === data.credentialId)) {
          const err = new Error('Unique constraint failed') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: nextId(),
          createdAt: new Date(),
          lastUsedAt: null,
          ...data,
        };
        credentials.set(row.id as string, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const c = credentials.get(where.id);
        if (!c) throw new Error('credential not found');
        Object.assign(c, data);
        return c;
      },
      deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
        let count = 0;
        for (const [k, c] of credentials) {
          if (c.id === where.id && c.userId === where.userId) {
            credentials.delete(k);
            count++;
          }
        }
        return { count };
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId(), revoked: false, createdAt: new Date(), ...data };
        sessions.set(row.jwtJti as string, row);
        return row;
      },
      findUnique: async ({ where }: { where: { jwtJti: string } }) =>
        sessions.get(where.jwtJti) ?? null,
      update: async ({ where, data }: { where: { jwtJti: string }; data: Record<string, unknown> }) => {
        const s = sessions.get(where.jwtJti);
        if (s) Object.assign(s, data);
        return s;
      },
    },
    linkedAddress: {
      upsert: async ({ where, create }: {
        where: { address: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const existing = linkedAddresses.get(where.address);
        if (existing) return existing;
        const row = { id: nextId(), verifiedAt: new Date(), ...create };
        linkedAddresses.set(where.address, row);
        return row;
      },
    },
  };
}

type FakePrisma = ReturnType<typeof makeFakePrisma>;

// ── Test app factory ─────────────────────────────────────────────────

async function buildApp(deps?: Partial<WebAuthnDeps>) {
  const fake = makeFakePrisma();
  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: JWT_SECRET });
  await app.register(jwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: '7d' },
    cookie: { cookieName: 'zion_session', signed: true },
  });
  app.decorate('prisma', fake);
  app.decorate('cookieDomain', '.zionterranova.com');
  await app.register(webauthnRoutes, { prefix: '/api/auth/webauthn', deps });
  return { app, fake };
}

let userSeq = 0;

/** Insert a user + valid session row into the fake; return auth headers. */
function makeAuthedUser(app: FastifyInstance, fake: FakePrisma, primaryAddress?: string) {
  const id = `user-${++userSeq}`;
  const addr = primaryAddress ?? `zion1${id}`;
  const jti = `jti-${id}`;
  const user = {
    id,
    primaryAddress: addr,
    displayName: null,
    email: null,
    avatar: null,
    bio: null,
    role: 'user',
    createdAt: new Date(),
    lastLogin: null,
    loginCount: 0,
  };
  fake._state.users.set(id, user);
  fake._state.sessions.set(jti, {
    id: `sess-${id}`,
    userId: id,
    jwtJti: jti,
    expiresAt: new Date(Date.now() + 3600_000),
    revoked: false,
  });
  const token = app.jwt.sign({ sub: id, addr, jti });
  return { user, headers: { authorization: `Bearer ${token}` } };
}

const VERIFY_OK_REG = {
  verified: true,
  registrationInfo: {
    fmt: 'none',
    aaguid: '',
    credential: {
      id: 'cred-1',
      publicKey: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      transports: ['internal'],
    },
    credentialType: 'public-key',
    attestationObject: new Uint8Array(),
    userVerified: false,
    credentialDeviceType: 'multiDevice',
    credentialBackedUp: true,
    origin: 'https://app.zionterranova.com',
    rpID: 'zionterranova.com',
  },
} as const;

const VERIFY_OK_AUTH = {
  verified: true,
  authenticationInfo: {
    credentialID: 'cred-login-1',
    newCounter: 5,
    userVerified: false,
    credentialDeviceType: 'multiDevice',
    credentialBackedUp: true,
    origin: 'https://app.zionterranova.com',
    rpID: 'zionterranova.com',
  },
} as const;

after(() => {
  setWebAuthnClock(() => Date.now());
});

// ── Tests ────────────────────────────────────────────────────────────

test('register/options without session → 401', async () => {
  const { app } = await buildApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/register/options',
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, 'UNAUTHORIZED');
  await app.close();
});

test('register/options with session → ceremonyId + challenge + excludeCredentials', async () => {
  const { app, fake } = await buildApp();
  const { user, headers } = makeAuthedUser(app, fake);

  // Pre-existing credential must appear in excludeCredentials.
  fake._state.credentials.set('cred-existing-row', {
    id: 'cred-existing-row',
    userId: user.id,
    credentialId: 'existing-cred-b64url',
    publicKey: Buffer.from([9, 9]),
    counter: 0,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    label: 'old',
    createdAt: new Date(),
    lastUsedAt: null,
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/register/options',
    headers,
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.ceremonyId);
  assert.ok(body.options.challenge);
  assert.equal(body.options.rp.id, 'zionterranova.com');
  assert.deepEqual(
    body.options.excludeCredentials?.map((c: { id: string }) => c.id),
    ['existing-cred-b64url'],
  );
  await app.close();
});

test('register/verify with a ceremony owned by another user → 400 CEREMONY_INVALID', async () => {
  const { app, fake } = await buildApp({
    verifyRegistrationResponse: (async () => VERIFY_OK_REG) as WebAuthnDeps['verifyRegistrationResponse'],
  });
  const { headers } = makeAuthedUser(app, fake);
  const ceremonyId = createCeremony('register', 'some-challenge', 'other-user-id');

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/register/verify',
    headers,
    payload: { ceremonyId, response: { id: 'cred-1' } },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'CEREMONY_INVALID');
  assert.equal(fake._state.credentials.size, 0);
  await app.close();
});

test('register/verify success stores credential, strips publicKey, one-shot ceremony', async () => {
  const { app, fake } = await buildApp({
    verifyRegistrationResponse: (async () => VERIFY_OK_REG) as WebAuthnDeps['verifyRegistrationResponse'],
  });
  const { headers } = makeAuthedUser(app, fake);

  const optRes = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/register/options',
    headers,
  });
  const { ceremonyId } = optRes.json();

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/register/verify',
    headers,
    payload: { ceremonyId, response: { id: 'cred-1', rawId: 'cred-1' }, label: 'MacBook' },
  });
  assert.equal(res.statusCode, 200);
  const { credential } = res.json();
  assert.equal(credential.credentialId, 'cred-1');
  assert.equal(credential.label, 'MacBook');
  assert.equal(credential.deviceType, 'multiDevice');
  assert.equal(credential.backedUp, true);
  assert.equal('publicKey' in credential, false);

  const stored = [...fake._state.credentials.values()][0];
  assert.equal(stored.credentialId, 'cred-1');
  assert.ok(Buffer.isBuffer(stored.publicKey));

  // Ceremony is one-shot — replay must fail.
  const replay = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/register/verify',
    headers,
    payload: { ceremonyId, response: { id: 'cred-1', rawId: 'cred-1' } },
  });
  assert.equal(replay.statusCode, 400);
  assert.equal(replay.json().error, 'CEREMONY_INVALID');
  await app.close();
});

test('login/verify with unknown credential id → 401', async () => {
  const { app } = await buildApp();
  const optRes = await app.inject({ method: 'POST', url: '/api/auth/webauthn/login/options' });
  const { ceremonyId } = optRes.json();

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/login/verify',
    payload: { ceremonyId, response: { id: 'nonexistent-cred' } },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, 'AUTH_FAILED');
  await app.close();
});

test('login/verify success → session cookie, Session row, counter update, JWT addr', async () => {
  const { app, fake } = await buildApp({
    verifyAuthenticationResponse: (async () => VERIFY_OK_AUTH) as WebAuthnDeps['verifyAuthenticationResponse'],
  });
  const { user } = makeAuthedUser(app, fake, 'zion1primaryaddr');
  fake._state.credentials.set('cred-row-1', {
    id: 'cred-row-1',
    userId: user.id,
    credentialId: 'cred-login-1',
    publicKey: Buffer.from([7, 7, 7]),
    counter: 3,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    label: null,
    createdAt: new Date(),
    lastUsedAt: null,
  });
  fake._state.sessions.clear();

  const optRes = await app.inject({ method: 'POST', url: '/api/auth/webauthn/login/options' });
  const { ceremonyId } = optRes.json();

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/login/verify',
    payload: { ceremonyId, response: { id: 'cred-login-1', rawId: 'cred-login-1' } },
  });
  assert.equal(res.statusCode, 200);

  // zion_session set-cookie present, JWT addr matches primaryAddress
  const sessionCookie = res.cookies.find((c) => c.name === 'zion_session');
  assert.ok(sessionCookie, 'zion_session cookie must be set');
  const signed = sessionCookie!.value;
  const jwtPart = signed.split('.').slice(0, 3).join('.');
  const payload = JSON.parse(Buffer.from(jwtPart.split('.')[1], 'base64url').toString());
  assert.equal(payload.addr, 'zion1primaryaddr');
  assert.equal(payload.sub, user.id);

  // Session row created; counter updated to newCounter; lastUsedAt set
  assert.equal(fake._state.sessions.size, 1);
  const cred = fake._state.credentials.get('cred-row-1')!;
  assert.equal(cred.counter, 5);
  assert.ok(cred.lastUsedAt instanceof Date);
  await app.close();
});

test('login/verify where verifier throws → 401, no Session row', async () => {
  const { app, fake } = await buildApp({
    verifyAuthenticationResponse: (async () => {
      throw new Error('counter regression');
    }) as WebAuthnDeps['verifyAuthenticationResponse'],
  });
  const { user } = makeAuthedUser(app, fake);
  fake._state.credentials.set('cred-row-2', {
    id: 'cred-row-2',
    userId: user.id,
    credentialId: 'cred-login-1',
    publicKey: Buffer.from([7, 7, 7]),
    counter: 3,
    transports: [],
    deviceType: 'singleDevice',
    backedUp: false,
    label: null,
    createdAt: new Date(),
    lastUsedAt: null,
  });
  fake._state.sessions.clear();

  const optRes = await app.inject({ method: 'POST', url: '/api/auth/webauthn/login/options' });
  const { ceremonyId } = optRes.json();

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/webauthn/login/verify',
    payload: { ceremonyId, response: { id: 'cred-login-1' } },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, 'AUTH_FAILED');
  assert.equal(fake._state.sessions.size, 0);
  await app.close();
});

test('expired ceremony → 400 CEREMONY_INVALID', async () => {
  let fakeNow = Date.now();
  setWebAuthnClock(() => fakeNow);
  try {
    const { app } = await buildApp();
    const optRes = await app.inject({ method: 'POST', url: '/api/auth/webauthn/login/options' });
    const { ceremonyId } = optRes.json();

    fakeNow += 6 * 60 * 1000; // past the 5-minute TTL

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/webauthn/login/verify',
      payload: { ceremonyId, response: { id: 'x' } },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'CEREMONY_INVALID');
    await app.close();
  } finally {
    setWebAuthnClock(() => Date.now());
  }
});

test('DELETE /credentials/:id — other user → 404, own → 200', async () => {
  const { app, fake } = await buildApp();
  const { user, headers } = makeAuthedUser(app, fake);
  fake._state.credentials.set('cred-other', {
    id: 'cred-other',
    userId: 'someone-else',
    credentialId: 'other-cred-b64',
    publicKey: Buffer.from([1]),
    counter: 0,
    transports: [],
    deviceType: 'singleDevice',
    backedUp: false,
    label: null,
    createdAt: new Date(),
    lastUsedAt: null,
  });
  fake._state.credentials.set('cred-own', {
    id: 'cred-own',
    userId: user.id,
    credentialId: 'own-cred-b64',
    publicKey: Buffer.from([2]),
    counter: 0,
    transports: [],
    deviceType: 'singleDevice',
    backedUp: false,
    label: null,
    createdAt: new Date(),
    lastUsedAt: null,
  });

  const notFound = await app.inject({
    method: 'DELETE',
    url: '/api/auth/webauthn/credentials/cred-other',
    headers,
  });
  assert.equal(notFound.statusCode, 404);
  assert.ok(fake._state.credentials.has('cred-other'), 'other user credential untouched');

  const ok = await app.inject({
    method: 'DELETE',
    url: '/api/auth/webauthn/credentials/cred-own',
    headers,
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(fake._state.credentials.has('cred-own'), false);
  await app.close();
});

test('getWebAuthnConfig defaults + WEBAUTHN_ORIGINS override', async () => {
  const defaults = getWebAuthnConfig();
  assert.equal(defaults.rpId, 'zionterranova.com');
  assert.equal(defaults.rpName, 'ZION');
  assert.deepEqual(defaults.origins, [
    'https://zionterranova.com',
    'https://app.zionterranova.com',
    'https://market.zionterranova.com',
    'https://oasis.zionterranova.com',
    'https://dashboard.zionterranova.com',
    'https://freeworld.zionterranova.com',
  ]);

  const prev = process.env.WEBAUTHN_ORIGINS;
  process.env.WEBAUTHN_ORIGINS = 'https://a.example.com, https://b.example.com';
  try {
    const cfg = getWebAuthnConfig();
    assert.deepEqual(cfg.origins, ['https://a.example.com', 'https://b.example.com']);
  } finally {
    if (prev === undefined) delete process.env.WEBAUTHN_ORIGINS;
    else process.env.WEBAUTHN_ORIGINS = prev;
  }
});
