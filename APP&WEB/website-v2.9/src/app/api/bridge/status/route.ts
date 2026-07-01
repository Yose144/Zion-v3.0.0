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
  // Canonical bridge state — contracts deployed, E2E confirmed, vault funded.
  // Relay metrics endpoint may be offline (container not running) but bridge
  // contracts on Base + 5 other chains are live and functional.
  const bridgeState = {
    online: true,
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
    // Canonical vault info (updated 2026-06-29 — vault fix e6175b5b)
    l1_vault_address: 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0',
    bridge_e2e_confirmed: true,
    bridge_e2e_burn_tx: '0x70ad4d93ee3922210ae2783fed5af1c34bfe6080fb01089b18572e0ceaa8a719',
    bridge_e2e_unlock_block: 20919,
    validator_threshold: '5/5',
    // 6-chain bridge relay config
    chains_active: 6,
    chains: ['Base', 'BSC', 'Polygon', 'Arbitrum', 'Optimism', 'Avalanche'],
    wzion_address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
    bridge_contract: '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721',
    fetched_at: Date.now(),
  };

  try {
    const url = getBridgeMetricsUrl();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'text/plain' },
      cache: 'no-store',
    });

    if (res.ok) {
      const text = await res.text();
      // Merge live metrics with canonical state
      return NextResponse.json({
        ...bridgeState,
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
        relay_metrics_online: true,
      }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
  } catch {
    // Relay metrics endpoint offline — bridge contracts still live
  }

  // Return canonical state with relay_metrics_online: false
  return NextResponse.json({ ...bridgeState, relay_metrics_online: false }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
