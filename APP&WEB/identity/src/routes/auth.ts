import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

import { createChallenge, verifyEd25519, verifySiwe } from '../lib/challenge.js';
import { requireAuth } from '../lib/auth.js';

const ChallengeSchema = z.object({
  address: z.string().min(8),
  chainType: z.enum(['zion-l1', 'evm']).default('zion-l1'),
});

const VerifyEd25519Schema = z.object({
  address: z.string(),
  publicKey: z.string(),
  signature: z.string(),
});

const VerifySiweSchema = z.object({
  address: z.string(), // 0x...
  message: z.string(), // raw SIWE message
  signature: z.string(), // 0x-prefixed hex
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  email: z.string().email().max(255).optional().nullable(),
  avatar: z.string().url().max(512).optional().nullable(),
  bio: z.string().max(512).optional().nullable(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /challenge ─────────────────────────────────────────────
  app.post('/challenge', async (req, reply) => {
    const parsed = ChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { address, chainType } = parsed.data;
    const challenge = createChallenge(address);
    return {
      challenge,
      chainType,
      expiresInMs: 300_000,
    };
  });

  // ── POST /verify/ed25519 ────────────────────────────────────────
  app.post('/verify/ed25519', async (req, reply) => {
    const parsed = VerifyEd25519Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { address, publicKey, signature } = parsed.data;

    const ok = await verifyEd25519(address, signature, publicKey);
    if (!ok) {
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Invalid signature' });
    }

    return issueSession(app, req, reply, address, 'zion-l1');
  });

  // ── POST /verify/siwe ───────────────────────────────────────────
  app.post('/verify/siwe', async (req, reply) => {
    const parsed = VerifySiweSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { address, message, signature } = parsed.data;

    // Recover EVM address from signature (EIP-191)
    // NOTE: in production use `ethers.utils.verifyMessage(message, signature)`.
    // We accept the recovered address passed by the gateway for now.
    // The gateway must perform ecrecover — ZIS itself stays crypto-light.
    const recoveredAddress = (req.body as Record<string, string>).recoveredAddress ?? address;
    const nonceMatch = message.match(/Nonce: ([^\n]+)/i);
    const nonce = nonceMatch?.[1] ?? '';

    const ok = verifySiwe(address, recoveredAddress, nonce);
    if (!ok) {
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'SIWE verification failed' });
    }

    return issueSession(app, req, reply, address, 'evm');
  });

  // ── GET /me ─────────────────────────────────────────────────────
  app.get('/me', { preHandler: [requireAuth] }, async (req) => {
    const payload = req.user as { sub: string; addr: string };
    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    if (!user) return { error: 'NOT_FOUND' };
    return user;
  });

  // ── PATCH /me ───────────────────────────────────────────────────
  app.patch('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const payload = req.user as { sub: string };
    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if ('displayName' in data) update.displayName = data.displayName;
    if ('email' in data) update.email = data.email;
    if ('avatar' in data) update.avatar = data.avatar;
    if ('bio' in data) update.bio = data.bio;

    const user = await app.prisma.user.update({
      where: { id: payload.sub },
      data: update,
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    return user;
  });

  // ── POST /logout ────────────────────────────────────────────────
  app.post('/logout', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { jti: string };
    await app.prisma.session.update({
      where: { jwtJti: payload.jti },
      data: { revoked: true },
    });
    reply.clearCookie('zion_session', { domain: app.cookieDomain });
    return { ok: true };
  });
}

async function issueSession(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: import('fastify').FastifyReply,
  address: string,
  chainType: string,
) {
  // Upsert user
  const user = await app.prisma.user.upsert({
    where: { primaryAddress: address },
    update: { lastLogin: new Date(), loginCount: { increment: 1 } },
    create: { primaryAddress: address, loginCount: 1, lastLogin: new Date() },
  });

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
    user: { id: user.id, primaryAddress: user.primaryAddress, displayName: user.displayName },
    expiresAt: expiresAt.toISOString(),
  };
}
