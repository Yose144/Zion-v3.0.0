import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../lib/auth.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // List active sessions for current user
  app.get('/', { preHandler: [requireAuth] }, async (req) => {
    const payload = req.user as { sub: string };
    const sessions = await app.prisma.session.findMany({
      where: { userId: payload.sub, revoked: false },
      orderBy: { createdAt: 'desc' },
    });
    return { sessions };
  });

  // Revoke a specific session
  app.delete('/:jti', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const { jti } = req.params as { jti: string };
    const session = await app.prisma.session.findUnique({ where: { jwtJti: jti } });
    if (!session || session.userId !== payload.sub) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    await app.prisma.session.update({
      where: { jwtJti: jti },
      data: { revoked: true },
    });
    return { ok: true };
  });

  // Revoke all sessions (logout everywhere)
  app.post('/revoke-all', { preHandler: [requireAuth] }, async (req) => {
    const payload = req.user as { sub: string };
    await app.prisma.session.updateMany({
      where: { userId: payload.sub, revoked: false },
      data: { revoked: true },
    });
    return { ok: true };
  });
}
