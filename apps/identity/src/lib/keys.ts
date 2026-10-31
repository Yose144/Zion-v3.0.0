// JWT signing-key management for ZIS.
//
// Two modes:
//   eddsa — production. Ed25519 keypair from JWT_PRIVATE_KEY (PEM; may be
//           given base64 or with literal \n escapes). The public key is
//           published at /.well-known/jwks.json so any service can verify
//           tokens without calling back to ZIS.
//   hs256 — legacy/dev fallback. Symmetric JWT_SECRET, no usable JWKS.
//
// The HS256→EdDSA grace period ended 2026-10-28 (cutover 21.10 + 7-day
// session TTL). Legacy-token verification was removed in 3.B5 — tokens
// must verify against the active key only.

import { createPrivateKey, createPublicKey, createHash, type KeyObject } from 'node:crypto';
import type * as fastifyJwtNs from '@fastify/jwt';

type JwtPluginOptions = fastifyJwtNs.FastifyJWTOptions;

export interface ZisJwtConfig {
  mode: 'eddsa' | 'hs256';
  /** Options for @fastify/jwt register(). */
  pluginOptions: JwtPluginOptions;
  /** Public JWK for jwks.json (eddsa) or null (hs256 — nothing publishable). */
  jwk: Record<string, unknown> | null;
  kid: string;
  /**
   * Fallback secret for @fastify/cookie when neither COOKIE_SECRET nor
   * JWT_SECRET is configured. In eddsa mode it is derived deterministically
   * from the private key (cookie sigs stay valid across restarts without
   * copying the JWT key into the env a second time); in hs256 mode it is the
   * JWT secret itself. Never a hardcoded literal.
   */
  cookieSecret: string;
}

let cached: ZisJwtConfig | null = null;

/** Accept PEM either raw, with literal "\n" escapes, or base64-encoded. */
function normalizePem(value: string): string {
  const v = value.trim();
  if (v.includes('-----BEGIN')) {
    return v.replace(/\\n/g, '\n');
  }
  // assume base64 of a PEM
  return Buffer.from(v, 'base64').toString('utf8');
}

function kidFromJwk(jwk: Record<string, unknown>): string {
  const x = typeof jwk.x === 'string' ? jwk.x : JSON.stringify(jwk);
  return `zis-${createHash('sha256').update(x).digest('hex').slice(0, 16)}`;
}

function loadEdDsaConfig(privPemRaw: string): ZisJwtConfig {
  const privPem = normalizePem(privPemRaw);
  const priv: KeyObject = createPrivateKey(privPem);
  if (priv.asymmetricKeyType !== 'ed25519') {
    throw new Error(`JWT_PRIVATE_KEY must be Ed25519, got ${priv.asymmetricKeyType}`);
  }
  const pubPemRaw = process.env.JWT_PUBLIC_KEY;
  const pub: KeyObject = pubPemRaw
    ? createPublicKey(normalizePem(pubPemRaw))
    : createPublicKey(priv);
  const jwk = pub.export({ format: 'jwk' }) as Record<string, unknown>;
  const kid = process.env.JWT_KEY_ID ?? kidFromJwk(jwk);
  return {
    mode: 'eddsa',
    pluginOptions: {
      secret: {
        private: priv.export({ format: 'pem', type: 'pkcs8' }) as string,
        public: pub.export({ format: 'pem', type: 'spki' }) as string,
      },
      sign: { algorithm: 'EdDSA', expiresIn: '7d', iss: 'zis', kid },
      verify: { algorithms: ['EdDSA'] },
    },
    jwk: {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      alg: 'EdDSA',
      use: 'sig',
      kid,
    },
    kid,
    // Deterministic cookie-secret fallback derived from the private key.
    // Domain-separated from the JWT signing use; the private key's blast
    // radius already covers cookie forgery, so derivation adds no new risk.
    cookieSecret: createHash('sha256')
      .update('zis-cookie-v1\n')
      .update(privPem)
      .digest('hex'),
  };
}

function loadHs256Config(secret: string): ZisJwtConfig {
  return {
    mode: 'hs256',
    pluginOptions: {
      secret,
      sign: { algorithm: 'HS256', expiresIn: '7d', iss: 'zis' },
      verify: { algorithms: ['HS256'] },
    },
    jwk: null,
    kid: 'zis-hs256',
    cookieSecret: secret,
  };
}

export function getJwtConfig(): ZisJwtConfig {
  if (!cached) {
    const priv = process.env.JWT_PRIVATE_KEY;
    const secret = process.env.JWT_SECRET;
    // No hardcoded fallback exists on purpose — a default signing secret
    // silently produces forgeable sessions if it ever reaches production
    // (IA-01 class). Dev/test environments must set JWT_SECRET explicitly.
    if (!priv && !secret) {
      throw new Error(
        'JWT_PRIVATE_KEY or JWT_SECRET must be set — there is no default secret'
      );
    }
    cached = priv ? loadEdDsaConfig(priv) : loadHs256Config(secret as string);
  }
  return cached;
}

/** Reset cached config — tests only. */
export function resetJwtConfigCache(): void {
  cached = null;
}

/** JWK Set document for /.well-known/jwks.json. */
export function getJwksDocument(): { keys: Record<string, unknown>[] } {
  const cfg = getJwtConfig();
  return { keys: cfg.jwk ? [cfg.jwk] : [] };
}
