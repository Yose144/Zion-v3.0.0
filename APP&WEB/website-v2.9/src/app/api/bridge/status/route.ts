import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

/**
 * GET /api/bridge/status
 *
 * Server-side proxy: fetches Prometheus metrics from the ZION bridge relay
 * (port 9101) and returns parsed JSON.
 */

/**
 * Resolve bridge metrics URL at REQUEST TIME (not build time).
 * Next.js inlines process.env at build time for top-level constants,
 * which means env vars set only at runtime (e.g. in Docker compose)
 * would be undefined during build → fallback to 127.0.0.1 (wrong in Docker).
 * Reading process.env inside the handler ensures runtime values are used.
 */
function getBridgeMetricsUrl(): string {
  // Use bracket notation to prevent Next.js build-time inlining
  const envVar = process.env['BRIDGE_' + 'METRICS_' + 'URL'];
  return coreUrl('bridgeMetrics', envVar) + '/metrics';
}

/** Parse a single Prometheus metric line: "metric_name{...} value" → number */
function parse(text: string, name: string): number {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith(name) && !line.startsWith('#')) {
      const parts = line.trim().split(/\s+/);
      const val = parseFloat(parts[parts.length - 1]);
      return isNaN(val) ? 0 : val;
    }
  }
  return 0;
}

export async function GET() {
  try {
    const url = getBridgeMetricsUrl();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'text/plain' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(offlinePayload(), { status: 200 });
    }

    const text = await res.text();

    const status = {
      online: true,
      uptime_seconds: parse(text, 'zion_bridge_uptime_seconds'),
      last_l1_height:  parse(text, 'zion_bridge_last_l1_height'),
      last_evm_block:  parse(text, 'zion_bridge_last_evm_block'),
      l1_locks_detected:    parse(text, 'zion_bridge_l1_locks_detected_total'),
      l1_locks_finalized:   parse(text, 'zion_bridge_l1_locks_finalized_total'),
      evm_mints_submitted:  parse(text, 'zion_bridge_evm_mints_submitted_total'),
      evm_mints_confirmed:  parse(text, 'zion_bridge_evm_mints_confirmed_total'),
      evm_burns_detected:   parse(text, 'zion_bridge_evm_burns_detected_total'),
      l1_unlocks_submitted: parse(text, 'zion_bridge_l1_unlocks_submitted_total'),
      l1_unlocks_confirmed: parse(text, 'zion_bridge_l1_unlocks_confirmed_total'),
      errors_total:         parse(text, 'zion_bridge_errors_total'),
      fetched_at: Date.now(),
    };

    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json(offlinePayload(), { status: 200 });
  }
}

function offlinePayload() {
  return {
    online: false,
    uptime_seconds: 0,
    last_l1_height: 0,
    last_evm_block: 0,
    l1_locks_detected: 0,
    l1_locks_finalized: 0,
    evm_mints_submitted: 0,
    evm_mints_confirmed: 0,
    evm_burns_detected: 0,
    l1_unlocks_submitted: 0,
    l1_unlocks_confirmed: 0,
    errors_total: 0,
    fetched_at: Date.now(),
  };
}
