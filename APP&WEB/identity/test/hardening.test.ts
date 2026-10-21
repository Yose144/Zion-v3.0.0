// Tests for the ZIS hardening work:
//   - EdDSA keys: real JWKS document + HS256 legacy grace verification
//   - DB-backed auth challenges (one-shot, expiry, prune)
//   - Admin API gating (role / service key / last-admin lockout)
//   - Service-key notification push
//   - Prometheus /metrics output
//
// Minimal Fastify app (cookie + jwt + in-memory prisma fake) — server.ts is
// NOT imported (it calls start() on import).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { createSigner } from 'fast-jwt';

import {
  getJwtConfig,
  getJwksDocument,
  verifyLegacyToken,
  resetJwtConfigCache,
} from '../src/lib/keys.js';
import {
  createChallenge,
  getChallenge,
  clearChallenge,
  pruneChallenges,
} from '../src/lib/challenge.js';
import { registerMetrics, inc, M } from '../src/lib/metrics.js';
import { metricsRoutes } from '../src/routes/metrics.js';
import { adminRoutes } from '../src/routes/admin.js';
import { notificationRoutes } from '../src/routes/notifications.js';

const JWT_SECRET = 'test-secret';
const SERVICE_KEY = 'svc-test-key';

// ── In-memory prisma fake ────────────────────────────────────────────

function makeFakePrisma() {
  const users = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>(); // key: jwtJti
  const challenges = new Map<string, Record<string, unknown>>(); // key: address
  const linkedAddresses = new Map<string, Record<string, unknown>>(); // key: address
  const notifications = new Map<string, Record<string, unknown>>();
  const authEvents: Record<string, unknown>[] = [];
  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  const userMatches = (u: Record<string, unknown>, where: Record<string, unknown>) => {
    if (where.id && u.id !== where.id) return false;
    if (where.role && u.role !== where.role) return false;
    if (where.OR) {
      const ors = where.OR as Record<string, { contains: string }>[];
      const hit = ors.some((clause) =>
        Object.entries(clause).every(([field, cond]) =>
          String(u[field] ?? '').toLowerCase().includes(cond.contains.toLowerCase())));
      if (!hit) return false;
    }
    return true;
  };

  return {
    _state: { users, sessions, challenges, linkedAddresses, notifications, authEvents },
    user: {
      findUnique: async ({ where }: { where: { id?: string; primaryAddress?: string } }) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.primaryAddress) {
          return [...users.values()].find((u) => u.primaryAddress === where.primaryAddress) ?? null;
        }
        return null;
      },
      findMany: async ({ where = {}, take = 100, skip = 0 }: {
        where?: Record<string, unknown>; take?: number; skip?: number;
      } = {}) => [...users.values()].filter((u) => userMatches(u, where)).slice(skip, skip + take),
      count: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
        [...users.values()].filter((u) => userMatches(u, where)).length,
      update: async ({ where, data }: {
        where: { id: string }; data: Record<string, unknown>;
      }) => {
        const u = users.get(where.id);
        if (!u) throw new Error('user not found');
        Object.assign(u, data);
        return u;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const u = users.get(where.id);
        users.delete(where.id);
        return u;
      },
    },
    session: {
      findUnique: async ({ where }: { where: { jwtJti: string } }) =>
        sessions.get(where.jwtJti) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId(), revoked: false, createdAt: new Date(), ...data };
        sessions.set(row.jwtJti as string, row);
        return row;
      },
      update: async ({ where, data }: { where: { jwtJti: string }; data: Record<string, unknown> }) => {
        const s = sessions.get(where.jwtJti);
        if (s) Object.assign(s, data);
        return s;
      },
      count: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
        [...sessions.values()].filter((s) =>
          (where.revoked === undefined || s.revoked === where.revoked) &&
          (!where.expiresAt?.gt || (s.expiresAt as Date) > where.expiresAt.gt)).length,
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        let count = 0;
        for (const [k, s] of sessions) {
          if (s.userId === where.userId) { sessions.delete(k); count++; }
        }
        return { count };
      },
      updateMany: async () => ({ count: 0 }),
    },
    authChallenge: {
      upsert: async ({ where, create, update }: {
        where: { address: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = challenges.get(where.address);
        if (existing) { Object.assign(existing, update); return existing; }
        const row = { id: nextId(), createdAt: new Date(), ...create };
        challenges.set(where.address, row);
        return row;
      },
      findUnique: async ({ where }: { where: { address: string } }) =>
        challenges.get(where.address) ?? null,
      delete: async ({ where }: { where: { address: string } }) => {
        const row = challenges.get(where.address);
        if (!row) {
          const err = new Error('not found') as Error & { code: string };
          err.code = 'P2025';
          throw err;
        }
        challenges.delete(where.address);
        return row;
      },
      deleteMany: async ({ where }: { where: { expiresAt: { lt: Date } } }) => {
        let count = 0;
        for (const [k, c] of challenges) {
          if ((c.expiresAt as Date).getTime() < where.expiresAt.lt.getTime()) {
            challenges.delete(k);
            count++;
          }
        }
        return { count };
      },
      count: async () => challenges.size,
    },
    linkedAddress: {
      findUnique: async ({ where }: { where: { address: string } }) =>
        linkedAddresses.get(where.address) ?? null,
      count: async () => linkedAddresses.size,
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
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId(), read: false, createdAt: new Date(), ...data };
        notifications.set(row.id as string, row);
        return row;
      },
      findMany: async () => [...notifications.values()],
      count: async () => notifications.size,
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
    apiKey: { count: async () => 0 },
    webAuthnCredential: { count: async () => 0 },
    authEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId(), createdAt: new Date(), ...data };
        authEvents.push(row);
        return row;
      },
      findMany: async ({ where = {}, take = 50, skip = 0 }: {
        where?: Record<string, unknown>; take?: number; skip?: number;
      } = {}) =>
        authEvents
          .filter((e) =>
            (where.userId === undefined || e.userId === where.userId) &&
            (where.kind === undefined || e.kind === where.kind) &&
            (!where.createdAt?.gt || (e.createdAt as Date) > where.createdAt.gt))
          .slice(skip, skip + take),
      count: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
        authEvents.filter((e) =>
          (where.userId === undefined || e.userId === where.userId) &&
          (where.kind === undefined || e.kind === where.kind) &&
          (!where.createdAt?.gt || (e.createdAt as Date) > where.createdAt.gt)).length,
      deleteMany: async () => ({ count: 0 }),
    },
  };
}

