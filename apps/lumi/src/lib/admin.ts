import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'lumi_admin';
const MAX_AGE = 60 * 60 * 12; // 12 h

function secret(): string | null {
  const value = process.env.LUMI_SESSION_SECRET?.trim();
  return value && value.length >= 16 ? value : null;
}

function password(): string | null {
  const value = process.env.LUMI_ADMIN_PASSWORD?.trim();
  return value || null;
}

/** Uživatelské jméno pro admin. Výchozí `admin`; mění se jen env proměnnou. */
export function adminUser(): string {
  return process.env.LUMI_ADMIN_USER?.trim() || 'admin';
}

export function adminConfigured(): boolean {
  return Boolean(secret() && password());
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex');
}

function safeEqual(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Ověří uživatelské jméno i heslo. */
export function verifyCredentials(username: string, inputPassword: string): boolean {
  const expectedPassword = password();
  if (!expectedPassword) return false;
  if (!safeEqual(username, adminUser())) return false;
  return safeEqual(inputPassword, expectedPassword);
}

/** @deprecated použij `verifyCredentials` (username + password). */
export function verifyPassword(input: string): boolean {
  const expected = password();
  return expected ? safeEqual(input, expected) : false;
}

export function createSessionValue(): string | null {
  const key = secret();
  if (!key) return null;
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${sign(payload, key)}`;
}

export function verifySessionValue(value: string | undefined | null): boolean {
  const key = secret();
  if (!key || !value) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = sign(`v1.${parts[1]}`, key);
  const given = Buffer.from(parts[2]);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

export function setSessionCookie(response: NextResponse): NextResponse {
  const value = createSessionValue();
  if (!value) return response;
  response.cookies.set({
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({ name: ADMIN_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}

/** Vrací odpověď (401/403/503), nebo `null` když je požadavek admin. */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!adminConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Admin není nakonfigurován (LUMI_ADMIN_PASSWORD / LUMI_SESSION_SECRET).' },
      { status: 503 },
    );
  }
  if (!verifySessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ success: false, error: 'Neautorizováno' }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ success: false, error: 'Neplatný původ požadavku' }, { status: 403 });
  }
  return null;
}

/** CSRF ochrana pro mutace: Origin musí sedět na host (nebo SITE_URL). */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // curl / server-to-server bez prohlížeče
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get('host');
    if (requestHost && originHost === requestHost) return true;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site && new URL(site).host === originHost) return true;
    return false;
  } catch {
    return false;
  }
}
