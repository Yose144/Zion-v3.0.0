import { NextRequest, NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BRIDGE_UPSTREAM_BASE =
  coreUrl('atomicSwap', process.env.ZION_SWAP_API_URL);

function buildUpstreamUrl(request: Request, path: string[]) {
  const suffix = path.map((segment) => encodeURIComponent(segment)).join('/');
  return `${BRIDGE_UPSTREAM_BASE.replace(/\/$/, '')}/v1/bridge/${suffix}`;
}

async function proxyBridge(request: NextRequest, path: string[]) {
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Bridge path is required' },
      { status: 400 },
    );
  }

  const headers = new Headers();
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');

  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);

  const method = request.method.toUpperCase();
  const body = method === 'POST' ? await request.text() : undefined;

  try {
    const upstream = await fetch(buildUpstreamUrl(request, path), {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
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
        note: 'Bridge upstream offline',
        upstream: BRIDGE_UPSTREAM_BASE,
      },
      { status: 503 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyBridge(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyBridge(request, path);
}
