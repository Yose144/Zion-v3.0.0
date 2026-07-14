import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WARP_UPSTREAM_BASE =
  coreUrl('warp', process.env.ZION_WARP_API_URL);

/** Paths that are safe to proxy without an API key (read-only health/status). */
const PUBLIC_PATHS = new Set(['health', 'status']);

function buildUpstreamUrl(request: Request, path: string[]) {
  const incoming = new URL(request.url);
  const suffix = path.map((segment) => encodeURIComponent(segment)).join('/');
  // WARP server exposes /health directly, other endpoints under /api/warp/
  if (PUBLIC_PATHS.has(suffix)) {
    return `${WARP_UPSTREAM_BASE.replace(/\/$/, '')}/${suffix}${incoming.search}`;
  }
  return `${WARP_UPSTREAM_BASE.replace(/\/$/, '')}/api/warp/${suffix}${incoming.search}`;
}

async function proxyWarp(request: Request, path: string[]) {
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json({ success: false, error: 'WARP path is required' }, { status: 400 });
  }

  const headers = new Headers();
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  const apiKey = request.headers.get('x-warp-key') ?? process.env.ZION_WARP_API_KEY;
  const isPublicPath = PUBLIC_PATHS.has(path[0]);

  // Allow read-only health/status without API key; require key for everything else
  if (!apiKey && !isPublicPath) {
    return NextResponse.json({ success: false, error: 'WARP API key not configured' }, { status: 503 });
  }

  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (apiKey) headers.set('x-warp-key', apiKey);

  const method = request.method.toUpperCase();
  const body = method === 'POST' ? await request.text() : undefined;

  try {
    const upstream = await fetch(buildUpstreamUrl(request, path), {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get('content-type');
    if (upstreamType) responseHeaders.set('content-type', upstreamType);
    responseHeaders.set('cache-control', 'no-store');

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        source: 'fallback',
        note: 'WARP upstream offline',
        upstream: WARP_UPSTREAM_BASE,
      },
      { status: 503 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyWarp(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyWarp(request, path);
}
