import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireServiceKey } from '../lib/auth.js';
import { auditBg } from '../lib/audit.js';
import { inc, M } from '../lib/metrics.js';

const PushNotificationSchema = z.object({
  userId: z.string().min(1).optional(),
  address: z.string().min(8).optional(),
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  body: z.string().max(4096).default(''),
  data: z.record(z.unknown()).optional(),
});

/**
 * /api/notifications — cross-app notification inbox.
 *
 * Backed by the shared `Notification` model (APP&WEB/shared/prisma).
 * Read + mark-read require the authenticated user; producing a
 * notification is service-to-service via x-service-key.
 */
export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // Push a notification — service callers only (x-service-key).
  // Target the user by userId directly, or by any linked/primary address.
  app.post('/', { preHandler: [requireServiceKey] }, async (req, reply) => {
    const parsed = PushNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { userId, address, type, title, body, data } = parsed.data;
    if (!userId && !address) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'userId or address required' });
    }

    let targetId = userId ?? null;
    if (!targetId && address) {
      const link = await app.prisma.linkedAddress.findUnique({ where: { address } });
      if (link) {
        targetId = link.userId;
      } else {
        const u = await app.prisma.user.findUnique({ where: { primaryAddress: address } });
        targetId = u?.id ?? null;
      }
    }
    if (!targetId) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Target user not found' });
    }

    const notification = await app.prisma.notification.create({
      data: { userId: targetId, type, title, body, data: data as never },
    });
    inc(M.notificationPush);
    auditBg(app, req, { kind: 'notification_push', userId: targetId, meta: { type } });
    return { ok: true, id: notification.id };
  });

  // List notifications for current user, newest first.
  // Query: ?limit=1..100 (default 50) &offset=0 &unread=1
  app.get('/', { preHandler: [requireAuth] }, async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const q = (req.query ?? {}) as Record<string, string>;
    const limit = Math.min(Math.max(parseInt(q.limit ?? '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(q.offset ?? '0', 10) || 0, 0);
    const unreadOnly = q.unread === '1' || q.unread === 'true';

    const where = { userId, ...(unreadOnly ? { read: false } : {}) };
    const [notifications, total, unread] = await Promise.all([
      app.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      app.prisma.notification.count({ where }),
      app.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { notifications, total, unread, limit, offset };
  });

  // Cheap poll endpoint for the UI bell badge.
  app.get('/unread-count', { preHandler: [requireAuth] }, async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const count = await app.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  });

  // Mark a single notification as read.
  app.post('/:id/read', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const res = await app.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    if (res.count === 0) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true };
  });

  // Mark every notification of the current user as read.
  app.post('/read-all', { preHandler: [requireAuth] }, async (req) => {
    const userId = (req.user as { sub: string }).sub;
    const res = await app.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { ok: true, updated: res.count };
  });

  // Delete a notification.
  app.delete('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = (req.user as { sub: string }).sub;
    const { id } = req.params as { id: string };
    const res = await app.prisma.notification.deleteMany({
      where: { id, userId },
    });
    if (res.count === 0) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true };
  });
}
