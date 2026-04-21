export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DOWNLOADS_DIR = process.env.ZION_DOWNLOADS_DIR || '/opt/zion/downloads';

const ALLOWED_EXTENSIONS = new Set(['.tar.gz', '.gz', '.sha256', '.exe', '.zip']);
const ALLOWED_RAW_BINARIES = /^(zion-(miner|wallet|node|cli|core|pool))-(linux-(x86_64|arm64)|macos-arm64)$/;

function isSafeFilename(name: string): boolean {
  // Reject path traversal, null bytes, and absolute paths
  if (name.includes('..') || name.includes('\0') || path.isAbsolute(name)) return false;
  // Only allow alphanumeric, dash, dot, underscore
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

function hasAllowedExtension(name: string): boolean {
  if (!path.extname(name) && ALLOWED_RAW_BINARIES.test(name)) {
    return true;
  }

  return ALLOWED_EXTENSIONS.has(
    name.endsWith('.tar.gz') ? '.tar.gz' :
    name.endsWith('.sha256') ? '.sha256' :
    path.extname(name),
  );
}

function getContentType(name: string): string {
  if (name.endsWith('.sha256')) return 'text/plain';
  if (name.endsWith('.tar.gz') || name.endsWith('.gz')) return 'application/gzip';
  if (name.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
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
      stream.on('data', (chunk: string | Buffer) => {
        controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': getContentType(filename),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
