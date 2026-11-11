import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { auditBg } from '../lib/audit.js';
import {
  agentsEnabled,
  assertValidScopes,
  generateAgentKey,
  AGENT_BUDGET_PERIODS,
} from '../lib/agents.js';

const BudgetSchema = z.object({
  currency: z.string().min(1).max(16),
  period: z.enum(AGENT_BUDGET_PERIODS),
  limitUnits: z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
});

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(64),
  scopes: z.array(z.string().min(1).max(32)).min(1).max(8),
  // Mandatory bounded lifetime — ISO datetime or hours from now (1..8760).
  expiresAt: z.string().datetime().optional(),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
  budgets: z.array(BudgetSchema).max(16).optional(),
});

const PatchAgentSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  // Tightening only: scopes may shrink (subset of current), never grow.
  scopes: z.array(z.string().min(1).max(32)).min(1).max(8).optional(),
  // Lifetime may shorten, never extend.
  expiresAt: z.string().datetime().optional(),
  // Budgets may only shrink — limitUnits <= current limit, never raise.
  budgets: z.array(BudgetSchema).max(16).optional(),
});

function agentView(agent: {
  id: string; name: string; keyPrefix: string; scopes: string[];
  expiresAt: Date; revokedAt: Date | null; lastUsedAt: Date | null;
  createdAt: Date;
}, budgets: { currency: string; period: string; limitUnits: bigint; spentUnits: bigint; periodStart: Date }[]) {
  return {
    id: agent.id,
    name: agent.name,
    keyPrefix: agent.keyPrefix,
    scopes: agent.scopes,
    expiresAt: agent.expiresAt,
    revokedAt: agent.revokedAt,
    lastUsedAt: agent.lastUsedAt,
    createdAt: agent.createdAt,
    budgets: budgets.map((b) => ({
      currency: b.currency,
      period: b.period,
      limitUnits: b.limitUnits.toString(),
      spentUnits: b.spentUnits.toString(),
      periodStart: b.periodStart,
    })),
  };
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // All routes dark until ZIS_AGENTS_ENABLED — design §7 gate 1.
  app.addHook('onRequest', async (req, reply) => {
    if (!agentsEnabled()) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
  });

  // Create an agent → returns `zag_…` once (same convention as ApiKey).
  // NOTE: design calls for step-up (fresh challenge / passkey UV) here;
  // not yet implemented — flag keeps the surface off until it lands.
  app.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = CreateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { name, scopes, expiresAt, expiresInHours, budgets } = parsed.data;
    if (!assertValidScopes(scopes)) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Invalid or empty scopes' });
    }
    const expiry = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + (expiresInHours ?? 24 * 30) * 3600_000);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'expiresAt must be in the future' });
    }

    const payload = req.user as { sub: string };
    const { raw, keyHash, keyPrefix } = generateAgentKey();
    const agent = await app.prisma.agentSubAccount.create({
      data: {
        userId: payload.sub,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expiry,
        budgets: budgets?.length
          ? { create: budgets.map((b) => ({ currency: b.currency, period: b.period, limitUnits: b.limitUnits })) }
          : undefined,
      },
      include: { budgets: true },
    });
    auditBg(app, req, {
      kind: 'agent_create', userId: payload.sub,
      meta: { agentId: agent.id, name, scopes, expiresAt: expiry.toISOString() },
    });
    return { agent: agentView(agent, agent.budgets), agentKey: raw };
  });

  // List the caller's agents (prefix, scopes, budgets, usage, expiry).
  app.get('/', { preHandler: [requireAuth] }, async (req) => {
    const payload = req.user as { sub: string };
    const agents = await app.prisma.agentSubAccount.findMany({
      where: { userId: payload.sub },
      include: { budgets: true },
      orderBy: { createdAt: 'desc' },
    });
    return { agents: agents.map((a) => agentView(a, a.budgets)) };
  });

  // Adjust budgets/scopes — tightening only (subset scopes, earlier expiry,
  // lower-or-equal budget limits). Loosening requires step-up (not yet built).
  app.patch('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const parsed = PatchAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const agent = await app.prisma.agentSubAccount.findUnique({
      where: { id },
      include: { budgets: true },
    });
    if (!agent || agent.userId !== payload.sub) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (agent.revokedAt) {
      return reply.code(409).send({ error: 'CONFLICT', message: 'Agent is revoked' });
    }
    const patch = parsed.data;

    if (patch.scopes && !assertValidScopes(patch.scopes)) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Invalid scopes' });
    }
    if (patch.scopes) {
      const current = new Set(agent.scopes);
      if (!patch.scopes.every((s) => current.has(s))) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Scopes may only shrink without step-up' });
      }
    }
    let newExpiry: Date | undefined;
    if (patch.expiresAt) {
      newExpiry = new Date(patch.expiresAt);
      if (Number.isNaN(newExpiry.getTime()) || newExpiry <= new Date() || newExpiry > agent.expiresAt) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'expiresAt may only move earlier' });
      }
    }
    if (patch.budgets) {
      for (const b of patch.budgets) {
        const existing = agent.budgets.find((x) => x.currency === b.currency && x.period === b.period);
        if (existing && b.limitUnits > existing.limitUnits) {
          return reply.code(403).send({ error: 'FORBIDDEN', message: 'Budget limits may only shrink without step-up' });
        }
      }
    }

    const updated = await app.prisma.agentSubAccount.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.scopes ? { scopes: patch.scopes } : {}),
        ...(newExpiry ? { expiresAt: newExpiry } : {}),
      },
      include: { budgets: true },
    });
    for (const b of patch.budgets ?? []) {
      await app.prisma.agentBudget.upsert({
        where: { agentId_currency_period: { agentId: id, currency: b.currency, period: b.period } },
        create: { agentId: id, currency: b.currency, period: b.period, limitUnits: b.limitUnits },
        update: { limitUnits: b.limitUnits },
      });
    }
    const fresh = await app.prisma.agentSubAccount.findUnique({ where: { id }, include: { budgets: true } });
    auditBg(app, req, {
      kind: 'agent_update', userId: payload.sub,
      meta: { agentId: id, patch: Object.keys(patch) },
    });
    return { agent: agentView(fresh ?? updated, (fresh ?? updated).budgets) };
  });

  // Revoke — sets revokedAt; the key keeps verifying as invalid afterwards.
  app.delete('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const agent = await app.prisma.agentSubAccount.findUnique({ where: { id } });
    if (!agent || agent.userId !== payload.sub) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    await app.prisma.agentSubAccount.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    auditBg(app, req, { kind: 'agent_revoke', userId: payload.sub, meta: { agentId: id, name: agent.name } });
    return { ok: true };
  });
}
