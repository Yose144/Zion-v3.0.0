// Proxy route: /api/auth/* → ZIS (auth.zionterranova.com)
//
// The MarketPlace frontend calls these same-origin endpoints so that the
// ZIS Set-Cookie (zion_session, domain=.zionterranova.com) is applied
// correctly and CORS complexities are avoided. The proxy forwards:
//   - the request method, body, and content-type
//   - the zion_session cookie (and any others) from the incoming request
//   - the Set-Cookie response header from ZIS back to the client
//
// Supported proxied paths:
//   POST /api/auth/challenge
//   POST /api/auth/verify/ed25519
//   POST /api/auth/verify/siwe
//   GET  /api/auth/me
//   POST /api/auth/logout

import { NextRequest, NextResponse } from 'next/server';
import { ZIS_URL, ZIS_SESSION_COOKIE } from '@/lib/zis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Paths under /api/auth that may be proxied to ZIS. */
const ALLOWED_PREFIX = '/api/auth/';

/** Disallow paths that escape the /api/auth namespace. */
function isAllowedPath(zisPath: string): boolean {
  return zisPath.startsWith(ALLOWED_PREFIX) && !zisPath.includes('..');
}

/** Hop-by-hop headers that must not be forwarded. */
const STRIP_REQ_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
]);

const STRIP_RES_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

// ── Proxy core ──────────────────────────────────────────────────────────

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const zisPath = `${ALLOWED_PREFIX}${segments.join('/')}`;
  if (!isAllowedPath(zisPath)) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Disallowed proxy path' },
      { status: 400 },
    );
  }

  const url = `${ZIS_URL}${zisPath}`;

  // ── Forward request headers (minus hop-by-hop) ───────────────────────
  const fwdHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!STRIP_REQ_HEADERS.has(key.toLowerCase())) {
      fwdHeaders[key] = value;
    }
  });

  // Ensure the zion_session cookie is forwarded
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    fwdHeaders['cookie'] = cookieHeader;
  }

  // ── Build fetch init ─────────────────────────────────────────────────
  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: fwdHeaders,
    cache: 'no-store',
    redirect: 'manual',
  };

  // Attach body for methods that carry one
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = (fwdHeaders['content-type'] ?? '').toLowerCase();
    if (contentType.includes('application/json')) {
      init.body = await req.text();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      init.body = await req.text();
    } else if (contentType.includes('multipart/form-data')) {
      init.body = await req.formData();
    } else {
      // Default: forward raw body
      init.body = await req.text();
    }
  }

  // ── Execute upstream request ────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown fetch error';
    return NextResponse.json(
      { error: 'ZIS_UNREACHABLE', message: msg },
      { status: 502 },
    );
  }

  // ── Build proxied response ──────────────────────────────────────────
  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RES_HEADERS.has(key.toLowerCase())) {
      resHeaders.set(key, value);
    }
  });

  // Pass through Set-Cookie so the zion_session cookie is installed on the
  // client browser (scoped to .zionterranova.com by ZIS).
  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) {
    resHeaders.set('set-cookie', setCookie);
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

// ── Route handlers ──────────────────────────────────────────────────────

type Ctx = { params: { zis: string[] } };

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, ctx.params.zis);
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, ctx.params.zis);
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, ctx.params.zis);
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, ctx.params.zis);
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(req, ctx.params.zis);
}

// Re-export the cookie name for convenience in route consumers
// (removed — Next.js route files cannot export non-route values)
