import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SWAP_UPSTREAM_BASE =
  coreUrl('atomicSwap', process.env.ZION_SWAP_API_URL);

/** Paths that map to the swap server's root endpoints (not under /swap/). */
const ROOT_PATHS = new Set(['health', 'status']);

function buildUpstreamUrl(request: Request, path: string[]) {
  const incoming = new URL(request.url);
  const suffix = path.map((segment) => encodeURIComponent(segment)).join('/');
  // Unified multichain DEX exposes /health directly; swap endpoints under /v1/swap/{...}
  if (ROOT_PATHS.has(suffix)) {
    return `${SWAP_UPSTREAM_BASE.replace(/\/$/, '')}/${suffix}${incoming.search}`;
  }
  // Native multichain HTLC endpoints live under /v1/multichain/swaps/htlc/{...}
  if (suffix.startsWith('htlc/')) {
    return `${SWAP_UPSTREAM_BASE.replace(/\/$/, '')}/v1/multichain/swaps/${suffix}${incoming.search}`;
  }
  return `${SWAP_UPSTREAM_BASE.replace(/\/$/, '')}/v1/swap/${suffix}${incoming.search}`;
}

async function proxySwap(request: Request, path: string[]) {
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json({ success: false, error: 'Swap path is required' }, { status: 400 });
  }

  const headers = new Headers();
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  const apiKey = request.headers.get('authorization');

  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (apiKey) headers.set('authorization', apiKey);

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
        note: 'Swap upstream offline',
        upstream: SWAP_UPSTREAM_BASE,
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
  return proxySwap(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxySwap(request, path);
}
