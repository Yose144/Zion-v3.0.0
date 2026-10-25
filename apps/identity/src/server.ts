// ZIS — ZION Identity Service
// auth.zionterranova.com
//
// Ed25519 (ZION L1 native) + EVM SIWE + Google OIDC + WebAuthn auth.
// Issues JWTs valid across all *.zionterranova.com apps (SSO).

import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';

import { authRoutes } from './routes/auth.js';
import { webauthnRoutes } from './routes/webauthn.js';
import { sessionRoutes } from './routes/session.js';
import { apiKeyRoutes } from './routes/apikey.js';
import { notificationRoutes } from './routes/notifications.js';
import { walletRoutes } from './routes/wallet.js';
import { healthRoutes } from './routes/health.js';
import { wellKnownRoutes } from './routes/wellknown.js';
import { adminRoutes } from './routes/admin.js';
import { metricsRoutes } from './routes/metrics.js';
import { logger } from './lib/logger.js';
import { getJwtConfig, verifyLegacyToken } from './lib/keys.js';
import { extractSessionToken, isServiceRequest } from './lib/auth.js';
import { registerMetrics } from './lib/metrics.js';
import { pruneChallenges } from './lib/challenge.js';
import { pruneCeremonies } from './lib/webauthn.js';
import { pruneVerificationTokens } from './lib/email.js';
import { pruneAuthEvents } from './lib/audit.js';

const prisma = new PrismaClient();

const app = Fastify({
  loggerInstance: logger,
  trustProxy: true,
});

const PORT = Number(process.env.PORT ?? 8096);
const HOST = process.env.HOST ?? '0.0.0.0';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? '.zionterranova.com';

const jwtCfg = getJwtConfig();
// Cookie signature priority: dedicated COOKIE_SECRET, then JWT_SECRET, then
// the key-derived fallback (eddsa). All are real secrets — no literal
// fallback exists anywhere in the process.
const COOKIE_SECRET =
  process.env.COOKIE_SECRET ?? process.env.JWT_SECRET ?? jwtCfg.cookieSecret;

async function start() {
  // ── Plugins ─────────────────────────────────────────────────────
  await app.register(cookie, {
    // The cookie-signing secret is independent of the JWT algorithm —
    // HS256→EdDSA migration does not invalidate cookie signatures.
    secret: COOKIE_SECRET,
  });

  await app.register(cors, {
    origin: [
      'https://zionterranova.com',
      'https://app.zionterranova.com',
      'https://market.zionterranova.com',
      'https://oasis.zionterranova.com',
      'https://dashboard.zionterranova.com',
      'https://freeworld.zionterranova.com',
      'https://pool.zionterranova.com',
    ],
    credentials: true,
  });

  await app.register(jwt, {
    ...jwtCfg.pluginOptions,
    cookie: {
      cookieName: 'zion_session',
      signed: true,
    },
  });

  await app.register(rateLimit, {
    max: 30,
    timeWindow: '1 minute',
    // Bucket per authenticated user when the request carries a valid session:
    // server-side callers (warpd) proxy many users through one egress IP, so a
    // per-IP key would share a single bucket across all users. Invalid/forged
    // tokens fall back to the caller IP — brute-force protection is preserved.
    // Callers presenting the ZIS_SERVICE_KEY in `x-service-key` (e.g. the
    // mining pool's /api/keys/verify probes) get their own service bucket so
    // service traffic never competes with the caller's IP bucket.
    keyGenerator: (req) => {
      if (isServiceRequest(req)) {
        const hdr = req.headers['x-service-key'] as string;
        return `svc:${hdr.slice(0, 12)}`;
      }
      const token = extractSessionToken(req);
      if (token) {
        try {
          const payload = app.jwt.verify<{ sub?: string }>(token);
          if (payload?.sub) return `sess:${payload.sub}`;
        } catch { /* try legacy */ }
        const legacy = verifyLegacyToken(token);
        if (legacy?.sub) return `sess:${String(legacy.sub)}`;
      }
      return req.ip;
    },
  });

  // ── Decorate ────────────────────────────────────────────────────
  app.decorate('prisma', prisma);
  app.decorate('cookieDomain', COOKIE_DOMAIN);

  // ── Metrics (counters + gauges + per-route http_requests hook) ────
  registerMetrics(app);

  // ── Routes ──────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(metricsRoutes, { prefix: '/metrics' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(webauthnRoutes, { prefix: '/api/auth/webauthn' });
  await app.register(sessionRoutes, { prefix: '/api/session' });
  await app.register(apiKeyRoutes, { prefix: '/api/keys' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(walletRoutes, { prefix: '/api/wallet' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(wellKnownRoutes, { prefix: '/.well-known' });

  // ── Error handler ───────────────────────────────────────────────
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    app.log.error({ err }, 'Unhandled error');
    reply.status(err.statusCode ?? 500).send({
      error: err.code ?? 'INTERNAL',
      message: err.message,
    });
  });

  // ── Prune job ───────────────────────────────────────────────────
  // Hourly: expired challenges/ceremonies/tokens, dead sessions, old
  // audit events. Runs unref'd — never keeps the process alive.
  const prune = async () => {
    try {
      const [ch, ce, vt, sess, ev] = await Promise.all([
        pruneChallenges(prisma),
        pruneCeremonies(prisma),
        pruneVerificationTokens(prisma),
        prisma.session.deleteMany({
          where: { expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        }),
        pruneAuthEvents(prisma, 180),
      ]);
      const counts = { challenges: ch, ceremonies: ce, tokens: vt, sessions: sess.count, events: ev };
      if (Object.values(counts).some((n) => n > 0)) {
        app.log.info(counts, 'prune job removed expired rows');
      }
    } catch (err) {
      app.log.warn({ err }, 'prune job failed');
    }
  };
  setInterval(prune, 60 * 60 * 1000).unref();
  setTimeout(prune, 30 * 1000).unref(); // first pass shortly after boot

  // ── Start ───────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`ZIS listening on ${HOST}:${PORT} (jwt=${jwtCfg.mode}, kid=${jwtCfg.kid})`);
}

start()
  .catch((err) => {
    app.log.error({ err }, 'Fatal start error');
    process.exit(1);
  });

// Prisma disconnects on shutdown, not after listen — the previous
// `.finally()` closed the pool the moment the server started.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

export { app };
