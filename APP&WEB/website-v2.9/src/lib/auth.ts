/**
 * JWT auth utilities for ZION wallet-based authentication.
 *
 * Uses `jose` library (Edge-compatible, pure JS).
 * JWT is stored in an httpOnly cookie.
 */

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'zion_session';
const JWT_EXPIRY = '7d';
const ALG = 'HS256';

function getSecret(): Uint8Array {
  const secret = process.env.ZION_JWT_SECRET;
  if (!secret) {
    throw new Error('[FATAL] ZION_JWT_SECRET is required. Set it in .env.production or .env.local');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;        // wallet address
  name: string | null; // display name
  iat: number;
  exp: number;
}

export async function createSession(address: string, displayName: string | null): Promise<string> {
  const secret = getSecret();
  const jwt = await new SignJWT({ name: displayName })
    .setProtectedHeader({ alg: ALG })
    .setSubject(address)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
  return jwt;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      name: (payload.name as string) ?? null,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = COOKIE_NAME;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};
