import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../lib/auth.js';

/**
 * /api/notifications — cross-app notification inbox.
 *
 * Backed by the shared `Notification` model (APP&WEB/shared/prisma).
 * Producers live in the apps / db-sync service; this route only exposes
 * read + mark-read for the authenticated user.
 */
export async function notificationRoutes(app: FastifyInstance): Promise<void> {
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
