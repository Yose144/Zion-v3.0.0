import type { FastifyInstance } from 'fastify';

// JWKS + service metadata for cross-domain SSO discovery.
export async function wellKnownRoutes(app: FastifyInstance): Promise<void> {
  app.get('/zion-identity', async () => ({
    issuer: 'https://auth.zionterranova.com',
    auth_endpoint: '/api/auth/challenge',
    verify_endpoint: '/api/auth/verify',
    session_endpoint: '/api/session',
    keys_endpoint: '/.well-known/jwks.json',
    supported_methods: ['ed25519', 'siwe', 'google'],
    cookie_domain: '.zionterranova.com',
  }));

  app.get('/jwks.json', async () => {
    // In production, load from env / KMS. For now, return HS256 placeholder.
    return {
      keys: [
        {
          kty: 'oct',
          alg: 'HS256',
          use: 'sig',
          kid: 'zis-default',
        },
      ],
    };
  });
}
