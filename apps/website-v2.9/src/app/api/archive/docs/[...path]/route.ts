import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { hasArchiveAccess } from '@/lib/archive-access';

// Gated markdown source for /zion-archive readers (Nirvana Hub).
// Book files live outside public/ in archive-content/ so they are only
// reachable through this route — which requires a valid Archive Pass
// (code cookie, ZIS+OASIS bonus, or entitlement), same gate as the hub UI.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// cwd differs by launch context: project root in dev/standalone-run,
// .next/standalone when systemd cd's there.
const ROOT = [
  resolve(process.cwd(), 'archive-content'),
  resolve(process.cwd(), '.next/standalone/archive-content'),
  resolve(process.cwd(), '../../archive-content'),
].find((p) => existsSync(p)) ?? resolve(process.cwd(), 'archive-content');

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!(await hasArchiveAccess())) {
    return new NextResponse('Archive Pass required', { status: 403 });
  }

  const { path } = await params;
  const rel = path.map(decodeURIComponent).join('/');
  const abs = resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + sep) || !abs.endsWith('.md')) {
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
