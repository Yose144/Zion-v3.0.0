// ── Admin session tokens (stateless HMAC) ─────────────────────────────
// Replaces the old flow that returned the raw ADMIN_API_KEY to the
// browser. Login now issues a signed, expiring token stored in an
// httpOnly cookie — never readable by JS (XSS-safe).
//
// Token format: base64url(JSON{u,exp}) + "." + base64url(HMAC-SHA256)
// Secret: ADMIN_SESSION_SECRET, falling back to ADMIN_API_KEY.

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'zion_admin_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 h
export const ADMIN_SESSION_TTL_S = SESSION_TTL_MS / 1000;

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_API_KEY ?? '';
}

function b64u(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload: string): string {
  return b64u(createHmac('sha256', secret()).update(payload).digest());
}

export interface AdminSession {
  user: string;
  expiresAt: number;
}

/** Issue a signed session token for `username`. */
export function createAdminSession(username: string): string {
  const payload = b64u(JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

/** Verify a session token. Returns the session or null. */
export function verifyAdminSession(token: string | undefined | null): AdminSession | null {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; exp: number };
    if (!data.u || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { user: data.u, expiresAt: data.exp };
  } catch {
    return null;
  }
}

/** Extract and verify the admin session cookie from a request. */
export function getAdminSession(request: NextRequest): AdminSession | null {
  return verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function adminSessionCookieValue(username: string) {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSession(username),
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    },
  };
}