type FakePrisma = ReturnType<typeof makeFakePrisma>;

// ── Test app factory ─────────────────────────────────────────────────

async function buildApp() {
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
  registerMetrics(app);
  await app.register(metricsRoutes, { prefix: '/metrics' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  return { app, fake };
}

function addAuthedUser(
  app: FastifyInstance,
  fake: FakePrisma,
  id: string,
  role = 'user',
) {
  const jti = `jti-${id}`;
  fake._state.users.set(id, {
    id,
    primaryAddress: `zion1${id}`,
    displayName: null,
    email: null,
    avatar: null,
    bio: null,
    role,
    createdAt: new Date(),
    lastLogin: null,
    loginCount: 0,
  });
  fake._state.sessions.set(jti, {
    id: `sess-${id}`,
    userId: id,
    jwtJti: jti,
    expiresAt: new Date(Date.now() + 3600_000),
    revoked: false,
    createdAt: new Date(),
  });
  const token = app.jwt.sign({ sub: id, addr: `zion1${id}`, jti });
  return { authorization: `Bearer ${token}` };
}

const asPrisma = (fake: FakePrisma) =>
  fake as unknown as import('@prisma/client').PrismaClient;

// ── EdDSA keys / JWKS / legacy grace ─────────────────────────────────

test('eddsa mode: JWKS exposes the public JWK only, legacy HS256 token still verifies', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;

  const saved = {
    priv: process.env.JWT_PRIVATE_KEY,
    legacy: process.env.JWT_LEGACY_SECRET,
    secret: process.env.JWT_SECRET,
  };
  process.env.JWT_PRIVATE_KEY = pem;
  process.env.JWT_LEGACY_SECRET = 'old-hs256-secret';
  delete process.env.JWT_SECRET;
  resetJwtConfigCache();
  try {
    const cfg = getJwtConfig();
    assert.equal(cfg.mode, 'eddsa');
    assert.ok(cfg.jwk, 'eddsa mode must publish a JWK');
    assert.equal(cfg.jwk!.kty, 'OKP');
    assert.equal(cfg.jwk!.crv, 'Ed25519');
    assert.equal(cfg.jwk!.alg, 'EdDSA');
    assert.equal(cfg.jwk!.use, 'sig');
    assert.ok(cfg.kid.startsWith('zis-'));

    const doc = getJwksDocument();
    assert.equal(doc.keys.length, 1);
    // No private material anywhere in the published document.
    assert.equal('d' in doc.keys[0], false);
    assert.equal(JSON.stringify(doc).includes('PRIVATE'), false);

    // A token signed with the retired HS256 secret must still verify
    // during the grace period.
    const legacySign = createSigner({ key: 'old-hs256-secret', algorithm: 'HS256' });
    const token = legacySign({ sub: 'u1', addr: 'a1', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 600 });
    const payload = verifyLegacyToken(token);
    assert.ok(payload, 'legacy token must verify with JWT_LEGACY_SECRET set');
    assert.equal(payload!.sub, 'u1');

    // A token signed with a different secret must not.
    const badSign = createSigner({ key: 'attacker-secret', algorithm: 'HS256' });
    const bad = badSign({ sub: 'u1', addr: 'a1', jti: 'j1' });
    assert.equal(verifyLegacyToken(bad), null);
  } finally {
    if (saved.priv === undefined) delete process.env.JWT_PRIVATE_KEY;
    else process.env.JWT_PRIVATE_KEY = saved.priv;
    if (saved.legacy === undefined) delete process.env.JWT_LEGACY_SECRET;
    else process.env.JWT_LEGACY_SECRET = saved.legacy;
    if (saved.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved.secret;
    resetJwtConfigCache();
  }
});

test('hs256 mode: empty JWKS, legacy verifier disabled', async () => {
  const saved = { priv: process.env.JWT_PRIVATE_KEY };
  delete process.env.JWT_PRIVATE_KEY;
  resetJwtConfigCache();
  try {
    const cfg = getJwtConfig();
    assert.equal(cfg.mode, 'hs256');
    assert.equal(cfg.jwk, null);
    assert.deepEqual(getJwksDocument(), { keys: [] });
    const sign = createSigner({ key: 'whatever', algorithm: 'HS256' });
    assert.equal(verifyLegacyToken(sign({ sub: 'u', jti: 'j' })), null);
  } finally {
    if (saved.priv !== undefined) process.env.JWT_PRIVATE_KEY = saved.priv;
    resetJwtConfigCache();
  }
});

// ── DB-backed challenges ─────────────────────────────────────────────

test('challenge: create stores row, get returns it, clear consumes it, expired pruned', async () => {
  const fake = makeFakePrisma();
  const prisma = asPrisma(fake);

  const challenge = await createChallenge(prisma, 'ZION1ABC');
  assert.ok(challenge.startsWith('ZION-AUTH-V1'));
  assert.ok(challenge.includes('address: ZION1ABC'));
  assert.equal(fake._state.challenges.size, 1);
  // Stored under the lowercased address.
  assert.ok(fake._state.challenges.has('zion1abc'));

  const fetched = await getChallenge(prisma, 'zion1abc');
  assert.equal(fetched, challenge);

  await clearChallenge(prisma, 'zion1abc');
  assert.equal(await getChallenge(prisma, 'zion1abc'), null);
  assert.equal(fake._state.challenges.size, 0);
});

test('challenge: expired row reads null and is deleted; prune removes the rest', async () => {
  const fake = makeFakePrisma();
  const prisma = asPrisma(fake);

  fake._state.challenges.set('zion1old', {
    id: 'c1',
    address: 'zion1old',
    challenge: 'stale',
    expiresAt: new Date(Date.now() - 1000),
  });
  assert.equal(await getChallenge(prisma, 'zion1old'), null);
  assert.equal(fake._state.challenges.has('zion1old'), false, 'expired read is deleted');

  fake._state.challenges.set('zion1old2', {
    id: 'c2',
    address: 'zion1old2',
    challenge: 'stale',
    expiresAt: new Date(Date.now() - 60_000),
  });
  await createChallenge(prisma, 'zion1fresh');
  const pruned = await pruneChallenges(prisma);
  assert.equal(pruned, 1);
  assert.equal(fake._state.challenges.size, 1);
});

// ── Admin API gating ─────────────────────────────────────────────────

test('admin: 401 anonymous, 403 non-admin, 200 admin + service key', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  const anon = await app.inject({ url: '/api/admin/stats' });
  assert.equal(anon.statusCode, 401);

  const userHeaders = addAuthedUser(app, fake, 'u-normal', 'user');
  const nonAdmin = await app.inject({ url: '/api/admin/stats', headers: userHeaders });
  assert.equal(nonAdmin.statusCode, 403);

  const adminHeaders = addAuthedUser(app, fake, 'u-admin', 'admin');
  const ok = await app.inject({ url: '/api/admin/stats', headers: adminHeaders });
  assert.equal(ok.statusCode, 200);
  assert.ok('users' in ok.json());

  const prevKey = process.env.ZIS_SERVICE_KEY;
  process.env.ZIS_SERVICE_KEY = SERVICE_KEY;
  try {
    const svc = await app.inject({
      url: '/api/admin/stats',
      headers: { 'x-service-key': SERVICE_KEY },
    });
    assert.equal(svc.statusCode, 200);

    const badSvc = await app.inject({
      url: '/api/admin/stats',
      headers: { 'x-service-key': 'wrong' },
    });
    assert.equal(badSvc.statusCode, 401);
  } finally {
    if (prevKey === undefined) delete process.env.ZIS_SERVICE_KEY;
    else process.env.ZIS_SERVICE_KEY = prevKey;
  }
});

test('admin role change writes audit event; last-admin demote refused', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  const adminHeaders = addAuthedUser(app, fake, 'u-admin', 'admin');
  addAuthedUser(app, fake, 'u-target', 'user');

  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/users/u-target/role',
    headers: adminHeaders,
    payload: { role: 'moderator' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(fake._state.users.get('u-target')!.role, 'moderator');
  assert.ok(
    fake._state.authEvents.some(
      (e) => e.kind === 'admin_role_change' && e.userId === 'u-target',
    ),
    'role change must be audited',
  );

  // u-admin is the only admin — demoting them must be refused.
  const demote = await app.inject({
    method: 'POST',
    url: '/api/admin/users/u-admin/role',
    headers: adminHeaders,
    payload: { role: 'user' },
  });
  assert.equal(demote.statusCode, 409);
  assert.equal(demote.json().error, 'LAST_ADMIN');
  assert.equal(fake._state.users.get('u-admin')!.role, 'admin');
});

// ── Service-key notification push ────────────────────────────────────

test('notifications POST: service-key only, resolves target via linked address', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  fake._state.users.set('u1', {
    id: 'u1', primaryAddress: 'zion1u1', role: 'user', createdAt: new Date(),
  });
  fake._state.linkedAddresses.set('0xabc1234def', {
    id: 'la1', userId: 'u1', address: '0xabc1234def', chainType: 'evm',
  });

  const prevKey = process.env.ZIS_SERVICE_KEY;
  process.env.ZIS_SERVICE_KEY = SERVICE_KEY;
  try {
    const noKey = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      payload: { address: '0xabc1234def', type: 'payout', title: 'Payout sent' },
    });
    assert.equal(noKey.statusCode, 401);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: { 'x-service-key': SERVICE_KEY },
      payload: { address: '0xabc1234def', type: 'payout', title: 'Payout sent', body: '0.5 PRL' },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(fake._state.notifications.size, 1);
    const n = [...fake._state.notifications.values()][0];
    assert.equal(n.userId, 'u1');
    assert.equal(n.title, 'Payout sent');

    const missing = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      headers: { 'x-service-key': SERVICE_KEY },
      payload: { address: '0xdeadbeef', type: 'payout', title: 'x' },
    });
    assert.equal(missing.statusCode, 404);
  } finally {
    if (prevKey === undefined) delete process.env.ZIS_SERVICE_KEY;
    else process.env.ZIS_SERVICE_KEY = prevKey;
  }
});

// ── /metrics ─────────────────────────────────────────────────────────

test('GET /metrics returns prometheus text with zis_ series', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  addAuthedUser(app, fake, 'u-m', 'user');
  inc(M.authVerify, { method: 'ed25519', result: 'ok' });

  const res = await app.inject({ url: '/metrics' });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'] as string, /text\/plain/);
  const body = res.body;
  assert.match(body, /zis_users_total 1/);
  assert.match(body, /zis_sessions_active 1/);
  assert.match(body, /zis_auth_verify_total\{method="ed25519",result="ok"\} 1/);
});
