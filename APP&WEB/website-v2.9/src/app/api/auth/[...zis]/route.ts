/**
 * Catch-all proxy route: /api/auth/[...zis] → ZIS /api/auth/[...zis]
 *
 * Forwards all ZIS auth endpoints through the same origin so the
 * `zion_session` SSO cookie (scoped to `.zionterranova.com`) is available
 * to client-side fetch without CORS preflight.
 *
 * Supported proxy paths:
 *   /api/auth/challenge        → ZIS /api/auth/challenge
 *   /api/auth/verify/ed25519   → ZIS /api/auth/verify/ed25519
 *   /api/auth/verify/siwe      → ZIS /api/auth/verify/siwe
 *   /api/auth/me               → ZIS /api/auth/me
 *   /api/auth/logout           → ZIS /api/auth/logout
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { proxyToZis, type ZisProxyCtx } from '@/lib/zis-proxy';

function authCtx(ctx: { params: Promise<{ zis: string[] }> }): ZisProxyCtx {
  return {
    params: ctx.params.then((p) => ({ path: p.zis })),
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxyToZis(req, authCtx(ctx), '/api/auth');
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxyToZis(req, authCtx(ctx), '/api/auth');
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxyToZis(req, authCtx(ctx), '/api/auth');
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ zis: string[] }> },
) {
  return proxyToZis(req, authCtx(ctx), '/api/auth');
}
