import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { createChallenge, verifyEd25519, verifySiwe } from '../lib/challenge.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { requireAuth } from '../lib/auth.js';
import { issueSessionForUser } from '../lib/session-issue.js';

const ChallengeSchema = z.object({
  address: z.string().min(8),
  chainType: z.enum(['zion-l1', 'evm', 'bitcoin']).default('zion-l1'),
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
  recoveredAddress: z.string().optional(), // deprecated, no longer needed
});

const VerifyGoogleSchema = z.object({
  idToken: z.string().min(1),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  email: z.string().email().max(255).optional().nullable(),
  avatar: z.string().url().max(512).optional().nullable(),
  bio: z.string().max(512).optional().nullable(),
});

const LinkAddressSchema = z.object({
  address: z.string().min(8),
  chainType: z.enum(['zion-l1', 'evm', 'bitcoin']),
  chainId: z.string().optional(),
  // Ed25519 linking
  publicKey: z.string().optional(),
  signature: z.string().min(1),
  // SIWE linking
  message: z.string().optional(),
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

    const ok = await verifySiwe(address, signature, message);
    if (!ok) {
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'SIWE verification failed' });
    }

    // Normalize the EVM address to lowercase so 0xABC… and 0xabc… cannot
    // create duplicate accounts for the same wallet.
    return issueSession(app, req, reply, address.toLowerCase(), 'evm');
  });

  // ── POST /verify/google ──────────────────────────────────────────
  app.post('/verify/google', async (req, reply) => {
    const parsed = VerifyGoogleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { idToken } = parsed.data;

    let googleUser;
    try {
      googleUser = await verifyGoogleIdToken(idToken);
    } catch (err) {
      return reply.code(401).send({
        error: 'AUTH_FAILED',
        message: err instanceof Error ? err.message : 'Google verification failed',
      });
    }

    const primaryAddress = `google:${googleUser.sub}`;
    const email = googleUser.email ?? undefined;

    const user = await app.prisma.user.upsert({
      where: { primaryAddress },
      update: {
        lastLogin: new Date(),
        loginCount: { increment: 1 },
        ...(email ? { email } : {}),
        ...(googleUser.name ? { displayName: googleUser.name } : {}),
        ...(googleUser.picture ? { avatar: googleUser.picture } : {}),
      },
      create: {
        primaryAddress,
        googleId: googleUser.sub,
        email: email ?? null,
        displayName: googleUser.name ?? null,
        avatar: googleUser.picture ?? null,
        loginCount: 1,
        lastLogin: new Date(),
      },
    });

    await app.prisma.linkedAddress.upsert({
      where: { address: primaryAddress },
      update: {},
      create: {
        userId: user.id,
        address: primaryAddress,
        chainType: 'google',
        chainId: 'google',
      },
    });

    return issueSessionForUser(app, req, reply, user, primaryAddress, 'google');
  });

  // ── GET /me ─────────────────────────────────────────────────────
  app.get('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string; addr: string };
    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    if (!user) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
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
  // Always clears the cookie — even when the session was already revoked or
  // the token is invalid — so stale credentials never linger client-side.
  app.post('/logout', async (req, reply) => {
    try {
      await req.jwtVerify();
      const payload = req.user as { jti?: string };
      if (payload?.jti) {
        await app.prisma.session.updateMany({
          where: { jwtJti: payload.jti },
          data: { revoked: true },
        });
      }
    } catch {
      // invalid/expired token — still clear the cookie below
    }
    reply.clearCookie('zion_session', { domain: app.cookieDomain });
    return { ok: true };
  });

  // ── POST /link ──────────────────────────────────────────────────
  // Link an additional address to the authenticated user's account.
  // The caller must sign a fresh ZIS challenge for the address they want to link.
  app.post('/link', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = LinkAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { address: rawAddress, chainType, chainId, publicKey, signature, message } = parsed.data;
    // Normalize EVM addresses to lowercase for storage/lookup consistency.
    const address = chainType === 'evm' ? rawAddress.toLowerCase() : rawAddress;
    const payload = req.user as { sub: string };

    let ok = false;
    if (chainType === 'zion-l1') {
      if (!publicKey) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'publicKey is required for zion-l1' });
      }
      ok = await verifyEd25519(address, signature, publicKey);
    } else if (chainType === 'evm') {
      if (!message) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'message is required for evm' });
      }
      ok = await verifySiwe(address, signature, message);
    } else if (chainType === 'bitcoin') {
      // Bitcoin address linking requires BIP-322 signature verification,
      // which is not implemented yet. Previously any non-empty signature was
      // accepted — that let anyone link an arbitrary BTC address to their
      // account, so the endpoint now fails closed until real verification
      // lands (tracked for the WARP/bridge phase).
      return reply.code(501).send({
        error: 'NOT_IMPLEMENTED',
        message: 'Bitcoin address linking is not available yet (BIP-322 verification pending)',
      });
    } else {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Unsupported chainType' });
    }

    if (!ok) {
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Invalid signature or expired challenge' });
    }

    // Prevent linking an address that already belongs to another user.
    const existing = await app.prisma.linkedAddress.findUnique({ where: { address } });
    if (existing && existing.userId !== payload.sub) {
      return reply.code(409).send({ error: 'CONFLICT', message: 'Address is already linked to another account' });
    }

    const linked = await app.prisma.linkedAddress.upsert({
      where: { address },
      update: { userId: payload.sub, chainType, chainId: chainId ?? null },
      create: { userId: payload.sub, address, chainType, chainId: chainId ?? null },
    });

    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    if (!user) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }

    return { linked, user };
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

  return issueSessionForUser(app, req, reply, user, address, chainType);
}
