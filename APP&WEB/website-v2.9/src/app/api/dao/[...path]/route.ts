import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DAO_UPSTREAM_BASE =
  coreUrl('dao', process.env.ZION_DAO_API_URL);

function buildUpstreamUrl(request: Request, path: string[]) {
  const incoming = new URL(request.url);
  const suffix = path.map((segment) => encodeURIComponent(segment)).join('/');
  return `${DAO_UPSTREAM_BASE.replace(/\/$/, '')}/api/dao/${suffix}${incoming.search}`;
}

async function proxyDao(request: Request, path: string[]) {
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json({ success: false, error: 'DAO path is required' }, { status: 400 });
  }

  const headers = new Headers();
  const accept = request.headers.get('accept');
  const contentType = request.headers.get('content-type');
  const apiKey = request.headers.get('x-dao-key');

  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (apiKey) headers.set('x-dao-key', apiKey);

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
        note: 'DAO upstream offline',
        upstream: DAO_UPSTREAM_BASE,
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
  return proxyDao(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyDao(request, path);
}
