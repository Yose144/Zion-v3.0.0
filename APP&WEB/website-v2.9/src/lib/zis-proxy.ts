/**
 * Generic ZIS proxy helper for Next.js route handlers.
 *
 * Forwards any sub-path to the ZIS upstream (auth.zionterranova.com
 * or ZIS_URL on the server), preserving the session cookie and passing
 * through Set-Cookie headers for SSO.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getZisUrl, ZIS_SESSION_COOKIE } from '@/lib/zis';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);

export interface ZisProxyCtx {
  params: Promise<{ path?: string[] }>;
}

export async function proxyToZis(
  req: NextRequest,
  ctx: ZisProxyCtx,
  zisBasePath: string,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const subPath = path?.join('/') ?? '';

  const method = req.method ?? 'GET';
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { error: 'METHOD_NOT_ALLOWED' },
      { status: 405 },
    );
  }

  const zisBase = getZisUrl();
  const targetUrl = `${zisBase}${zisBasePath}${subPath ? `/${subPath}` : ''}`;

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
  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
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
      'Content-Type': zisRes.headers.get('content-type') ?? 'application/json',
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
