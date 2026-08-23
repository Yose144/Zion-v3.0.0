/**
 * Catch-all proxy route: /api/auth/[...zis] → ZIS (auth.zionterranova.com)
 *
 * Forwards all ZIS auth endpoints through the same origin so the
 * `zion_session` SSO cookie (scoped to `.zionterranova.com`) is available
 * to client-side fetch without CORS preflight.
 *
 * Supported proxy paths:
 *   /api/auth/challenge        → ZIS /api/auth/challenge
 *   /api/auth/verify/ed25519   → ZIS /api/auth/verify/ed25519
 *   /api/auth/verify/siwe      → ZIS /api/auth/verify/siwe
 *   /api/auth/me               → ZIS /api/auth/me
 *   /api/auth/logout           → ZIS /api/auth/logout
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getZisUrl, ZIS_SESSION_COOKIE } from '@/lib/zis';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxy(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxy(req, ctx);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxy(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxy(req, ctx);
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
): Promise<NextResponse> {
  const { zis } = await ctx.params;
  const subPath = zis.join('/');

  if (!subPath) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Missing ZIS sub-path' },
      { status: 400 },
    );
  }

  const method = req.method ?? 'GET';
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { error: 'METHOD_NOT_ALLOWED' },
      { status: 405 },
    );
  }

  const zisBase = getZisUrl();
  const targetUrl = `${zisBase}/api/auth/${subPath}`;

  // Forward the session cookie so ZIS can authenticate the request.
  const forwardHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  const sessionCookie = req.cookies.get(ZIS_SESSION_COOKIE)?.value;
  if (sessionCookie) {
    forwardHeaders.Cookie = `${ZIS_SESSION_COOKIE}=${sessionCookie}`;
  }

  const contentType = req.headers.get('content-type');
  if (contentType) {
    forwardHeaders['Content-Type'] = contentType;
  }

  // Read body for mutating methods.
  let body: BodyInit | undefined;
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    body = await req.text();
  }

  let zisRes: Response;
  try {
    zisRes = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
    });
  } catch (err) {
    console.error('[zis-proxy] upstream fetch failed:', err);
    return NextResponse.json(
      { error: 'BAD_GATEWAY', message: 'ZIS unreachable' },
      { status: 502 },
    );
  }

  // Build the proxied response, preserving status + JSON body.
  const text = await zisRes.text();
  const response = new NextResponse(text, {
    status: zisRes.status,
    headers: {
      'Content-Type':
        zisRes.headers.get('content-type') ?? 'application/json',
    },
  });

  // Pass through all Set-Cookie headers so the SSO cookie is established on
  // the same origin (the cookie domain is .zionterranova.com).
  const setCookies =
    (zisRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (zisRes.headers.get('set-cookie') ? [zisRes.headers.get('set-cookie')!] : []);

  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie);
  }

  return response;
}
