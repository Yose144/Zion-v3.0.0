// WebAuthn / passkey routes for ZIS.
//
//   POST /api/auth/webauthn/register/options   — begin passkey registration (auth)
//   POST /api/auth/webauthn/register/verify    — finish registration, store credential (auth)
//   POST /api/auth/webauthn/login/options      — begin passkey login (anonymous)
//   POST /api/auth/webauthn/login/verify       — finish login, issue zion_session (anonymous)
//   GET  /api/auth/webauthn/credentials        — list own passkeys (auth)
//   DELETE /api/auth/webauthn/credentials/:id  — delete own passkey (auth)

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

import { requireAuth, type JwtPayload } from '../lib/auth.js';
import { issueSessionForUser } from '../lib/session-issue.js';
import { getWebAuthnConfig, createCeremony, takeCeremony } from '../lib/webauthn.js';

const MAX_CREDENTIALS_PER_USER = 10;
const CEREMONY_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: '1 minute' } };

const RegisterVerifySchema = z.object({
  ceremonyId: z.string().min(1),
  response: z.record(z.unknown()),
  label: z.string().max(64).optional(),
});

const LoginVerifySchema = z.object({
  ceremonyId: z.string().min(1),
  response: z.object({ id: z.string().min(1) }).passthrough(),
});

export interface WebAuthnDeps {
  generateRegistrationOptions: typeof generateRegistrationOptions;
  verifyRegistrationResponse: typeof verifyRegistrationResponse;
  generateAuthenticationOptions: typeof generateAuthenticationOptions;
  verifyAuthenticationResponse: typeof verifyAuthenticationResponse;
}

interface CredentialSummary {
  id: string;
  credentialId: string;
  label: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
}

function toSummary(c: CredentialSummary) {
  // Never expose the COSE public key.
  return {
    id: c.id,
    credentialId: c.credentialId,
    label: c.label,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    transports: c.transports,
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt,
  };
}

