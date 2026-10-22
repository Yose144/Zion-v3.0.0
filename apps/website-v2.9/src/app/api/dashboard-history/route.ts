export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';
import { getZionRpc } from '@/lib/zion-rpc';

const DASHBOARD_URL = coreUrl('dashboard', process.env.DASHBOARD_URL);

export async function GET() {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/history`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Dashboard history error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    // Fallback: return empty samples — downstream dashboards handle empty state
    return NextResponse.json(
      { samples: [], source: 'fallback', note: 'Core dashboard offline' },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}
