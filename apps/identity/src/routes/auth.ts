import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  createChallenge,
  verifyEd25519,
  verifySiwe,
  verifySolana,
  verifyBitcoin,
  verifyQuantusAttestation,
  verifyPearlAttestation,
} from '../lib/challenge.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { requireAuth } from '../lib/auth.js';
import { issueSessionForUser } from '../lib/session-issue.js';
import { renderAvatarSvg, AVATAR_STYLES } from '../lib/avatar.js';
import { loadNftConfig, resolveNftAvatar, NftError } from '../lib/nft.js';
import {
  getEmailConfig,
  requestEmailVerification,
  consumeEmailVerification,
  EmailError,
} from '../lib/email.js';
import { auditBg } from '../lib/audit.js';
import { inc, M } from '../lib/metrics.js';
import { createHash } from 'node:crypto';

const CHAIN_TYPES = ['zion-l1', 'evm', 'bitcoin', 'solana', 'quantus', 'pearl'] as const;

const ChallengeSchema = z.object({
  address: z.string().min(8),
  chainType: z
    .enum(CHAIN_TYPES)
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

// Unified verify dispatcher — the endpoint advertised by
// /.well-known/zion-identity. `method` selects the verifier, the rest of
// the body mirrors the per-method routes.
const VerifyDispatchSchema = z.object({
  method: z.enum(['ed25519', 'siwe', 'google']),
  address: z.string().optional(),
  publicKey: z.string().optional(),
  signature: z.string().optional(),
  message: z.string().optional(),
  idToken: z.string().optional(),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  email: z.string().email().max(255).optional().nullable(),
  avatar: z.string().url().max(512).optional().nullable(),
  bio: z.string().max(512).optional().nullable(),
  avatar3d: z
    .object({
      callsign: z.string().max(24).optional(),
      bodyType: z.enum(['slim', 'standard', 'heavy']).optional(),
      neonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      augmentation: z.enum(['reflexes', 'neural', 'tech', 'bio', 'stealth']).optional(),
    })
    .optional()
    .nullable(),
});

const NftAvatarSchema = z.object({
  contract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokenId: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((v) => BigInt(v)),
});

const LinkAddressSchema = z.object({
  address: z.string().min(8),
  chainType: z.enum([...CHAIN_TYPES, 'google']),
  chainId: z.string().optional(),
  // Ed25519 linking
  publicKey: z.string().optional(),
  signature: z.string().min(1).optional(),
  // SIWE linking
  message: z.string().optional(),
  // Google linking
  idToken: z.string().optional(),
  // Quantus/Pearl attestation: the challenge is issued for this ZION
  // address and the signature binds `challenge + "\n<chain>:" + address`.
  zionAddress: z.string().optional(),
  zionPublicKey: z.string().optional(),
});

const DeleteAccountSchema = z.object({
  address: z.string().min(8),
  chainType: z.enum([...CHAIN_TYPES, 'google']),
  publicKey: z.string().optional(),
  signature: z.string().min(1).optional(),
  message: z.string().optional(),
  idToken: z.string().optional(),
  zionAddress: z.string().optional(),
  zionPublicKey: z.string().optional(),
});

const SetPrimarySchema = z.object({
  address: z.string().min(8),
});

const EmailVerifyRequestSchema = z.object({
  email: z.string().email().max(255),
});

/**
 * Run the proof-of-key verifier appropriate for `chainType`.
 * Returns true when the caller proved control of `address`.
 */
async function verifyOwnership(
  app: FastifyInstance,
  input: {
    address: string;
    chainType: string;
    signature?: string;
    publicKey?: string;
    message?: string;
    idToken?: string;
    zionAddress?: string;
    zionPublicKey?: string;
  },
): Promise<boolean> {
  const prisma = app.prisma;
  const { address, chainType, signature, publicKey, message, idToken, zionAddress, zionPublicKey } = input;
  switch (chainType) {
    case 'zion-l1':
      if (!signature || !publicKey) return false;
      return verifyEd25519(prisma, address, signature, publicKey);
    case 'evm':
      if (!signature || !message) return false;
      return verifySiwe(prisma, address, signature, message);
    case 'bitcoin':
      if (!signature) return false;
      return verifyBitcoin(prisma, address, signature);
    case 'solana':
      if (!signature) return false;
      return verifySolana(prisma, address, signature);
    case 'quantus':
      if (!signature || !zionAddress || !zionPublicKey) return false;
      return verifyQuantusAttestation(prisma, zionAddress, zionPublicKey, signature, address);
    case 'pearl':
      if (!signature || !zionAddress || !zionPublicKey) return false;
      return verifyPearlAttestation(prisma, zionAddress, zionPublicKey, signature, address);
    case 'google': {
      if (!idToken) return false;
      try {
        const g = await verifyGoogleIdToken(idToken);
        return `google:${g.sub}` === address;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

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
    const challenge = await createChallenge(app.prisma, address);
    inc(M.authChallenge, { chain: chainType });
    return {
      challenge,
      chainType,
      expiresInMs: 300_000,
    };
  });

  // ── Shared verify helpers ───────────────────────────────────────
  async function verifyEd25519Handler(
    req: FastifyRequest,
    reply: FastifyReply,
    body: unknown,
  ) {
    const parsed = VerifyEd25519Schema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { address, publicKey, signature } = parsed.data;

    const ok = await verifyEd25519(app.prisma, address, signature, publicKey);
    if (!ok) {
      inc(M.authVerify, { method: 'ed25519', result: 'fail' });
      auditBg(app, req, { kind: 'login_failed', address, chainType: 'zion-l1' });
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Invalid signature' });
    }
    inc(M.authVerify, { method: 'ed25519', result: 'ok' });
    return issueSession(app, req, reply, address, 'zion-l1');
  }

  async function verifySiweHandler(
    req: FastifyRequest,
    reply: FastifyReply,
    body: unknown,
  ) {
    const parsed = VerifySiweSchema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { address, message, signature } = parsed.data;

    const ok = await verifySiwe(app.prisma, address, signature, message);
    if (!ok) {
      inc(M.authVerify, { method: 'siwe', result: 'fail' });
      auditBg(app, req, { kind: 'login_failed', address, chainType: 'evm' });
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'SIWE verification failed' });
    }
    inc(M.authVerify, { method: 'siwe', result: 'ok' });
    // Normalize the EVM address to lowercase so 0xABC… and 0xabc… cannot
    // create duplicate accounts for the same wallet.
    return issueSession(app, req, reply, address.toLowerCase(), 'evm');
  }

  async function verifyGoogleHandler(
    req: FastifyRequest,
    reply: FastifyReply,
    body: unknown,
  ) {
    const parsed = VerifyGoogleSchema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { idToken } = parsed.data;

    let googleUser;
    try {
      googleUser = await verifyGoogleIdToken(idToken);
    } catch (err) {
      inc(M.authVerify, { method: 'google', result: 'fail' });
      return reply.code(401).send({
        error: 'AUTH_FAILED',
        message: err instanceof Error ? err.message : 'Google verification failed',
      });
    }
    inc(M.authVerify, { method: 'google', result: 'ok' });

    const primaryAddress = `google:${googleUser.sub}`;
    const email = googleUser.email ?? undefined;

    // Owner-wins: if `google:<sub>` is already linked to an account (e.g.
    // via POST /link on a wallet account), the session lands there — not
    // on a fresh google-primary account.
    const linked = await app.prisma.linkedAddress.findUnique({
      where: { address: primaryAddress },
    });

    const enrich = {
      lastLogin: new Date(),
      loginCount: { increment: 1 },
      ...(email ? { email } : {}),
      ...(googleUser.name ? { displayName: googleUser.name } : {}),
      ...(googleUser.picture ? { avatar: googleUser.picture } : {}),
    };

    let user;
    if (linked) {
      user = await app.prisma.user.update({
        where: { id: linked.userId },
        data: enrich,
      });
      // Back-fill googleId on accounts that linked Google before it was
      // a first-class field.
      if (!user.googleId) {
        user = await app.prisma.user.update({
          where: { id: linked.userId },
          data: { googleId: googleUser.sub },
        });
      }
    }
    if (!user) {
      user = await app.prisma.user.upsert({
        where: { primaryAddress },
        update: enrich,
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
    }

    return issueSessionForUser(app, req, reply, user, primaryAddress, 'google');
  }

  // ── POST /verify/ed25519 ────────────────────────────────────────
  app.post('/verify/ed25519', async (req, reply) => verifyEd25519Handler(req, reply, req.body));

  // ── POST /verify/siwe ───────────────────────────────────────────
  app.post('/verify/siwe', async (req, reply) => verifySiweHandler(req, reply, req.body));

  // ── POST /verify/google ─────────────────────────────────────────
  app.post('/verify/google', async (req, reply) => verifyGoogleHandler(req, reply, req.body));

  // ── POST /verify — dispatcher advertised by /.well-known ────────
  app.post('/verify', async (req, reply) => {
    const parsed = VerifyDispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const { method, ...rest } = parsed.data;
    if (method === 'ed25519') return verifyEd25519Handler(req, reply, rest);
    if (method === 'siwe') return verifySiweHandler(req, reply, rest);
    return verifyGoogleHandler(req, reply, rest);
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
    if ('email' in data) {
      update.email = data.email;
      // A changed address is unverified until the mail flow completes.
      update.emailVerifiedAt = null;
    }
    if ('avatar' in data) update.avatar = data.avatar;
    if ('avatar3d' in data) update.avatar3d = data.avatar3d ?? null;
    if ('bio' in data) update.bio = data.bio;

    const user = await app.prisma.user.update({
      where: { id: payload.sub },
      data: update,
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    return user;
  });

  // ── DELETE /me — account self-deletion ──────────────────────────
  // Requires a fresh proof-of-key for any address linked to the account
  // (ed25519/siwe/bitcoin/solana/quantus/pearl signature, or a Google
  // idToken for google-bound accounts). Deletes the user row — cascades
  // take linked addresses, sessions, keys, passkeys and avatar assets;
  // auth events survive with userId=NULL.
  app.delete('/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = DeleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const payload = req.user as { sub: string };
    const userId = payload.sub;
    const input = parsed.data;

    // For google the proof address is implied by the idToken sub.
    let proofAddress = input.address;
    if (input.chainType === 'google') {
      if (!input.idToken) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'idToken is required for google' });
      }
      try {
        const g = await verifyGoogleIdToken(input.idToken);
        proofAddress = `google:${g.sub}`;
      } catch {
        return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Google verification failed' });
      }
    }

    // The proof address must belong to this user.
    const owned = await app.prisma.linkedAddress.findFirst({
      where: { userId, address: input.chainType === 'evm' ? proofAddress.toLowerCase() : proofAddress },
    });
    if (!owned) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Proof address is not linked to this account' });
    }

    // Quantus/pearl attestation must also bind an account-owned zionAddress —
    // otherwise any ZION keypair satisfies the re-proof (see /link).
    if (input.chainType === 'quantus' || input.chainType === 'pearl') {
      const zionOwned = await app.prisma.linkedAddress.findFirst({
        where: { userId, address: input.zionAddress ?? '' },
      });
      const delUser = await app.prisma.user.findUnique({
        where: { id: userId }, select: { primaryAddress: true },
      });
      if (!zionOwned && delUser?.primaryAddress !== input.zionAddress) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Attesting zionAddress is not linked to this account' });
      }
    }

    const ok = input.chainType === 'google'
      ? true // idToken already verified above
      : await verifyOwnership(app, { ...input, address: proofAddress });
    if (!ok) {
      auditBg(app, req, { kind: 'login_failed', userId, address: proofAddress, chainType: input.chainType, meta: { context: 'account_delete' } });
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Invalid proof-of-key' });
    }

    // Audit: the FK SetNulls userId when the user row is deleted below,
    // so the deleted id is duplicated into meta to survive the cascade.
    await app.prisma.authEvent.create({
      data: {
        kind: 'account_delete',
        userId,
        address: proofAddress,
        chainType: input.chainType,
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
        meta: { deletedUserId: userId },
      },
    }).catch(() => {});

    const sessions = await app.prisma.session.deleteMany({ where: { userId } });
    await app.prisma.user.delete({ where: { id: userId } });
    reply.clearCookie('zion_session', { domain: app.cookieDomain });
    return { ok: true, deleted: true, sessionsRevoked: sessions.count };
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
        const res = await app.prisma.session.updateMany({
          where: { jwtJti: payload.jti, userId: payload.sub },
          data: { revoked: true },
        });
        if (res.count > 0) {
          auditBg(app, req, { kind: 'logout', userId: payload.sub, meta: { jti: payload.jti } });
        }
      }
    } catch {
      // invalid/expired token — still clear the cookie below
    }
    reply.clearCookie('zion_session', { domain: app.cookieDomain });
    return { ok: true };
  });

  // ── POST /link ──────────────────────────────────────────────────
  // Link an additional address to the authenticated user's account.
  // The caller must sign a fresh ZIS challenge for the address they want
  // to link — or present a Google idToken for chainType 'google'.
  app.post('/link', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = LinkAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const input = parsed.data;
    const payload = req.user as { sub: string };

    // Resolve the effective linked address (google derives it from the token).
    let address: string;
    let googleSub: string | null = null;
    if (input.chainType === 'google') {
      if (!input.idToken) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'idToken is required for google' });
      }
      try {
        const g = await verifyGoogleIdToken(input.idToken);
        googleSub = g.sub;
        address = `google:${g.sub}`;
      } catch {
        inc(M.link, { chain: 'google', result: 'fail' });
        return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Google verification failed' });
      }
    } else {
      address = input.chainType === 'evm' ? input.address.toLowerCase() : input.address;
    }

    // Conflict checks before the (challenge-consuming) verification.
    const existing = await app.prisma.linkedAddress.findUnique({ where: { address } });
    if (existing && existing.userId !== payload.sub) {
      return reply.code(409).send({ error: 'CONFLICT', message: 'Address is already linked to another account' });
    }
    if (googleSub) {
      const gowner = await app.prisma.user.findUnique({ where: { googleId: googleSub } });
      if (gowner && gowner.id !== payload.sub) {
        return reply.code(409).send({ error: 'CONFLICT', message: 'Google account is already bound to another user' });
      }
    }

    // Quantus/pearl attestation proves control of `zionAddress`, which must
    // itself belong to this account — otherwise any ZION keypair (not bound
    // to the caller's identity) could attest a link.
    if (input.chainType === 'quantus' || input.chainType === 'pearl') {
      const zionLinked = await app.prisma.linkedAddress.findFirst({
        where: { userId: payload.sub, address: input.zionAddress ?? '' },
      });
      const zionIsPrimary = (await app.prisma.user.findUnique({
        where: { id: payload.sub }, select: { primaryAddress: true },
      }))?.primaryAddress === input.zionAddress;
      if (!zionLinked && !zionIsPrimary) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Attesting zionAddress is not linked to this account' });
      }
    }

    const ok = input.chainType === 'google'
      ? true // idToken already verified
      : await verifyOwnership(app, { ...input, address });
    if (!ok) {
      inc(M.link, { chain: input.chainType, result: 'fail' });
      return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Invalid signature or expired challenge' });
    }
    inc(M.link, { chain: input.chainType, result: 'ok' });

    const linked = await app.prisma.linkedAddress.upsert({
      where: { address },
      update: { userId: payload.sub, chainType: input.chainType, chainId: input.chainId ?? null },
      create: { userId: payload.sub, address, chainType: input.chainType, chainId: input.chainId ?? null },
    });
    if (googleSub) {
      await app.prisma.user.update({ where: { id: payload.sub }, data: { googleId: googleSub } });
    }

    auditBg(app, req, { kind: 'link', userId: payload.sub, address, chainType: input.chainType });

    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    if (!user) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }

    return { linked, user };
  });

  // ── DELETE /link/:address — unlink a secondary address ─────────
  // The primary address and the last remaining linked address cannot be
  // removed (POST /primary moves the primary first).
  app.delete('/link/:address', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const raw = decodeURIComponent((req.params as { address: string }).address);
    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { linkedAddresses: true },
    });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });

    const candidates = [raw, raw.toLowerCase()];
    const link = user.linkedAddresses.find((l) => candidates.includes(l.address));
    if (!link) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Address is not linked to this account' });
    }
    if (link.address === user.primaryAddress) {
      return reply.code(409).send({ error: 'CONFLICT', message: 'Cannot unlink the primary address — set a new primary first' });
    }
    if (user.linkedAddresses.length <= 1) {
      return reply.code(409).send({ error: 'CONFLICT', message: 'Cannot unlink the last remaining address' });
    }

    await app.prisma.linkedAddress.delete({ where: { id: link.id } });
    if (link.chainType === 'google' && user.googleId && link.address === `google:${user.googleId}`) {
      await app.prisma.user.update({ where: { id: payload.sub }, data: { googleId: null } });
    }
    auditBg(app, req, { kind: 'unlink', userId: payload.sub, address: link.address, chainType: link.chainType });
    return { ok: true, unlinked: link.address };
  });

  // ── POST /primary — move the primary address ────────────────────
  // The target must be a linked address owned by the caller.
  app.post('/primary', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = SetPrimarySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
    }
    const payload = req.user as { sub: string };
    const raw = parsed.data.address;
    const link = await app.prisma.linkedAddress.findFirst({
      where: { userId: payload.sub, address: { in: [raw, raw.toLowerCase()] } },
    });
    if (!link) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Address is not linked to this account' });
    }
    const previous = (await app.prisma.user.findUnique({ where: { id: payload.sub } }))?.primaryAddress;
    const user = await app.prisma.user.update({
      where: { id: payload.sub },
      data: { primaryAddress: link.address },
      include: { linkedAddresses: true, oasisPlayer: true },
    });
    auditBg(app, req, {
      kind: 'primary_change',
      userId: payload.sub,
      address: link.address,
      meta: { previous },
    });
    return user;
  });

  // ── POST /email/verify/request — send a verification mail ──────
  app.post(
    '/email/verify/request',
    { preHandler: [requireAuth], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = EmailVerifyRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
      }
      const cfg = getEmailConfig();
      if (!cfg.enabled) {
        return reply.code(503).send({ error: 'EMAIL_DISABLED', message: 'E-mail verification is not enabled' });
      }
      const payload = req.user as { sub: string };
      try {
        await requestEmailVerification(app.prisma, payload.sub, parsed.data.email);
        inc(M.emailSent, { result: 'ok' });
        auditBg(app, req, { kind: 'email_verify_request', userId: payload.sub, meta: { email: parsed.data.email } });
        return { ok: true };
      } catch (e) {
        if (e instanceof EmailError) {
          inc(M.emailSent, { result: 'fail' });
          const status = e.code === 'COOLDOWN' ? 429 : e.code === 'DISABLED' ? 503 : 502;
          return reply.code(status).send({ error: e.code, message: e.message });
        }
        throw e;
      }
    },
  );

  // ── GET /email/verify — consume a verification token ────────────
  // Linked from the mail; redirects back to the app on success.
  app.get('/email/verify', async (req, reply) => {
    const { token } = req.query as { token?: string };
    const cfg = getEmailConfig();
    if (!token || token.length > 128) {
      return reply.code(400).send({ error: 'BAD_REQUEST' });
    }
    try {
      const { userId, email } = await consumeEmailVerification(app.prisma, token);
      auditBg(app, null, { kind: 'email_verify', userId, meta: { email } });
      return reply.redirect(`${cfg.redirectUrl}?email_verified=1`);
    } catch (e) {
      if (e instanceof EmailError) {
        return reply.redirect(`${cfg.redirectUrl}?email_verified=0&error=${encodeURIComponent(e.code)}`);
      }
      throw e;
    }
  });
}

async function issueSession(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: import('fastify').FastifyReply,
  address: string,
  chainType: string,
) {
  // Owner-wins: an address already linked to an account authenticates as
  // that account — even when the link is secondary rather than primary.
  // Without this, logging in with a secondary address would silently
  // create a second user owning the same address.
  const existing = await app.prisma.linkedAddress.findUnique({ where: { address } });
  let user;
  if (existing) {
    user = await app.prisma.user.update({
      where: { id: existing.userId },
      data: { lastLogin: new Date(), loginCount: { increment: 1 } },
    });
  } else {
    // Upsert user
    user = await app.prisma.user.upsert({
      where: { primaryAddress: address },
      update: { lastLogin: new Date(), loginCount: { increment: 1 } },
      create: { primaryAddress: address, loginCount: 1, lastLogin: new Date() },
    });
  }

  return issueSessionForUser(app, req, reply, user, address, chainType);
}
