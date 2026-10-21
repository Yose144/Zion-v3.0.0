import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { verifyLegacyToken } from './keys.js';

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

/**
 * Extract the raw session JWT from the request — the signed zion_session
 * cookie first, then an Authorization: Bearer header. Returns null when
 * no credential is present.
 */
export function extractSessionToken(req: FastifyRequest): string | null {
  const raw = req.cookies?.zion_session;
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const unsigned = raw ? req.unsignCookie(raw) : null;
  return unsigned?.valid && unsigned.value ? unsigned.value : bearer;
}

/**
 * Verify the request's session token. Tries the active key (EdDSA in
 * production) first, then — during the legacy grace period — the old
 * HS256 secret. On success the payload is assigned to req.user.
 */
async function verifySessionToken(req: FastifyRequest): Promise<boolean> {
  try {
    await req.jwtVerify();
    return true;
  } catch {
    // fall through to legacy
  }
  const token = extractSessionToken(req);
  if (!token) return false;
  const legacy = verifyLegacyToken(token);
  if (!legacy?.sub || !legacy.jti) return false;
  (req as unknown as { user: unknown }).user = legacy;
  return true;
}

/** Constant-time check of the x-service-key header against ZIS_SERVICE_KEY. */
export function isServiceRequest(req: FastifyRequest): boolean {
  const svc = process.env.ZIS_SERVICE_KEY;
  const hdr = req.headers['x-service-key'];
  if (!svc || typeof hdr !== 'string' || hdr.length === 0 || hdr.length !== svc.length) {
    return false;
  }
  const a = createHash('sha256').update(hdr).digest();
  const b = createHash('sha256').update(svc).digest();
  return timingSafeEqual(a, b);
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!(await verifySessionToken(req))) {
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

  // The session must belong to the token subject — a JWT minted with a
  // foreign jti must not authenticate as its owner.
  if (session.userId !== payload.sub) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Session does not match token subject' });
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
      sameSite: 'lax',
      signed: true,
      expires: newExpiresAt,
    });
  }
}

/**
 * requireAdmin — session auth + user.role === 'admin', or a service-key
 * caller (x-service-key). Used by /api/admin/*.
 */
export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isServiceRequest(req)) {
    (req as unknown as { serviceCaller: boolean }).serviceCaller = true;
    return;
  }
  await requireAuth(req, reply);
  if (reply.sent) return;
  const payload = req.user as JwtPayload;
  const user = await (req.server as FastifyInstance).prisma.user.findUnique({
    where: { id: payload.sub },
    select: { role: true },
  });
  if (user?.role !== 'admin') {
    return reply.code(403).send({ error: 'FORBIDDEN', message: 'Admin role required' });
  }
}

/** requireServiceKey — machine-to-machine auth for /api/notifications push etc. */
export async function requireServiceKey(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isServiceRequest(req)) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Valid x-service-key required' });
  }
}

export async function optionalAuth(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    if (await verifySessionToken(req)) {
      const payload = req.user as JwtPayload;
      if (payload?.jti) {
        const session = await (req.server as FastifyInstance).prisma.session.findUnique({
          where: { jwtJti: payload.jti },
        });
        if (
          !session ||
          session.revoked ||
          session.expiresAt < new Date() ||
          session.userId !== payload.sub
        ) {
          (req as unknown as Record<string, unknown>).user = undefined;
        }
      }
    } else {
      (req as unknown as Record<string, unknown>).user = undefined;
    }
  } catch {
    // ignore — anonymous allowed
  }
}

export function registerAuthHook(_app: FastifyInstance): void {
  // no-op; routes use requireAuth directly
}
