import { createReadStream, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  isAllowedDownloadFile,
  protectedFileFromUrl,
  verifyDownloadRequest,
} from '@/lib/download-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR ?? '/opt/zion/data/downloads';
const INTERNAL_LOCATION = process.env.INTERNAL_DOWNLOAD_LOCATION ?? '/internal-downloads';

function diskPath(file: string): string | null {
  const root = resolve(DOWNLOADS_DIR);
  const full = resolve(join(root, file));
  if (full !== root && !full.startsWith(root + '/')) return null;
  return full;
}

async function orderMayDownload(orderId: string, file: string): Promise<boolean> {
  const order = await prisma.shopOrder.findUnique({
    where: { orderId },
    select: { paymentStatus: true, items: true },
  });
  if (!order || order.paymentStatus !== 'paid') return false;
  const items = Array.isArray(order.items) ? order.items : [];
  return items.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const url = (item as { filesUrl?: unknown }).filesUrl;
    return typeof url === 'string' && protectedFileFromUrl(url) === file;
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const raw = (await params).file;
  let file: string;
  try {
    file = decodeURIComponent(raw);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!isAllowedDownloadFile(file)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = req.nextUrl;
  const auth = verifyDownloadRequest({
    file,
    orderId: url.searchParams.get('o'),
    purpose: url.searchParams.get('p'),
    exp: url.searchParams.get('exp'),
    sig: url.searchParams.get('sig'),
  });
  if (!auth.ok) {
    return new NextResponse(auth.message, { status: auth.status });
  }
  if (auth.kind === 'order') {
    const allowed = await orderMayDownload(auth.orderId, file);
    if (!allowed) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const useAccel =
    process.env.DOWNLOAD_X_ACCEL !== '0' &&
    (process.env.DOWNLOAD_X_ACCEL === '1' || process.env.NODE_ENV === 'production');

  if (useAccel) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Accel-Redirect': `${INTERNAL_LOCATION.replace(/\/$/, '')}/${file}`,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const path = diskPath(file);
  if (!path || !existsSync(path)) {
    return new NextResponse('File missing', { status: 404 });
  }
  const stat = statSync(path);
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
