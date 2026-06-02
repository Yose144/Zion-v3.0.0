export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { coreUrl } from '@/lib/core-endpoints';

const PROMETHEUS_URL = coreUrl('prometheus', process.env.PROMETHEUS_URL);

// Allowlisted metric prefixes — only V3 + infra metrics, nothing sensitive
const ALLOWED_PREFIXES = [
  'zion_chain_',
  'zion_miner_',
  'zion_pool_',
  'zion_pplns_',
  'zion_mempool_',
  'zion_peer_',
  'zion_blocks_',
  'zion_template_',
  'node_filesystem_',
  'node_memory_Mem',
  'node_load',
  'node_boot_time',
  'node_uname_info',
  'node_cpu_seconds',
  'prometheus_',
  'redis_up',
  'redis_connected_clients',
  'redis_memory_',
  'redis_used_memory',
  'redis_keyspace_hits',
  'redis_keyspace_misses',
  'up{',
  'up',
];

function isQueryAllowed(query: string): boolean {
  const q = query.trim();
  return ALLOWED_PREFIXES.some(prefix => q.startsWith(prefix));
}

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  const range = request.nextUrl.searchParams.get('range'); // e.g. "1h", "6h", "24h"
  const step = request.nextUrl.searchParams.get('step');   // e.g. "60", "300"

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  if (!isQueryAllowed(query)) {
    return NextResponse.json({ error: 'Query not allowed' }, { status: 403 });
  }

  try {
    let url: string;

    if (range) {
      // Range query for sparklines / charts
      const allowedRanges: Record<string, number> = { '1h': 3600, '3h': 10800, '6h': 21600, '12h': 43200, '24h': 86400 };
      const secs = allowedRanges[range] ?? 3600;
      const now = Math.floor(Date.now() / 1000);
      const stepVal = Math.min(Math.max(parseInt(step || '60', 10) || 60, 15), 600);
      url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${now - secs}&end=${now}&step=${stepVal}`;
    } else {
      url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
    }

    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json();
    return NextResponse.json(data, { headers: HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prometheus unavailable' },
      { status: 502 },
    );
  }
}
