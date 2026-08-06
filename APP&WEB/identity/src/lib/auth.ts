import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
    cookieDomain: string;
  }
}

export interface JwtPayload {
  sub: string; // user id
  addr: string; // primary address
  jti: string;
  iat: number;
  exp: number;
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or missing token' });
  }
}

export async function optionalAuth(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    // ignore — anonymous allowed
  }
}

export function registerAuthHook(app: FastifyInstance): void {
  // no-op; routes use requireAuth directly
  void app;
}
