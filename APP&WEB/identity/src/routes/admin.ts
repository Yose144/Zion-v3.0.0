// Admin API — user management + audit visibility.
//
// Gated by requireAdmin: a session whose user has role='admin', or a
// machine caller presenting x-service-key (= ZIS_SERVICE_KEY). The
// warpd admin gate uses the same role=admin convention.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth.js';
import { auditBg } from '../lib/audit.js';

const USER_SELECT = {
  id: true,
  primaryAddress: true,
  googleId: true,
  displayName: true,
  email: true,
  emailVerifiedAt: true,
  avatar: true,
  role: true,
  createdAt: true,
  lastLogin: true,
  loginCount: true,
} as const;

const RoleSchema = z.object({
  role: z.enum(['user', 'admin', 'moderator']),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /users — paginated user list, optional substring search ──
  app.get('/users', { preHandler: [requireAdmin] }, async (req) => {
    const q = (req.query ?? {}) as Record<string, string>;
    const limit = Math.min(Math.max(parseInt(q.limit ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(q.offset ?? '0', 10) || 0, 0);
    const search = q.q?.trim();

    const where = search
      ? {
          OR: [
            { primaryAddress: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where,
        select: {
          ...USER_SELECT,
          _count: { select: { linkedAddresses: true, sessions: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      app.prisma.user.count({ where }),
    ]);
    return { users, total, limit, offset };
  });

  // ── GET /users/:id — full user + recent auth events ────────────
  app.get('/users/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await app.prisma.user.findUnique({
      where: { id },
      include: {
        linkedAddresses: true,
        sessions: { orderBy: { createdAt: 'desc' }, take: 20 },
        apiKeys: { select: { id: true, label: true, createdAt: true, lastUsed: true } },
        webauthnCredentials: {
          select: { id: true, credentialId: true, label: true, deviceType: true, createdAt: true, lastUsedAt: true },
        },
      },
    });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    const events = await app.prisma.authEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { user, events };
  });

  // ── POST /users/:id/role — set user role ────────────────────────
  // Refuses to demote the last remaining admin (lockout guard).
  app.post('/users/:id/role', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = RoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const target = await app.prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });

    const newRole = parsed.data.role;
    if (target.role === 'admin' && newRole !== 'admin') {
      const admins = await app.prisma.user.count({ where: { role: 'admin' } });
      if (admins <= 1) {
        return reply.code(409).send({
          error: 'LAST_ADMIN',
          message: 'Cannot demote the last admin account',
        });
      }
    }

    const user = await app.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: USER_SELECT,
    });
    auditBg(app, req, {
      kind: 'admin_role_change',
      userId: id,
      meta: { from: target.role, to: newRole },
    });
    return { user };
  });

  // ── DELETE /users/:id — admin-side account deletion ────────────
  app.delete('/users/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const target = await app.prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });

    const caller = (req.user as { sub?: string } | undefined)?.sub;
    if (caller === id) {
      return reply.code(409).send({
        error: 'SELF_DELETE',
        message: 'Use DELETE /api/auth/me for your own account',
      });
    }

    await app.prisma.authEvent.create({
      data: {
        kind: 'admin_user_delete',
        userId: id,
        address: target.primaryAddress,
        ip: req.ip ?? null,
        meta: { deletedUserId: id, by: caller ?? 'service-key' },
      },
    }).catch(() => {});
    const sessions = await app.prisma.session.deleteMany({ where: { userId: id } });
    await app.prisma.user.delete({ where: { id } });
    return { ok: true, deleted: true, sessionsRevoked: sessions.count };
  });

  // ── GET /stats — headline numbers ───────────────────────────────
  app.get('/stats', { preHandler: [requireAdmin] }, async () => {
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      users,
      activeSessions,
      linkedAddresses,
      apiKeys,
      passkeys,
      logins24h,
      failedLogins24h,
      pendingChallenges,
    ] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.session.count({ where: { revoked: false, expiresAt: { gt: new Date() } } }),
      app.prisma.linkedAddress.count(),
      app.prisma.apiKey.count(),
      app.prisma.webAuthnCredential.count(),
      app.prisma.authEvent.count({ where: { kind: 'login', createdAt: { gt: day } } }),
      app.prisma.authEvent.count({ where: { kind: 'login_failed', createdAt: { gt: day } } }),
      app.prisma.authChallenge.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);
    return {
      users,
      activeSessions,
      linkedAddresses,
      apiKeys,
      passkeys,
      logins24h,
      failedLogins24h,
      pendingChallenges,
    };
  });

  // ── GET /events — audit log view ────────────────────────────────
  app.get('/events', { preHandler: [requireAdmin] }, async (req) => {
    const q = (req.query ?? {}) as Record<string, string>;
    const limit = Math.min(Math.max(parseInt(q.limit ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(q.offset ?? '0', 10) || 0, 0);
    const where = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    };
    const [events, total] = await Promise.all([
      app.prisma.authEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      app.prisma.authEvent.count({ where }),
    ]);
    return { events, total, limit, offset };
  });
}
