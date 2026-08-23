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
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or missing token' });
  }

  const payload = req.user as JwtPayload;
  if (!payload?.jti) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing session ID' });
  }

  // Verify the session exists in the DB and has not been revoked or expired.
  const session = await (req.server as FastifyInstance).prisma.session.findUnique({
    where: { jwtJti: payload.jti },
  });

  if (!session || session.revoked || session.expiresAt < new Date()) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Session revoked or expired' });
  }
}

export async function optionalAuth(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify();
    const payload = req.user as JwtPayload;
    if (payload?.jti) {
      const session = await (req.server as FastifyInstance).prisma.session.findUnique({
        where: { jwtJti: payload.jti },
      });
      if (!session || session.revoked || session.expiresAt < new Date()) {
        (req as unknown as Record<string, unknown>).user = undefined;
      }
    }
  } catch {
    // ignore — anonymous allowed
  }
}

export function registerAuthHook(_app: FastifyInstance): void {
  // no-op; routes use requireAuth directly
}
