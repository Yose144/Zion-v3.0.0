/**
 * Proxy: /api/free-world/[...path] → L5 Free World daemon (127.0.0.1:8095)
 *
 * Path mapping: the daemon serves `/api/v1/*` plus `/health` and `/metrics`.
 *   /api/free-world/grants        → {upstream}/api/v1/grants
 *   /api/free-world/fund/balance  → {upstream}/api/v1/fund/balance
 *   /api/free-world/rounds/<id>   → {upstream}/api/v1/rounds/<id>
 *   /api/free-world/health        → {upstream}/health
 *   /api/free-world/metrics       → {upstream}/metrics
 *
 * GET  — public, read-only (fund balance, grants, projects, QV rounds/results).
 * POST — only `rounds/<id>/ballots`, and only for signed-in ZIS users. The
 *        `voter_id` is bound server-side from the session (`zis:<user.id>`,
 *        never taken from the client) and the operator `X-API-Key` is
 *        injected from server env (`FREE_WORLD_API_KEY`).
 * All other methods/paths are rejected — grant/project/round management and
 * AI endpoints stay operator-only (nginx allowlist on the apex domain).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/zis';

const UPSTREAM = (process.env.FREE_WORLD_API_URL || 'http://127.0.0.1:8095').replace(/\/$/, '');
const UPSTREAM_KEY = process.env.FREE_WORLD_API_KEY || '';

function upstreamUrl(req: NextRequest, path: string[]): string {
  const joined = path.map((s) => encodeURIComponent(s)).join('/');
  if (joined === 'health' || joined === 'metrics') {
    return `${UPSTREAM}/${joined}${req.nextUrl.search}`;
  }
  return `${UPSTREAM}/api/v1/${joined}${req.nextUrl.search}`;
}

function upstreamDown() {
  return NextResponse.json(
    { success: false, error: 'free-world upstream offline', data: null },
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

/** POST — public surface is only `rounds/<id>/ballots` for ZIS users. */
async function proxyPost(req: NextRequest, path: string[]) {
  if (path.length !== 3 || path[0] !== 'rounds' || path[2] !== 'ballots') {
    return NextResponse.json(
      { success: false, error: 'Write access is restricted to QV ballots', data: null },
      { status: 403 },
    );
  }

  if (!UPSTREAM_KEY) {
    return NextResponse.json(
      { success: false, error: 'Voting is not enabled on this deployment', data: null },
      { status: 503 },
    );
  }

  const user = await getCurrentUserFromRequest(req).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Sign in with ZIS to vote', data: null },
      { status: 401 },
    );
  }

  let payload: { votes?: unknown };
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
      // voter_id is bound to the authenticated ZIS identity — the client
      // may send `votes` only.
      body: JSON.stringify({ voter_id: `zis:${user.id}`, votes: payload.votes }),
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
      { success: false, error: 'Path required (grants | projects | fund/balance | rounds…)', data: null },
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
