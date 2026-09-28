/**
 * Proxy: /api/notifications/[...path] → ZIS /api/notifications/[...path]
 *
 * Routes through the local Next.js origin so the `zion_session` cookie
 * is sent same-origin. Unauthenticated requests get a clean 200-empty
 * response shape for GET so the notification bell can render anonymously.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { proxyToZis } from '@/lib/zis-proxy';
import { ZIS_SESSION_COOKIE } from '@/lib/zis';

function emptyFor(path: string) {
  if (path === 'unread-count') return { count: 0 };
  return { notifications: [], total: 0, unread: 0, limit: 50, offset: 0 };
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await ctx.params;
  const joined = path?.join('/') ?? '';

  if (req.method === 'GET' && !req.cookies.has(ZIS_SESSION_COOKIE)) {
    return NextResponse.json(emptyFor(joined), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const res = await proxyToZis(req, ctx, '/api/notifications');
  if (req.method === 'GET' && res.status === 401) {
    return NextResponse.json(emptyFor(joined), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return res;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return handle(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return handle(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return handle(req, ctx);
}
