export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

const OASIS_API_URL = coreUrl('oasis', process.env.OASIS_API_URL ?? process.env.NEXT_PUBLIC_OASIS_API_URL);
const TIMEOUT_MS = 8_000;

/**
 * GET /api/oasis/status — lightweight availability probe for the L4 page.
 * Proxies the OASIS game backend /health so the public site can show a
 * truthful live/offline indicator without exposing internal topology.
 */
export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${OASIS_API_URL}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { available: false },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const payload = await res.json().catch(() => ({}));
    const data = payload?.data ?? payload ?? {};
    return NextResponse.json(
      {
        available: true,
        service: typeof data.service === 'string' ? data.service : 'oasis',
        version: typeof data.version === 'string' ? data.version : undefined,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { available: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
