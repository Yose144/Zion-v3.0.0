import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  createChallenge,
  verifyEd25519,
  verifySiwe,
  verifySolana,
  verifyBitcoin,
  verifyQuantusAttestation,
} from '../lib/challenge.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { requireAuth } from '../lib/auth.js';
import { issueSessionForUser } from '../lib/session-issue.js';
import { renderAvatarSvg, AVATAR_STYLES } from '../lib/avatar.js';
import { loadNftConfig, resolveNftAvatar, NftError } from '../lib/nft.js';
import { createHash } from 'node:crypto';

const ChallengeSchema = z.object({
  address: z.string().min(8),
  chainType: z
    .enum(['zion-l1', 'evm', 'bitcoin', 'solana', 'quantus'])
    .default('zion-l1'),
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

const NftAvatarSchema = z.object({
  contract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokenId: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((v) => BigInt(v)),
});

const LinkAddressSchema = z.object({
  address: z.string().min(8),
  chainType: z.enum(['zion-l1', 'evm', 'bitcoin', 'solana', 'quantus']),
  chainId: z.string().optional(),
  // Ed25519 linking
  publicKey: z.string().optional(),
  signature: z.string().min(1),
  // SIWE linking
  message: z.string().optional(),
  // Quantus attestation: the challenge is issued for this ZION address and
  // the signature binds `challenge + "\nquantus:" + address`.
  zionAddress: z.string().optional(),
  zionPublicKey: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /avatar/:file.svg ───────────────────────────────────────
  // Public deterministic avatar renderer. Seed = filename without the
  // `.svg` suffix (user id, zion1 address, 0x address — any stable
  // identity string). `s` = variant seed, `t` = style, `sz` = size.
  // The URL is content-addressed by its params → immutable caching.
  app.get(
    '/avatar/:file',
    // Avatars render on every page view — keep abuse protection but way
    // above the global 30/min auth budget.
    { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } },
    async (req, reply) => {
    const { file } = req.params as { file: string };
    if (!file.endsWith('.svg') || file.length > 140) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Expected <seed>.svg' });
    }
    const seed = file.slice(0, -4);
    const q = req.query as { s?: string; t?: string; sz?: string; a?: string };
    const variant = Math.min(Math.max(parseInt(q.s ?? '0', 10) || 0, 0), 1_000_000);
    const style = (AVATAR_STYLES as readonly string[]).includes(q.t ?? '') ? q.t! : 'sigil';
    const size = Math.min(Math.max(parseInt(q.sz ?? '128', 10) || 128, 16), 512);
    const animated = q.a === '1' || q.a === 'true';

    const svg = renderAvatarSvg(seed, variant, style, size, animated);
    return reply
      .header('Content-Type', 'image/svg+xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .send(svg);
    },
  );

  // ── Uploaded avatar storage ─────────────────────────────────────
  // POST /avatar/upload accepts a raw image body (no multipart dep):
  //   Content-Type: image/png|jpeg|webp|gif, ≤256 KiB, magic-byte checked.
  //   Stored in AvatarAsset (Postgres bytea) and user.avatar is set to
  //   the public serve URL /api/auth/avatar/u/<userId>.
  // GET  /avatar/u/:userId serves the bytes (public, moderate cache).
  // DELETE /avatar/upload removes the upload → generated fallback.
  const AVATAR_MIME_MAGIC: Array<[string, number[]]> = [
    ['image/png', [0x89, 0x50, 0x4e, 0x47]],
    ['image/jpeg', [0xff, 0xd8, 0xff]],
    ['image/webp', [0x52, 0x49, 0x46, 0x46]], // RIFF (+WEBP at offset 8)
    ['image/gif', [0x47, 0x49, 0x46, 0x38]], // GIF8
  ];
  const AVATAR_MAX_BYTES = 256 * 1024;

  app.addContentTypeParser(
    ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    { parseAs: 'buffer', bodyLimit: AVATAR_MAX_BYTES },
    (_req, body, done) => done(null, body),
  );

  function sniffAvatarMime(buf: Buffer): string | null {
    for (const [mime, magic] of AVATAR_MIME_MAGIC) {
      if (buf.length >= magic.length && magic.every((b, i) => buf[i] === b)) {
        if (mime === 'image/webp' && buf.slice(8, 12).toString('ascii') !== 'WEBP') continue;
        return mime;
      }
    }
    return null;
  }

  const uploadedAvatarUrl = (userId: string): string => {
    // Always the public origin — requests arriving through the website
    // proxy carry an internal Host, which would persist an unusable URL.
    const base = process.env.ZIS_PUBLIC_URL ?? 'https://auth.zionterranova.com';
    return `${base}/api/auth/avatar/u/${encodeURIComponent(userId)}`;
  };

  // GET /avatar/u/:userId — serve an uploaded avatar (public)
  app.get('/avatar/u/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    if (!userId || userId.length > 64) {
      return reply.code(400).send({ error: 'BAD_REQUEST' });
    }
    const asset = await app.prisma.avatarAsset.findUnique({ where: { userId } });
    if (!asset) return reply.code(404).send({ error: 'NOT_FOUND' });
    const etag = `"${createHash('sha256').update(asset.data).digest('hex').slice(0, 32)}"`;
    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send();
    }
    return reply
      .header('Content-Type', asset.mime)
      .header('Cache-Control', 'public, max-age=300')
      .header('X-Content-Type-Options', 'nosniff')
      .header('ETag', etag)
      .send(Buffer.from(asset.data));
  });

  // POST /avatar/upload — authenticated raster upload
  app.post('/avatar/upload', { preHandler: [requireAuth] }, async (req, reply) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Expected an image body' });
    }
    if (buf.length > AVATAR_MAX_BYTES) {
      return reply.code(413).send({ error: 'PAYLOAD_TOO_LARGE', message: 'Max 256 KiB' });
    }
    const mime = sniffAvatarMime(buf);
    const declared = (req.headers['content-type'] ?? '').split(';')[0];
    if (!mime || mime !== declared) {
      return reply.code(400).send({ error: 'BAD_IMAGE', message: 'Unsupported or corrupt image' });
    }

    const payload = req.user as { sub: string };
    const userId = payload.sub;
    await app.prisma.avatarAsset.upsert({
      where: { userId },
      create: { userId, data: buf, mime },
      update: { data: buf, mime },
    });
    const url = uploadedAvatarUrl(userId);
    await app.prisma.user.update({ where: { id: userId }, data: { avatar: url } });
    return { ok: true, avatar: url };
  });

  // DELETE /avatar/upload — remove upload, fall back to generated avatar
  app.delete('/avatar/upload', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    await app.prisma.avatarAsset.deleteMany({ where: { userId: payload.sub } });
    const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
    if (user?.avatar?.includes('/api/auth/avatar/u/')) {
      await app.prisma.user.update({ where: { id: payload.sub }, data: { avatar: null } });
    }
    return { ok: true };
  });

  // ── POST /avatar/nft — bind an owned ERC-1155 token image ────────
  // Verifies on-chain ownership against the caller's linked EVM
  // addresses, resolves token metadata → image, stores it as
  // user.avatar. Enabled via ZIS_NFT_BIND=1 + ZIS_NFT_CONTRACTS allowlist.
  app.post('/avatar/nft', { preHandler: [requireAuth] }, async (req, reply) => {
    const cfg = loadNftConfig();
    if (!cfg.enabled) {
      return reply
        .code(503)
        .send({ error: 'NFT_BIND_DISABLED', message: 'NFT avatar binding is not enabled' });
    }
    const parsed = NftAvatarSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const contract = parsed.data.contract.toLowerCase();
    if (cfg.allowedContracts.size > 0 && !cfg.allowedContracts.has(contract)) {
      return reply.code(403).send({ error: 'CONTRACT_NOT_ALLOWED', message: 'Contract not allowlisted' });
    }
    const { sub: userId } = req.user as { sub: string };
    const links = await app.prisma.linkedAddress.findMany({
      where: { userId, chainType: 'evm' },
    });
    if (links.length === 0) {
      return reply
        .code(422)
        .send({ error: 'NO_EVM_ADDRESS', message: 'Link an EVM address first' });
    }
    try {
      const { avatar, owner } = await resolveNftAvatar(
        cfg,
        contract,
        parsed.data.tokenId,
        links.map((l) => l.address),
      );
      await app.prisma.user.update({ where: { id: userId }, data: { avatar } });
      return {
        ok: true,
        avatar,
        owner,
        contract,
        tokenId: parsed.data.tokenId.toString(),
      };
    } catch (e) {
      if (e instanceof NftError) {
        const status = e.code === 'NOT_OWNER' ? 403 : e.code === 'NO_METADATA_IMAGE' || e.code === 'BAD_IMAGE_URL' || e.code === 'BAD_TOKEN_URI' ? 404 : 502;
        return reply.code(status).send({ error: e.code, message: e.message });
      }
      throw e;
    }
  });

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
      const payload = req.user as { sub?: string; jti?: string };
      if (payload?.jti && payload?.sub) {
        // Only revoke a session that actually belongs to the token subject —
        // a forged token must not be able to kill another user's session.
        await app.prisma.session.updateMany({
          where: { jwtJti: payload.jti, userId: payload.sub },
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
    const {
      address: rawAddress,
      chainType,
      chainId,
      publicKey,
      signature,
      message,
      zionAddress,
      zionPublicKey,
    } = parsed.data;
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
      // Custom proof-of-key: recoverable ECDSA over
      // sha256("ZION-BTC-LINK-V1"‖0x00‖challenge); server recomputes the
      // P2WPKH address from the recovered pubkey.
      ok = await verifyBitcoin(address, signature);
    } else if (chainType === 'solana') {
      // Solana address = base58(ed25519 pubkey) — the signature verifies
      // against the address itself.
      ok = await verifySolana(address, signature);
    } else if (chainType === 'quantus') {
      // ML-DSA-87 has no JS implementation — the client attests with the
      // ZION key derived from the same mnemonic.
      if (!zionAddress || !zionPublicKey) {
        return reply.code(400).send({
          error: 'BAD_REQUEST',
          message: 'zionAddress and zionPublicKey are required for quantus',
        });
      }
      ok = await verifyQuantusAttestation(zionAddress, zionPublicKey, signature, address);
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
