import type { FastifyInstance } from 'fastify';
import { getJwksDocument, getJwtConfig } from '../lib/keys.js';

// JWKS + service metadata for cross-domain SSO discovery.
export async function wellKnownRoutes(app: FastifyInstance): Promise<void> {
  app.get('/zion-identity', async () => {
    const cfg = getJwtConfig();
    return {
      issuer: 'https://auth.zionterranova.com',
      auth_endpoint: '/api/auth/challenge',
      verify_endpoints: {
        dispatcher: '/api/auth/verify',
        ed25519: '/api/auth/verify/ed25519',
        siwe: '/api/auth/verify/siwe',
        google: '/api/auth/verify/google',
        passkey: '/api/auth/webauthn/login/verify',
      },
      session_endpoint: '/api/session',
      keys_endpoint: '/.well-known/jwks.json',
      supported_methods: ['ed25519', 'siwe', 'google', 'passkey'],
      jwt_alg: cfg.mode === 'eddsa' ? 'EdDSA' : 'HS256',
      cookie_domain: '.zionterranova.com',
    };
  });

  app.get('/jwks.json', async () => {
    // EdDSA mode: the real Ed25519 public JWK. Legacy HS256 mode publishes
    // an empty set — symmetric secrets must never appear in a JWKS, and
    // consumers should verify sessions via /api/auth/me instead.
    return getJwksDocument();
  });
}
