// ── CSRF / same-origin guard for cookie-authenticated mutations ──────
// ZIS (`zion_session`) and admin (`zion_admin_session`) cookies are
// SameSite=Lax which already blocks most cross-site POSTs, but we also
// verify Origin/Referer explicitly — the standard defense Next.js uses
// for Server Actions. Requests authenticated by API key / Bearer (no
// cookies) are unaffected.

import { NextRequest, NextResponse } from 'next/server';
import { ZIS_SESSION_COOKIE } from '@/lib/zis';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session';

const SESSION_COOKIES = [ZIS_SESSION_COOKIE, ADMIN_SESSION_COOKIE];

function hostAllowed(host: string, requestHost: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  const rh = requestHost.toLowerCase();
  if (h === rh) return true;
  // Shared SSO across zionterranova.com subdomains is intentional.
  if (rh.endsWith('zionterranova.com') && (h === 'zionterranova.com' || h.endsWith('.zionterranova.com'))) return true;
  return false;
}

function headerHost(value: string | null): string {
  if (!value) return '';
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

/**
 * For mutating requests that carry a session cookie, verify the request
 * originates from our own site. Returns a 403 response when the check
 * fails, otherwise null.
 */
export function assertSameOrigin(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const hasSessionCookie = SESSION_COOKIES.some((c) => request.cookies.has(c));
  if (!hasSessionCookie) return null; // API-key/Bearer callers are not CSRF-able

  const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const origin = request.headers.get('origin');
  if (origin) {
    if (origin !== 'null' && hostAllowed(headerHost(origin), requestHost)) return null;
    return NextResponse.json({ success: false, error: 'Forbidden origin' }, { status: 403 });
  }

  const referer = request.headers.get('referer');
  if (referer) {
    if (hostAllowed(headerHost(referer), requestHost)) return null;
    return NextResponse.json({ success: false, error: 'Forbidden origin' }, { status: 403 });
  }

  // No Origin/Referer — browsers always send one on cross-site POSTs;
  // Sec-Fetch-Site is a second signal where available.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return NextResponse.json({ success: false, error: 'Forbidden origin' }, { status: 403 });
  }
  return null;
}