export async function webauthnRoutes(
  app: FastifyInstance,
  opts?: { deps?: Partial<WebAuthnDeps> },
): Promise<void> {
  const deps: WebAuthnDeps = {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
    ...opts?.deps,
  };

  // ── POST /register/options ────────────────────────────────────────
  app.post(
    '/register/options',
    { preHandler: [requireAuth], config: CEREMONY_RATE_LIMIT },
    async (req, reply) => {
      const payload = req.user as JwtPayload;
      const cfg = getWebAuthnConfig();

      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not found' });
      }

      const existing = await app.prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
      });
      if (existing.length >= MAX_CREDENTIALS_PER_USER) {
        return reply.code(409).send({
          error: 'LIMIT',
          message: `Maximum of ${MAX_CREDENTIALS_PER_USER} passkeys per account`,
        });
      }

      const options = await deps.generateRegistrationOptions({
        rpName: cfg.rpName,
        rpID: cfg.rpId,
        userName: user.displayName ?? user.primaryAddress,
        userID: new TextEncoder().encode(user.id),
        attestationType: 'none',
        excludeCredentials: existing.map((c) => ({
          id: c.credentialId,
          transports: c.transports as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
      });

      const ceremonyId = createCeremony('register', options.challenge, user.id);
      return { ceremonyId, options };
    },
  );

  // ── POST /register/verify ─────────────────────────────────────────
  app.post(
    '/register/verify',
    { preHandler: [requireAuth], config: CEREMONY_RATE_LIMIT },
    async (req, reply) => {
      const parsed = RegisterVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
      }
      const { ceremonyId, response, label } = parsed.data;
      const payload = req.user as JwtPayload;
      const cfg = getWebAuthnConfig();

      const ceremony = takeCeremony(ceremonyId, 'register');
      if (!ceremony || ceremony.userId !== payload.sub) {
        return reply.code(400).send({ error: 'CEREMONY_INVALID', message: 'Unknown or expired ceremony' });
      }

      let verification;
      try {
        verification = await deps.verifyRegistrationResponse({
          response: response as unknown as RegistrationResponseJSON,
          expectedChallenge: ceremony.challenge,
          expectedOrigin: cfg.origins,
          expectedRPID: cfg.rpId,
          requireUserVerification: false,
        });
      } catch {
        return reply.code(400).send({ error: 'VERIFY_FAILED', message: 'Passkey verification failed' });
      }
      if (!verification.verified || !verification.registrationInfo) {
        return reply.code(400).send({ error: 'VERIFY_FAILED', message: 'Passkey verification failed' });
      }

      const info = verification.registrationInfo;
      try {
        const credential = await app.prisma.webAuthnCredential.create({
          data: {
            userId: payload.sub,
            credentialId: info.credential.id,
            publicKey: Buffer.from(info.credential.publicKey),
            counter: info.credential.counter,
            transports: info.credential.transports ?? [],
            deviceType: info.credentialDeviceType,
            backedUp: info.credentialBackedUp,
            label: label ?? null,
          },
        });
        return { credential: toSummary(credential) };
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') {
          return reply.code(409).send({ error: 'CONFLICT', message: 'Passkey already registered' });
        }
        throw err;
      }
    },
  );

  // ── POST /login/options ───────────────────────────────────────────
  app.post(
    '/login/options',
    { config: CEREMONY_RATE_LIMIT },
    async () => {
      const cfg = getWebAuthnConfig();
      const options = await deps.generateAuthenticationOptions({
        rpID: cfg.rpId,
        userVerification: 'preferred',
        allowCredentials: [],
      });
      const ceremonyId = createCeremony('login', options.challenge);
      return { ceremonyId, options };
    },
  );

  // ── POST /login/verify ────────────────────────────────────────────
  app.post(
    '/login/verify',
    { config: CEREMONY_RATE_LIMIT },
    async (req: FastifyRequest, reply) => {
      const parsed = LoginVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'BAD_REQUEST', details: parsed.error.issues });
      }
      const { ceremonyId, response } = parsed.data;
      const cfg = getWebAuthnConfig();

      const ceremony = takeCeremony(ceremonyId, 'login');
      if (!ceremony) {
        return reply.code(400).send({ error: 'CEREMONY_INVALID', message: 'Unknown or expired ceremony' });
      }

      const credential = await app.prisma.webAuthnCredential.findUnique({
        where: { credentialId: response.id },
      });
      if (!credential) {
        return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Unknown passkey' });
      }

      let verification;
      try {
        verification = await deps.verifyAuthenticationResponse({
          response: response as unknown as AuthenticationResponseJSON,
          expectedChallenge: ceremony.challenge,
          expectedOrigin: cfg.origins,
          expectedRPID: cfg.rpId,
          credential: {
            id: credential.credentialId,
            publicKey: new Uint8Array(credential.publicKey),
            counter: credential.counter,
            transports: credential.transports as AuthenticatorTransportFuture[],
          },
          requireUserVerification: false,
        });
      } catch {
        return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Passkey verification failed' });
      }
      if (!verification.verified) {
        return reply.code(401).send({ error: 'AUTH_FAILED', message: 'Passkey verification failed' });
      }

      await app.prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: {
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        },
      });
      const user = await app.prisma.user.update({
        where: { id: credential.userId },
        data: { lastLogin: new Date(), loginCount: { increment: 1 } },
      });

      return issueSessionForUser(app, req, reply, user, user.primaryAddress, 'passkey');
    },
  );

  // ── GET /credentials ──────────────────────────────────────────────
  app.get('/credentials', { preHandler: [requireAuth] }, async (req) => {
    const payload = req.user as JwtPayload;
    const credentials = await app.prisma.webAuthnCredential.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'asc' },
    });
    return { credentials: credentials.map(toSummary) };
  });

  // ── DELETE /credentials/:id ───────────────────────────────────────
  app.delete('/credentials/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const result = await app.prisma.webAuthnCredential.deleteMany({
      where: { id, userId: payload.sub },
    });
    if (result.count === 0) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Passkey not found' });
    }
    return { ok: true };
  });
}
