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

  // Rolling refresh: if the session is more than 50% through its lifetime,
  // issue a new token with the same JTI and an extended expiry.
  const iatMs = payload.iat * 1000;
  const expMs = payload.exp * 1000;
  const halfLife = (expMs - iatMs) / 2;
  const refreshAt = iatMs + halfLife;
  const now = Date.now();

  if (now >= refreshAt && now < expMs - 60_000) {
    const app = req.server as FastifyInstance;
    const newExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);

    await app.prisma.session.update({
      where: { jwtJti: payload.jti },
      data: { expiresAt: newExpiresAt },
    });

    const token = app.jwt.sign({ sub: payload.sub, addr: payload.addr, jti: payload.jti }, {
      expiresIn: '7d',
    });

    reply.setCookie('zion_session', token, {
      domain: app.cookieDomain,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      signed: true,
      expires: newExpiresAt,
    });
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
