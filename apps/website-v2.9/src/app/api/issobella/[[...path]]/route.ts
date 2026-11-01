/**
 * Proxy: /api/issobella/[...path] → L6 Issobella daemon (127.0.0.1:8097)
 *
 * Path mapping: the daemon serves `/api/v1/*` plus `/health` and `/metrics`.
 *   /api/issobella/papers            → {upstream}/api/v1/papers
 *   /api/issobella/papers/<id>       → {upstream}/api/v1/papers/<id>
 *   /api/issobella/papers/<id>/proof → {upstream}/api/v1/papers/<id>/proof
 *   /api/issobella/health            → {upstream}/health
 *
 * GET  — public, read-only (published papers + anchor proofs).
 * POST — only `papers` (paper submission), and only for signed-in ZIS users.
 *        `submitted_by` is bound server-side from the session
 *        (`zis:<user.id>`, never taken from the client) and the operator
 *        `x-api-key` is injected from server env (`ISSOBELLA_API_KEY`).
 * All other methods/paths are rejected — publish + anchor sweeps stay
 * operator-only (daemon admin key, not exposed through this proxy).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/zis';

const UPSTREAM = (process.env.ISSOBELLA_API_URL || 'http://127.0.0.1:8097').replace(/\/$/, '');
const UPSTREAM_KEY = process.env.ISSOBELLA_API_KEY || '';

const PUBLIC_GET = /^(papers|health|metrics)(\/.*)?$/;

function upstreamUrl(req: NextRequest, path: string[]): string {
  const joined = path.map((s) => encodeURIComponent(s)).join('/');
  if (joined === 'health' || joined === 'metrics') {
    return `${UPSTREAM}/${joined}${req.nextUrl.search}`;
  }
  return `${UPSTREAM}/api/v1/${joined}${req.nextUrl.search}`;
}

function upstreamDown() {
  return NextResponse.json(
    { success: false, error: 'issobella upstream offline', data: null },
    { status: 503 },
  );
}

async function passThrough(res: Response) {
  const headers = new Headers();
  const type = res.headers.get('content-type');
  if (type) headers.set('content-type', type);
  headers.set('cache-control', 'no-store');
  return new NextResponse(await res.text(), { status: res.status, headers });
}

async function proxyGet(req: NextRequest, path: string[]) {
  const joined = path.join('/');
  if (!PUBLIC_GET.test(joined)) {
    return NextResponse.json(
      { success: false, error: 'Path not available', data: null },
      { status: 404 },
    );
  }
  try {
    const res = await fetch(upstreamUrl(req, path), {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    return passThrough(res);
  } catch {
    return upstreamDown();
  }
}

/** POST — public surface is only `papers` submission for ZIS users. */
async function proxyPost(req: NextRequest, path: string[]) {
  if (path.length !== 1 || path[0] !== 'papers') {
    return NextResponse.json(
      { success: false, error: 'Write access is restricted to paper submission', data: null },
      { status: 403 },
    );
  }

  if (!UPSTREAM_KEY) {
    return NextResponse.json(
      { success: false, error: 'Paper submission is not enabled on this deployment', data: null },
      { status: 503 },
    );
  }

  const user = await getCurrentUserFromRequest(req).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Sign in with ZIS to submit a paper', data: null },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', data: null },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(upstreamUrl(req, path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': UPSTREAM_KEY,
      },
      // submitted_by is bound to the authenticated ZIS identity — the client
      // may send title/authors/abstract/content_url/content_sha256 only.
      body: JSON.stringify({ ...payload, submitted_by: `zis:${user.id}` }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    return passThrough(res);
  } catch {
    return upstreamDown();
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  if (path.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Path required (papers | health | metrics)', data: null },
      { status: 400 },
    );
  }
  return proxyGet(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxyPost(req, path);
}
