import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { hasArchiveAccess } from '@/lib/archive-access';
import { archiveContentRoot } from '@/lib/archive-content-root';

// Gated markdown source for /zion-archive readers (Nirvana Hub).
// Book files live outside public/ in archive-content/ so they are only
// reachable through this route — which requires a valid Archive Pass
// (code cookie, ZIS+OASIS bonus, or entitlement), same gate as the hub UI.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!(await hasArchiveAccess())) {
    return new NextResponse('Archive Pass required', { status: 403 });
  }

  const root = archiveContentRoot();
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join('/');
  const abs = resolve(root, rel);
  if (!abs.startsWith(root + sep) || !abs.endsWith('.md')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buf = await readFile(abs);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
