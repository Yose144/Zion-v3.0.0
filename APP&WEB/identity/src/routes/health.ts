import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => ({
    status: 'ok',
    service: 'zis',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/live', async () => ({ status: 'alive' }));

  app.get('/ready', async (_req, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (err) {
      reply.code(503);
      return { status: 'not_ready', error: (err as Error).message };
    }
  });
}
