export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

const POOL_API = process.env.POOL_API_URL || 'http://pool:8080';

function buildTargetUrl(req: NextRequest, pathParts: string[]): string {
  const base = POOL_API.replace(/\/$/, '');
  const path = pathParts.map((p) => encodeURIComponent(p)).join('/');
  const target = new URL(`${base}/${path}`);

  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  return target.toString();
}

function filterHeaders(headers: Headers): Headers {
  const out = new Headers();
  const blocked = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
  ]);

  headers.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });

  return out;
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const targetUrl = buildTargetUrl(req, pathParts);

  const headers = new Headers();
  const accept = req.headers.get('accept');
  const contentType = req.headers.get('content-type');
  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const res = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  const responseHeaders = filterHeaders(res.headers);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

async function getPathParts(context: { params: Promise<{ path?: string[] }> }): Promise<string[]> {
  const { path } = await context.params;
  return path ?? [];
}

export async function GET(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, await getPathParts(context));
}

export async function POST(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, await getPathParts(context));
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, await getPathParts(context));
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, await getPathParts(context));
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, await getPathParts(context));
}
