import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { requireAuth } from '../lib/auth.js';

const CreateKeySchema = z.object({
  label: z.string().min(1).max(64),
});

const VerifyKeySchema = z.object({
  apiKey: z.string().min(16),
});

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // Verify an API key and return its owner (service-to-service auth)
  app.post('/verify', async (req, reply) => {
    const parsed = VerifyKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const keyHash = createHash('sha256').update(parsed.data.apiKey).digest('hex');
    const apiKey = await app.prisma.apiKey.findUnique({
      where: { keyHash },
    });
    if (!apiKey) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid API key' });
    }
    await app.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });
    const user = await app.prisma.user.findUnique({
      where: { id: apiKey.userId },
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    if (!user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not found' });
    }
    return { valid: true, user };
  });

  // Create a new API key for the current user
  app.post('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = CreateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const payload = req.user as { sub: string };
    const rawKey = `zis_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    await app.prisma.apiKey.create({
      data: { userId: payload.sub, keyHash, label: parsed.data.label },
    });

    // Return the raw key only once
    return { apiKey: rawKey, label: parsed.data.label };
  });

  // List API keys (without revealing the secret)
  app.get('/', { preHandler: [requireAuth] }, async (req) => {
    const payload = req.user as { sub: string };
    const keys = await app.prisma.apiKey.findMany({
      where: { userId: payload.sub },
      select: { id: true, label: true, createdAt: true, lastUsed: true },
      orderBy: { createdAt: 'desc' },
    });
    return { keys };
  });

  // Revoke an API key
  app.delete('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const { id } = req.params as { id: string };
    const key = await app.prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== payload.sub) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    await app.prisma.apiKey.delete({ where: { id } });
    return { ok: true };
  });
}
