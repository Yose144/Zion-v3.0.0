import { NextRequest, NextResponse } from 'next/server';

const ZIS = process.env.ZIS_ORIGIN ?? 'https://auth.zionterranova.com';

/** Bind `zion_session` to the shell host. ZIS sets Domain for the apex; the proxy forwards the cookie. */
function hostCookie(raw: string, secure: boolean): string {
  const parts = raw.split(';').map((part) => part.trim()).filter(Boolean);
  const pair = parts[0] ?? raw;
  const attrs = parts.slice(1).filter((attr) => {
    const name = attr.split('=')[0]?.trim().toLowerCase();
    return name !== 'domain' && name !== 'secure';
  });
  if (secure) attrs.push('Secure');
  return [pair, ...attrs].join('; ');
}

async function proxy(req: NextRequest, path: string[]) {
  const target = `${ZIS.replace(/\/$/, '')}/api/auth/${path.join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const accept = req.headers.get('accept');
  if (accept) headers.set('accept', accept);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(target, init);
    const out = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status });
    const type = upstream.headers.get('content-type');
    if (type) out.headers.set('content-type', type);
    const secure =
      req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
    const setCookies =
      typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
    const cookies = setCookies.length > 0 ? setCookies : [];
    if (cookies.length === 0) {
      const single = upstream.headers.get('set-cookie');
      if (single) cookies.push(single);
    }
    for (const cookie of cookies) out.headers.append('set-cookie', hostCookie(cookie, secure));
    return out;
  } catch {
    return NextResponse.json({ message: 'ZIS unreachable' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
