// ZIS — ZION Identity Service
// auth.zionterranova.com
//
// Ed25519 (ZION L1 native) + EVM SIWE (Sign-In with Ethereum) auth.
// Issues JWTs valid across all *.zionterranova.com apps (SSO).

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/session.js';
import { apiKeyRoutes } from './routes/apikey.js';
import { healthRoutes } from './routes/health.js';
import { wellKnownRoutes } from './routes/wellknown.js';
import { logger } from './lib/logger.js';

const prisma = new PrismaClient();

const app = Fastify({
  logger,
  trustProxy: true,
});

const PORT = Number(process.env.PORT ?? 8096);
const HOST = process.env.HOST ?? '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? '.zionterranova.com';

async function start() {
  // ── Plugins ─────────────────────────────────────────────────────
  await app.register(cookie, {
    secret: JWT_SECRET,
  });

  await app.register(cors, {
    origin: [
      'https://zionterranova.com',
      'https://app.zionterranova.com',
      'https://market.zionterranova.com',
      'https://oasis.zionterranova.com',
      'https://dashboard.zionterranova.com',
    ],
    credentials: true,
  });

  await app.register(jwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: '7d' },
    cookie: {
      cookieName: 'zion_session',
      signed: true,
    },
  });

  await app.register(rateLimit, {
    max: 30,
    timeWindow: '1 minute',
  });

  // ── Decorate ────────────────────────────────────────────────────
  app.decorate('prisma', prisma);
  app.decorate('cookieDomain', COOKIE_DOMAIN);

  // ── Routes ──────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(sessionRoutes, { prefix: '/api/session' });
  await app.register(apiKeyRoutes, { prefix: '/api/keys' });
  await app.register(wellKnownRoutes, { prefix: '/.well-known' });

  // ── Error handler ───────────────────────────────────────────────
  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err }, 'Unhandled error');
    reply.status(err.statusCode ?? 500).send({
      error: err.code ?? 'INTERNAL',
      message: err.message,
    });
  });

  // ── Start ───────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`ZIS listening on ${HOST}:${PORT}`);
}

start()
  .catch((err) => {
    app.log.error({ err }, 'Fatal start error');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { app };
