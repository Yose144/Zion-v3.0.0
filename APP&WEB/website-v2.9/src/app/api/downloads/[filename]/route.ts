export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DOWNLOADS_DIR = process.env.ZION_DOWNLOADS_DIR || '/opt/zion/downloads';

const ALLOWED_EXTENSIONS = new Set(['.tar.gz', '.gz', '.sha256', '.exe', '.zip']);

function isSafeFilename(name: string): boolean {
  // Reject path traversal, null bytes, and absolute paths
  if (name.includes('..') || name.includes('\0') || path.isAbsolute(name)) return false;
  // Only allow alphanumeric, dash, dot, underscore
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

function hasAllowedExtension(name: string): boolean {
  return ALLOWED_EXTENSIONS.has(
    name.endsWith('.tar.gz') ? '.tar.gz' :
    name.endsWith('.sha256') ? '.sha256' :
    path.extname(name),
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!isSafeFilename(filename) || !hasAllowedExtension(filename)) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 });
  }

  const filePath = path.join(DOWNLOADS_DIR, filename);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(DOWNLOADS_DIR))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const stat = fs.statSync(resolved);
  const stream = fs.createReadStream(resolved);
  const readable = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  const ct = filename.endsWith('.sha256') ? 'text/plain' :
             filename.endsWith('.exe') ? 'application/octet-stream' :
             'application/gzip';

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
