import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MULTICHAIN_UPSTREAM_BASE =
  coreUrl('atomicSwap', process.env.ZION_MULTICHAIN_API_URL);

/** Paths that map to the multichain server's root endpoints. */
const ROOT_PATHS = new Set(['health', 'status']);

function buildUpstreamUrl(request: Request, path: string[]) {
  const incoming = new URL(request.url);
  const suffix = path.map((segment) => encodeURIComponent(segment)).join('/');

  if (ROOT_PATHS.has(suffix)) {
    return `${MULTICHAIN_UPSTREAM_BASE.replace(/\/$/, '')}/${suffix}${incoming.search}`;
  }

  if (suffix.startsWith('wallet/')) {
    return `${MULTICHAIN_UPSTREAM_BASE.replace(/\/$/, '')}/v1/${suffix}${incoming.search}`;
  }

  if (suffix.startsWith('swap/')) {
    return `${MULTICHAIN_UPSTREAM_BASE.replace(/\/$/, '')}/v1/${suffix}${incoming.search}`;
  }

  if (suffix.startsWith('nodes/') || suffix === 'nodes') {
    return `${MULTICHAIN_UPSTREAM_BASE.replace(/\/$/, '')}/v1/${suffix}${incoming.search}`;
  }

  return `${MULTICHAIN_UPSTREAM_BASE.replace(/\/$/, '')}/v1/multichain/${suffix}${incoming.search}`;
}

async function proxyMultichain(request: Request, path: string[]) {
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Multichain path is required' },
      { status: 400 },
    );
  }

  const headers = new Headers();
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');

  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (authorization) headers.set('authorization', authorization);
  if (cookie) headers.set('cookie', cookie);

  const method = request.method.toUpperCase();
  const body = method === 'POST' || method === 'PATCH' ? await request.text() : undefined;

  try {
    const upstream = await fetch(buildUpstreamUrl(request, path), {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
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
        note: 'Multichain upstream offline',
        upstream: MULTICHAIN_UPSTREAM_BASE,
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
  return proxyMultichain(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyMultichain(request, path);
}
