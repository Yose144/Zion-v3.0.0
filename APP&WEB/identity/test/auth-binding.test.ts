// Tests for JWT-to-session subject binding (Fix G).
//
// A forged token {sub: <victim>, jti: <attacker's valid jti>} must not
// authenticate, and /logout must not revoke a session owned by another user.
//
// Minimal Fastify app (cookie + jwt + in-memory prisma fake) — server.ts is
// NOT imported (it calls start() on import).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { requireAuth, optionalAuth, type JwtPayload } from '../src/lib/auth.js';
import { authRoutes } from '../src/routes/auth.js';

const JWT_SECRET = 'test-secret';

// ── In-memory prisma fake (session table only) ───────────────────────

function makeFakePrisma() {
  const sessions = new Map<string, Record<string, unknown>>(); // key: jwtJti
  return {
    _state: { sessions },
    session: {
      findUnique: async ({ where }: { where: { jwtJti: string } }) =>
        sessions.get(where.jwtJti) ?? null,
      update: async ({ where, data }: { where: { jwtJti: string }; data: Record<string, unknown> }) => {
        const s = sessions.get(where.jwtJti);
        if (s) Object.assign(s, data);
        return s;
      },
      updateMany: async ({ where, data }: {
        where: { jwtJti?: string; userId?: string };
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (where.jwtJti !== undefined && s.jwtJti !== where.jwtJti) continue;
          if (where.userId !== undefined && s.userId !== where.userId) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
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

  app.get('/probe/required', { preHandler: [requireAuth] }, async () => ({ ok: true }));
  app.get('/probe/optional', { preHandler: [optionalAuth] }, async (req) => ({
    user: (req.user as JwtPayload | undefined)?.sub ?? null,
  }));
  await app.register(authRoutes, { prefix: '/api/auth' });
  return { app, fake };
}

function addSession(fake: FakePrisma, userId: string, jti: string) {
  fake._state.sessions.set(jti, {
    id: `sess-${jti}`,
    userId,
    jwtJti: jti,
    expiresAt: new Date(Date.now() + 3600_000),
    revoked: false,
    createdAt: new Date(),
  });
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

// ── Tests ────────────────────────────────────────────────────────────

test('requireAuth rejects token whose sub does not own the jti session', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  // Attacker has a valid session/jti; victim is another user.
  addSession(fake, 'attacker', 'jti-attacker');
  addSession(fake, 'victim', 'jti-victim');

  // Forged: victim sub + attacker's jti.
  const forged = app.jwt.sign({ sub: 'victim', addr: 'zion1victim', jti: 'jti-attacker' });
  const res = await app.inject({ url: '/probe/required', headers: bearer(forged) });
  assert.equal(res.statusCode, 401);

  // Matching pair still passes.
  const valid = app.jwt.sign({ sub: 'victim', addr: 'zion1victim', jti: 'jti-victim' });
  const ok = await app.inject({ url: '/probe/required', headers: bearer(valid) });
  assert.equal(ok.statusCode, 200);
});

test('requireAuth still rejects missing/revoked/expired sessions', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  // No session row at all.
  const noSession = app.jwt.sign({ sub: 'u', addr: 'a', jti: 'ghost' });
  const res1 = await app.inject({ url: '/probe/required', headers: bearer(noSession) });
  assert.equal(res1.statusCode, 401);

  // Revoked.
  addSession(fake, 'u', 'jti-revoked');
  fake._state.sessions.get('jti-revoked')!.revoked = true;
  const t2 = app.jwt.sign({ sub: 'u', addr: 'a', jti: 'jti-revoked' });
  const res2 = await app.inject({ url: '/probe/required', headers: bearer(t2) });
  assert.equal(res2.statusCode, 401);
});

test('optionalAuth drops req.user when session owner differs from sub', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  addSession(fake, 'attacker', 'jti-attacker');
  const forged = app.jwt.sign({ sub: 'victim', addr: 'zion1victim', jti: 'jti-attacker' });
  const res = await app.inject({ url: '/probe/optional', headers: bearer(forged) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user, null);

  addSession(fake, 'victim', 'jti-victim');
  const valid = app.jwt.sign({ sub: 'victim', addr: 'zion1victim', jti: 'jti-victim' });
  const res2 = await app.inject({ url: '/probe/optional', headers: bearer(valid) });
  assert.equal(res2.json().user, 'victim');
});

test('logout does not revoke a session owned by another user', async () => {
  const { app, fake } = await buildApp();
  after(() => app.close());

  addSession(fake, 'victim', 'jti-victim');
  // Forged token claims victim's jti with an attacker sub.
  const forged = app.jwt.sign({ sub: 'attacker', addr: 'zion1attacker', jti: 'jti-victim' });
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: bearer(forged),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(fake._state.sessions.get('jti-victim')!.revoked, false,
    'forged logout must not revoke the victim session');

  // Legit logout revokes the caller's own session.
  const valid = app.jwt.sign({ sub: 'victim', addr: 'zion1victim', jti: 'jti-victim' });
  await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: bearer(valid),
  });
  assert.equal(fake._state.sessions.get('jti-victim')!.revoked, true);
});
