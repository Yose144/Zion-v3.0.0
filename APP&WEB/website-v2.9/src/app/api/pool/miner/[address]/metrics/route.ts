import { NextRequest, NextResponse } from 'next/server';
import { SITE_PRIMARY_HOST } from '@/lib/site';

const POOL_SERVERS = [
  { id: 'primary', host: SITE_PRIMARY_HOST, port: 8080 },
];

type MetricRow = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

async function fetchMetrics(host: string, port: number, timeout = 5000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(`http://${host}:${port}/metrics`, {
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const re = /(\w+)="((?:\\"|[^"])*)"/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(raw)) !== null) {
    labels[m[1]] = m[2].replace(/\\"/g, '"');
  }
  return labels;
}

function parsePrometheus(text: string): MetricRow[] {
  const rows: MetricRow[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;

    const withLabels = l.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/);
    if (withLabels) {
      rows.push({
        name: withLabels[1],
        labels: parseLabels(withLabels[2]),
        value: Number(withLabels[3]),
      });
      continue;
    }

    const plain = l.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/);
    if (plain) {
      rows.push({
        name: plain[1],
        labels: {},
        value: Number(plain[2]),
      });
    }
  }

  return rows;
}

function metricValue(rows: MetricRow[], name: string, address: string, status?: string): number {
  return rows
    .filter((r) => r.name === name && r.labels.address === address && (status ? r.labels.status === status : true))
    .reduce((sum, r) => sum + (Number.isFinite(r.value) ? r.value : 0), 0);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 10) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }

  const serverResults = await Promise.all(
    POOL_SERVERS.map(async (srv) => {
      const text = await fetchMetrics(srv.host, srv.port);
      if (!text) {
        return {
          server: srv.id,
          connected: false,
          metrics_available: false,
          values: null,
        };
      }

      const rows = parsePrometheus(text);
      const values = {
        hashrate: metricValue(rows, 'miner_hashrate', address),
        shares_valid: metricValue(rows, 'miner_shares_total', address, 'valid'),
        shares_invalid: metricValue(rows, 'miner_shares_total', address, 'invalid'),
        blocks_found: metricValue(rows, 'miner_blocks_found_total', address),
        pending_balance_atomic: metricValue(rows, 'miner_pending_balance_atomic', address),
        paid_total_atomic: metricValue(rows, 'miner_paid_total_atomic', address),
        connections_active: metricValue(rows, 'miner_connections_active', address),
      };

      return {
        server: srv.id,
        connected: true,
        metrics_available: true,
        values,
      };
    }),
  );

  const aggregate = {
    hashrate: 0,
    shares_valid: 0,
    shares_invalid: 0,
    blocks_found: 0,
    pending_balance_atomic: 0,
    paid_total_atomic: 0,
    connections_active: 0,
  };

  for (const r of serverResults) {
    if (!r.values) continue;
    aggregate.hashrate += r.values.hashrate;
    aggregate.shares_valid += r.values.shares_valid;
    aggregate.shares_invalid += r.values.shares_invalid;
    aggregate.blocks_found += r.values.blocks_found;
    aggregate.pending_balance_atomic += r.values.pending_balance_atomic;
    aggregate.paid_total_atomic += r.values.paid_total_atomic;
    aggregate.connections_active += r.values.connections_active;
  }

  const hasAny = serverResults.some(
    (r) => !!r.values && (r.values.hashrate > 0 || r.values.shares_valid > 0 || r.values.shares_invalid > 0 || r.values.blocks_found > 0 || r.values.pending_balance_atomic > 0 || r.values.paid_total_atomic > 0 || r.values.connections_active > 0),
  );

  return NextResponse.json({
    ok: true,
    address,
    has_metrics: hasAny,
    scrape_ts: Math.floor(Date.now() / 1000),
    metrics: aggregate,
    servers: serverResults,
  });
}
