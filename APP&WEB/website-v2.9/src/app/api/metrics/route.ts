export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://zion-prometheus:9090';

// Allowlisted metric prefixes — only V3 metrics, nothing sensitive
const ALLOWED_PREFIXES = [
  'zion_chain_',
  'zion_pool_',
  'zion_pplns_',
  'zion_mempool_',
  'zion_peer_',
  'zion_blocks_',
  'zion_template_',
  'up{',
];

function isQueryAllowed(query: string): boolean {
  const q = query.trim();
  return ALLOWED_PREFIXES.some(prefix => q.startsWith(prefix));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  if (!isQueryAllowed(query)) {
    return NextResponse.json({ error: 'Query not allowed' }, { status: 403 });
  }

  try {
    const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prometheus unavailable' },
      { status: 502 },
    );
  }
}
