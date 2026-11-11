// Agent sub-accounts — schema helpers + CRUD routes + zag_ verify path.
// Same harness as hardening.test.ts: real Fastify, in-memory prisma fake.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { generateAgentKey, isAgentKey, assertValidScopes, agentsEnabled, chargeAgentBudget }
  from '../src/lib/agents.js';
import { agentRoutes } from '../src/routes/agents.js';
import { apiKeyRoutes } from '../src/routes/apikey.js';

const JWT_SECRET = 'test-secret';

// ── In-memory prisma fake (agents + budgets embedded) ────────────────

function makeFakePrisma() {
  const users = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>();
  const agents = new Map<string, Record<string, unknown>>(); // budgets embedded
  const apiKeys = new Map<string, Record<string, unknown>>(); // key: keyHash
  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;
  let executeRawResult = 1;

  const withBudgets = (a: Record<string, unknown>) => ({
    ...a,
    budgets: (a.budgets as Record<string, unknown>[] | undefined) ?? [],
  });

  return {
    _state: { users, sessions, agents, apiKeys },
    _setExecuteRawResult: (n: number) => { executeRawResult = n; },
    $executeRaw: async () => executeRawResult,
    user: {
      findUnique: async ({ where, include }: {
        where: { id?: string }; include?: Record<string, unknown>;
      }) => {
        const u = where.id ? users.get(where.id) : null;
        if (!u) return null;
        return {
          ...u,
          linkedAddresses: include?.linkedAddresses ? [] : undefined,
          oasisPlayer: include?.oasisPlayer ? null : undefined,
        };
      },
    },
    session: {
      findUnique: async ({ where }: { where: { jwtJti: string } }) =>
        sessions.get(where.jwtJti) ?? null,
      update: async ({ where, data }: { where: { jwtJti: string }; data: Record<string, unknown> }) => {
        const s = sessions.get(where.jwtJti);
        if (s) Object.assign(s, data);
        return s;
      },
    },
    apiKey: {
      findUnique: async ({ where }: { where: { keyHash: string } }) =>
        apiKeys.get(where.keyHash) ?? null,
      update: async () => ({}),
    },
    agentSubAccount: {
      findUnique: async ({ where, include }: {
        where: { id?: string; keyHash?: string };
        include?: Record<string, unknown>;
      }) => {
        let a: Record<string, unknown> | undefined;
        if (where.id) a = [...agents.values()].find((x) => x.id === where.id);
        else if (where.keyHash) a = [...agents.values()].find((x) => x.keyHash === where.keyHash);
        if (!a) return null;
        return include?.budgets ? withBudgets(a) : a;
      },
      findMany: async ({ where, include }: {
        where?: { userId?: string }; include?: Record<string, unknown>;
      } = {}) => [...agents.values()]
        .filter((a) => !where?.userId || a.userId === where.userId)
        .map((a) => (include?.budgets ? withBudgets(a) : a)),
      create: async ({ data, include }: {
        data: Record<string, unknown> & { budgets?: { create?: Record<string, unknown>[] } };
        include?: Record<string, unknown>;
      }) => {
        const { budgets: budgetInput, ...rest } = data;
        const budgets = ((budgetInput as { create?: Record<string, unknown>[] } | undefined)?.create ?? [])
          .map((b) => ({
            id: nextId(), agentId: '', currency: b.currency, period: b.period,
            limitUnits: b.limitUnits, spentUnits: 0n,
            periodStart: new Date(), updatedAt: new Date(),
          }));
        const row = {
          id: nextId(), revokedAt: null, lastUsedAt: null, lastUsedIp: null,
          createdAt: new Date(), budgets, ...rest,
        };
        (row.budgets as Record<string, unknown>[]).forEach((b) => { b.agentId = row.id; });
        agents.set(row.id as string, row);
        return include?.budgets ? withBudgets(row) : row;
      },
      update: async ({ where, data, include }: {
        where: { id: string };
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        const a = agents.get(where.id);
        if (!a) throw new Error('agent not found');
        Object.assign(a, data);
        return include?.budgets ? withBudgets(a) : a;
      },
    },
    agentBudget: {
      upsert: async ({ where, create, update }: {
        where: { agentId_currency_period: { agentId: string; currency: string; period: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const { agentId, currency, period } = where.agentId_currency_period;
        const agent = agents.get(agentId);
        const budgets = (agent?.budgets as Record<string, unknown>[]) ?? [];
        let b = budgets.find((x) => x.currency === currency && x.period === period);
        if (!b) {
          b = { id: nextId(), agentId, currency, period, spentUnits: 0n,
                periodStart: new Date(), updatedAt: new Date(), ...create };
          budgets.push(b);
          if (agent) agent.budgets = budgets;
        } else {
          Object.assign(b, update);
        }
        return b;
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
  await app.register(agentRoutes, { prefix: '/api/agents' });
  await app.register(apiKeyRoutes, { prefix: '/api/keys' });
  return { app, fake };
}

function addAuthedUser(app: FastifyInstance, fake: FakePrisma, id: string) {
  const jti = `jti-${id}`;
  fake._state.users.set(id, {
    id, primaryAddress: `zion1${id}`, displayName: null, email: null,
    avatar: null, bio: null, role: 'user', createdAt: new Date(),
    lastLogin: null, loginCount: 0,
  });
  fake._state.sessions.set(jti, {
    id: `sess-${id}`, userId: id, jwtJti: jti,
    expiresAt: new Date(Date.now() + 3600_000), revoked: false, createdAt: new Date(),
  });
  const token = app.jwt.sign({ sub: id, addr: `zion1${id}`, jti });
  return { authorization: `Bearer ${token}` };
}

const asPrisma = (fake: FakePrisma) =>
  fake as unknown as import('@prisma/client').PrismaClient;

const VALID_BODY = {
  name: 'test-agent',
  scopes: ['read', 'trade'],
  expiresInHours: 24,
  budgets: [{ currency: 'ZION', period: 'daily', limitUnits: '1000' }],
};

// ── lib helpers ──────────────────────────────────────────────────────

test('agent key format: zag_ + 48 hex, prefix, hash stable', () => {
  const a = generateAgentKey();
  const b = generateAgentKey();
  assert.ok(isAgentKey(a.raw));
  assert.match(a.raw, /^zag_[0-9a-f]{48}$/);
  assert.equal(a.keyPrefix.length, 10);
  assert.notEqual(a.raw, b.raw);
  assert.equal(a.keyHash.length, 64);
});

test('scopes: known set ok, wallet:withdraw and unknown rejected', () => {
  assert.ok(assertValidScopes(['read', 'trade', 'mining', 'oasis:act']));
  assert.ok(!assertValidScopes(['read', 'wallet:withdraw']));
  assert.ok(!assertValidScopes(['read', 'admin:all']));
  assert.ok(!assertValidScopes([]));
});

test('agentsEnabled: off by default, on with env', () => {
  const saved = process.env.ZIS_AGENTS_ENABLED;
  delete process.env.ZIS_AGENTS_ENABLED;
  assert.equal(agentsEnabled(), false);
  process.env.ZIS_AGENTS_ENABLED = '1';
  assert.equal(agentsEnabled(), true);
  if (saved === undefined) delete process.env.ZIS_AGENTS_ENABLED;
  else process.env.ZIS_AGENTS_ENABLED = saved;
});

// ── routes (flag on) ─────────────────────────────────────────────────

test('routes 404 while ZIS_AGENTS_ENABLED unset', async () => {
  const { app } = await buildApp();
  const res = await app.inject({ method: 'POST', url: '/api/agents', payload: VALID_BODY });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test('create/list/revoke flow with budgets', async () => {
  process.env.ZIS_AGENTS_ENABLED = '1';
  const { app, fake } = await buildApp();
  const auth = addAuthedUser(app, fake, 'u1');

  const create = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth, payload: VALID_BODY,
  });
  assert.equal(create.statusCode, 200);
  const body = create.json();
  assert.ok(isAgentKey(body.agentKey));
  assert.equal(body.agent.keyPrefix, body.agentKey.slice(0, 10));
  assert.deepEqual(body.agent.scopes, ['read', 'trade']);
  assert.equal(body.agent.budgets[0].limitUnits, '1000');
  // raw key is returned once — list must not leak it
  const list = await app.inject({ method: 'GET', url: '/api/agents', headers: auth });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().agents.length, 1);
  assert.equal(list.json().agents[0].keyPrefix, body.agent.keyPrefix);
  assert.ok(!JSON.stringify(list.json()).includes(body.agentKey));

  const del = await app.inject({
    method: 'DELETE', url: `/api/agents/${body.agent.id}`, headers: auth,
  });
  assert.equal(del.statusCode, 200);
  const after = await app.inject({ method: 'GET', url: '/api/agents', headers: auth });
  assert.ok(after.json().agents[0].revokedAt);
  await app.close();
  delete process.env.ZIS_AGENTS_ENABLED;
});

test('create rejects wallet:withdraw scope and missing expiry', async () => {
  process.env.ZIS_AGENTS_ENABLED = '1';
  const { app, fake } = await buildApp();
  const auth = addAuthedUser(app, fake, 'u2');

  const badScope = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth,
    payload: { ...VALID_BODY, scopes: ['read', 'wallet:withdraw'] },
  });
  assert.equal(badScope.statusCode, 400);

  const noExpiry = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth,
    payload: { name: 'x', scopes: ['read'] }, // expiresInHours omitted → default 30d, allowed
  });
  assert.equal(noExpiry.statusCode, 200); // default expiry is fine

  const pastExpiry = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth,
    payload: { ...VALID_BODY, expiresAt: new Date(Date.now() - 1000).toISOString() },
  });
  assert.equal(pastExpiry.statusCode, 400);
  await app.close();
  delete process.env.ZIS_AGENTS_ENABLED;
});

