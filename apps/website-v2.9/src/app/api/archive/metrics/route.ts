import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getArchiveMetrics } from '@/lib/archive-metrics';

// Prometheus text exposition for the archive gate.
// Admin-only (same ARCHIVE_ADMIN_TOKEN as the other archive admin routes):
// access counters are operationally useful but not public information.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const token = process.env.ARCHIVE_ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : (req.headers.get('x-admin-token') ?? '');
  if (!supplied) return false;
  const ha = createHash('sha256').update(supplied).digest();
  const hb = createHash('sha256').update(token).digest();
  return timingSafeEqual(ha, hb);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Unauthorized', { status: 401 });

  const m = getArchiveMetrics();
  const uptime = Math.max(0, Math.round((Date.now() - new Date(m.since).getTime()) / 1000));
  const lines = [
    '# HELP zion_archive_access_total Archive gate checks by result.',
    '# TYPE zion_archive_access_total counter',
    `zion_archive_access_total{result="granted"} ${m.granted}`,
    `zion_archive_access_total{result="denied"} ${m.denied}`,
    '# HELP zion_archive_download_total Downloads served by id.',
    '# TYPE zion_archive_download_total counter',
    ...Object.entries(m.downloads).map(
      ([id, count]) => `zion_archive_download_total{id="${id.replace(/"/g, '')}"} ${count}`,
    ),
    '# HELP zion_archive_metrics_uptime_seconds Seconds since the counters were created.',
    '# TYPE zion_archive_metrics_uptime_seconds gauge',
    `zion_archive_metrics_uptime_seconds ${uptime}`,
    '',
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
