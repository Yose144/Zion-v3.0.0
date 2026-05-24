export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:8766';

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
  } catch (err) {
    console.error('dashboard-history proxy error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Dashboard unavailable' },
      { status: 502 },
    );
  }
}