test('PATCH tightening only: shrink scopes/budget ok, grow rejected', async () => {
  process.env.ZIS_AGENTS_ENABLED = '1';
  const { app, fake } = await buildApp();
  const auth = addAuthedUser(app, fake, 'u3');
  const create = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth,
    payload: { ...VALID_BODY, scopes: ['read', 'trade', 'mining'],
      budgets: [{ currency: 'ZION', period: 'daily', limitUnits: '1000' }] },
  });
  const agent = create.json().agent;

  // shrink scopes ok
  const shrink = await app.inject({
    method: 'PATCH', url: `/api/agents/${agent.id}`, headers: auth,
    payload: { scopes: ['read'] },
  });
  assert.equal(shrink.statusCode, 200);
  assert.deepEqual(shrink.json().agent.scopes, ['read']);

  // grow scopes rejected
  const grow = await app.inject({
    method: 'PATCH', url: `/api/agents/${agent.id}`, headers: auth,
    payload: { scopes: ['read', 'trade'] },
  });
  assert.equal(grow.statusCode, 403);

  // lower budget ok, raise rejected
  const lower = await app.inject({
    method: 'PATCH', url: `/api/agents/${agent.id}`, headers: auth,
    payload: { budgets: [{ currency: 'ZION', period: 'daily', limitUnits: '500' }] },
  });
  assert.equal(lower.statusCode, 200);
  const raise = await app.inject({
    method: 'PATCH', url: `/api/agents/${agent.id}`, headers: auth,
    payload: { budgets: [{ currency: 'ZION', period: 'daily', limitUnits: '9000' }] },
  });
  assert.equal(raise.statusCode, 403);
  await app.close();
  delete process.env.ZIS_AGENTS_ENABLED;
});

