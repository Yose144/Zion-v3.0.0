// JWT signing-key management for ZIS.
//
// Two modes:
//   eddsa — production. Ed25519 keypair from JWT_PRIVATE_KEY (PEM; may be
//           given base64 or with literal \n escapes). The public key is
//           published at /.well-known/jwks.json so any service can verify
//           tokens without calling back to ZIS.
//   hs256 — legacy/dev fallback. Symmetric JWT_SECRET, no usable JWKS.
//
// Legacy grace: when running in eddsa mode, tokens signed with the old
// HS256 secret keep verifying until they expire (max 7 days) — set
// JWT_LEGACY_SECRET (= old JWT_SECRET). Without it old sessions die at
// deploy time.

import { createPrivateKey, createPublicKey, createHash, type KeyObject } from 'node:crypto';
import { createVerifier } from 'fast-jwt';
import type * as fastifyJwtNs from '@fastify/jwt';

type JwtPluginOptions = fastifyJwtNs.FastifyJWTOptions;
type LegacyVerifier = ((token: string) => Record<string, unknown>) | null;

export interface ZisJwtConfig {
  mode: 'eddsa' | 'hs256';
  /** Options for @fastify/jwt register(). */
  pluginOptions: JwtPluginOptions;
  /** Public JWK for jwks.json (eddsa) or null (hs256 — nothing publishable). */
  jwk: Record<string, unknown> | null;
  kid: string;
}

let cached: ZisJwtConfig | null = null;
let legacyVerifier: LegacyVerifier | undefined;

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
  };
}

export function getJwtConfig(): ZisJwtConfig {
  if (!cached) {
    const priv = process.env.JWT_PRIVATE_KEY;
    const secret = process.env.JWT_SECRET ?? 'change-me-in-production';
    cached = priv ? loadEdDsaConfig(priv) : loadHs256Config(secret);
    if (!priv && process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_PRIVATE_KEY or JWT_SECRET must be set in production');
    }
  }
  return cached;
}

/** Reset cached config — tests only. */
export function resetJwtConfigCache(): void {
  cached = null;
  legacyVerifier = undefined;
}

/**
 * Verify a token against the legacy HS256 secret (grace period after the
 * EdDSA cutover). Returns the decoded payload or null. Only active when
 * JWT_LEGACY_SECRET (or JWT_SECRET, in eddsa mode) is configured.
 */
export function verifyLegacyToken(token: string): Record<string, unknown> | null {
  if (legacyVerifier === undefined) {
    const cfg = getJwtConfig();
    const legacy = cfg.mode === 'eddsa'
      ? process.env.JWT_LEGACY_SECRET ?? process.env.JWT_SECRET
      : null;
    legacyVerifier = legacy
      ? (createVerifier({ key: legacy, algorithms: ['HS256'] }) as (t: string) => Record<string, unknown>)
      : null;
  }
  if (!legacyVerifier) return null;
  try {
    return legacyVerifier(token);
  } catch {
    return null;
  }
}

/** JWK Set document for /.well-known/jwks.json. */
export function getJwksDocument(): { keys: Record<string, unknown>[] } {
  const cfg = getJwtConfig();
  return { keys: cfg.jwk ? [cfg.jwk] : [] };
}
