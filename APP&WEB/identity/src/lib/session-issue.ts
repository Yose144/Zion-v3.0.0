import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

export async function issueSessionForUser(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  user: { id: string; primaryAddress: string; displayName?: string | null; email?: string | null; avatar?: string | null; bio?: string | null },
  address: string,
  chainType: string,
) {
  // Ensure linked address exists
  await app.prisma.linkedAddress.upsert({
    where: { address },
    update: {},
    create: { userId: user.id, address, chainType },
  });

  // Create session
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const userAgent = (req.headers['user-agent'] as string | undefined) ?? '';
  const ipAddress = req.ip ?? '';
  await app.prisma.session.create({
    data: { userId: user.id, jwtJti: jti, expiresAt, userAgent, ipAddress },
  });

  const token = app.jwt.sign({ sub: user.id, addr: address, jti });
  reply.setCookie('zion_session', token, {
    domain: app.cookieDomain,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    signed: true,
    expires: expiresAt,
  });

  return {
    token,
    user: {
      id: user.id,
      primaryAddress: user.primaryAddress,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
    },
    expiresAt: expiresAt.toISOString(),
  };
}