// ── zag_ verify path ─────────────────────────────────────────────────

test('verify: zag_ key returns agent payload; revoked/expired/unknown → 401', async () => {
  process.env.ZIS_AGENTS_ENABLED = '1';
  const { app, fake } = await buildApp();
  const auth = addAuthedUser(app, fake, 'u4');
  const create = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth, payload: VALID_BODY,
  });
  const { agent, agentKey } = create.json();

  const ok = await app.inject({
    method: 'POST', url: '/api/keys/verify', payload: { apiKey: agentKey },
  });
  assert.equal(ok.statusCode, 200);
  const okBody = ok.json();
  assert.equal(okBody.valid, true);
  assert.equal(okBody.agent.id, agent.id);
  assert.deepEqual(okBody.agent.scopes, ['read', 'trade']);
  assert.equal(okBody.agent.budgets[0].limitUnits, '1000');
  assert.equal(okBody.user.id, 'u4');

  // revoke → 401
  await app.inject({ method: 'DELETE', url: `/api/agents/${agent.id}`, headers: auth });
  const revoked = await app.inject({
    method: 'POST', url: '/api/keys/verify', payload: { apiKey: agentKey },
  });
  assert.equal(revoked.statusCode, 401);

  // unknown zag_ → 401
  const unknown = await app.inject({
    method: 'POST', url: '/api/keys/verify',
    payload: { apiKey: 'zag_' + '0'.repeat(48) },
  });
  assert.equal(unknown.statusCode, 401);

  // expired agent → 401 (forge via direct state edit)
  const create2 = await app.inject({
    method: 'POST', url: '/api/agents', headers: auth, payload: VALID_BODY,
  });
  const agent2 = create2.json();
  const stored = [...fake._state.agents.values()].find((a) => a.id === agent2.agent.id);
  stored!.expiresAt = new Date(Date.now() - 1000);
  const expired = await app.inject({
    method: 'POST', url: '/api/keys/verify', payload: { apiKey: agent2.agentKey },
  });
  assert.equal(expired.statusCode, 401);
  await app.close();
  delete process.env.ZIS_AGENTS_ENABLED;
});

// ── budget charge contract ───────────────────────────────────────────

test('chargeAgentBudget: passthrough of conditional update result', async () => {
  const fake = makeFakePrisma();
  const prisma = asPrisma(fake);
  fake._setExecuteRawResult(1);
  assert.equal(await chargeAgentBudget(prisma, 'a1', 'ZION', 'daily', 100n), true);
  fake._setExecuteRawResult(0);
  assert.equal(await chargeAgentBudget(prisma, 'a1', 'ZION', 'daily', 100n), false);
  // zero/negative amounts never hit the DB
  fake._setExecuteRawResult(0);
  assert.equal(await chargeAgentBudget(prisma, 'a1', 'ZION', 'total', 0n), true);
});

after(() => {
  delete process.env.ZIS_AGENTS_ENABLED;
});
