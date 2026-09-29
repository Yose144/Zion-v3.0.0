export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * 30-Day Stability Run (G8) — public status proxy.
 *
 * Reads the operator dashboard's /api/g8 on the same host and returns a
 * whitelisted, public-safe shape. Internal fields (state file paths, raw
 * systemd service records, alert objects, started_by) never leave this proxy.
 */
const G8_STATUS_URL = process.env.G8_STATUS_URL || 'http://127.0.0.1:8766/api/g8';
const FETCH_TIMEOUT_MS = 5000;

const SIGNAL_LABELS: Record<string, string> = {
  chain_live: 'Chain liveness',
  pool_http: 'Pool API',
  pool_stratum: 'Mining stratum',
  multichain: 'Cross-chain relay',
  dao: 'Governance',
  zis: 'Identity service',
};

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(G8_STATUS_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'stability status unavailable' }, { status: 502 });
    }
    const d = await res.json();

    const serviceUptime = d.service_uptime_percent && typeof d.service_uptime_percent === 'object'
      ? Object.fromEntries(
          Object.entries(d.service_uptime_percent).map(([k, v]) => [
            SIGNAL_LABELS[k] || k,
            typeof v === 'number' ? v : null,
          ])
        )
      : {};

    const body = {
      schema_version: d.schema_version ?? null,
      run_id: d.run_id ?? null,
      status: d.status ?? null,
      window_status: d.window_status ?? null,
      gate_status: d.gate_status ?? null,
      started: d.started ?? null,
      target_end: d.target_end ?? null,
      elapsed_seconds: typeof d.elapsed_seconds === 'number' ? d.elapsed_seconds : null,
      remaining_seconds: typeof d.remaining_seconds === 'number' ? d.remaining_seconds : null,
      progress_percent: typeof d.progress_percent === 'number' ? d.progress_percent : null,
      uptime_percent: typeof d.uptime_percent === 'number' ? d.uptime_percent : null,
      evidence_coverage_percent:
        typeof d.evidence_coverage_percent === 'number' ? d.evidence_coverage_percent : null,
      service_uptime_percent: serviceUptime,
      active_alert_count: typeof d.active_alert_count === 'number' ? d.active_alert_count : 0,
      incident_count: Array.isArray(d.incidents) ? d.incidents.length : 0,
      critical_incident_count: Array.isArray(d.critical_incidents) ? d.critical_incidents.length : 0,
      sample_counts: d.sample_counts && typeof d.sample_counts === 'object' ? d.sample_counts : null,
      last_evidence_update: d.last_evidence_update ?? null,
      policy: {
        uptime_threshold_percent: d.evidence_policy?.uptime_threshold_percent ?? 99.9,
        critical_outage_seconds: d.evidence_policy?.critical_outage_seconds ?? 900,
      },
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    });
  } catch {
    return NextResponse.json({ error: 'stability status unavailable' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
