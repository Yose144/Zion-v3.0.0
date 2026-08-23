/**
 * Proxy: /api/keys/[...path] → ZIS /api/keys/[...path]
 *
 * Routes through the local Next.js origin so the `zion_session` cookie
 * is sent same-origin.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { proxyToZis } from '@/lib/zis-proxy';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyToZis(req, ctx, '/api/keys');
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyToZis(req, ctx, '/api/keys');
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return proxyToZis(req, ctx, '/api/keys');
}
