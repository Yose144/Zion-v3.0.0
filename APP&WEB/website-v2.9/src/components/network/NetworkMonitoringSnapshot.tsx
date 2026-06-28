'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Activity, Cpu, Database, ExternalLink, HardDrive, Radio, RefreshCw, Server, Sparkles } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

interface MonitoringSnapshot {
  chainHeight: number | null;
  coreUp: number | null;
  poolUp: number | null;
  poolSessions: number | null;
  poolAcceptRate: number | null;
  poolUptime: number | null;
  templateFees: number | null;
  load1: number | null;
  memAvailable: number | null;
  memTotal: number | null;
  diskAvailable: number | null;
  diskTotal: number | null;
}

function fmtMetric(n: number | null | undefined, digits = 0, locale = 'en-US') {
  if (n == null) return '—';
  return digits > 0 ? n.toFixed(digits) : n.toLocaleString(locale);
}

function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null) return '—';
  return `${n.toFixed(digits)}%`;
}

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fmtUptime(secs: number | null | undefined) {
  if (!secs) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function metricValue(query: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.data?.result?.[0];
    return first ? Number.parseFloat(first.value?.[1] ?? '') : null;
  } catch {
    return null;
  }
}

async function fetchBlockchainStats(): Promise<{
  height: number | null;
  difficulty: number | null;
  status: string | null;
}> {
  try {
    const res = await fetch('/api/blockchain/stats', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { height: null, difficulty: null, status: null };
    const data = await res.json();
    return {
      height: data.block_height ?? null,
      difficulty: data.difficulty ?? null,
      status: data.status ?? null,
    };
  } catch {
    return { height: null, difficulty: null, status: null };
  }
}

async function fetchPoolStats(): Promise<{
  sessions: number | null;
  acceptRate: number | null;
  uptime: number | null;
  hashrate: number | null;
}> {
  try {
    const res = await fetch('/api/pool/stats', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { sessions: null, acceptRate: null, uptime: null, hashrate: null };
    const data = await res.json();
    const runtime = data.runtime ?? {};
    const agg = data.aggregate ?? {};
    return {
      sessions: runtime.active_miners ?? agg.active_miners ?? null,
      acceptRate: runtime.accept_rate_pct ?? agg.accept_rate_pct ?? null,
      uptime: runtime.pool_uptime_seconds ?? null,
      hashrate: agg.hashrate ?? null,
    };
  } catch {
    return { sessions: null, acceptRate: null, uptime: null, hashrate: null };
  }
}

async function fetchNetworkStatus(): Promise<{
  coreOnline: boolean;
  poolOnline: boolean;
}> {
  try {
    const res = await fetch('/api/network', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { coreOnline: false, poolOnline: false };
    const data = await res.json();
    const nodes = data.nodes ?? [];
    const core = nodes.find((n: any) => n.id === 'core-pc');
    const edge = nodes.find((n: any) => n.id === 'edge-vps');
    return {
      coreOnline: core?.online ?? false,
      poolOnline: edge?.online ?? false,
    };
  } catch {
    return { coreOnline: false, poolOnline: false };
  }
}

async function fetchMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  // Primary data from live APIs (always available)
  const [chain, pool, network] = await Promise.all([
    fetchBlockchainStats(),
    fetchPoolStats(),
    fetchNetworkStatus(),
  ]);

  // Enrichment from Prometheus (optional — may be null if Prometheus is down)
  const [load1, memAvailable, memTotal, diskAvailable, diskTotal] = await Promise.all([
    metricValue('node_load1'),
    metricValue('node_memory_MemAvailable_bytes'),
    metricValue('node_memory_MemTotal_bytes'),
    metricValue('node_filesystem_avail_bytes{mountpoint="/"}'),
    metricValue('node_filesystem_size_bytes{mountpoint="/"}'),
  ]);

  return {
    chainHeight: chain.height,
    coreUp: network.coreOnline ? 1 : 0,
    poolUp: network.poolOnline ? 1 : 0,
    poolSessions: pool.sessions,
    poolAcceptRate: pool.acceptRate,
    poolUptime: pool.uptime,
    templateFees: null, // Not exposed by current API; placeholder for future
    load1,
    memAvailable,
    memTotal,
    diskAvailable,
    diskTotal,
  };
}

function MetricPanel({
  label,
  value,
  detail,
  accent,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/40 ${accent}`}>
        {icon}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-2 text-sm text-gray-400">{detail}</p>
    </div>
  );
}

export default function NetworkMonitoringSnapshot() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const [monitoring, setMonitoring] = useState<MonitoringSnapshot | null>(null);
  const [monitoringUpdatedAt, setMonitoringUpdatedAt] = useState<Date | null>(null);

  const refreshMonitoring = useCallback(async () => {
    const next = await fetchMonitoringSnapshot();
    setMonitoring(next);
    setMonitoringUpdatedAt(new Date());
  }, []);

  usePolling(refreshMonitoring, 30_000);

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Observabilita' : 'Observability'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Database className="h-7 w-7 text-zion-gold" />
          {cs ? 'Monitoring prehled' : 'Monitoring Snapshot'}
        </h2>
        <p className="text-sm text-gray-400">{cs ? 'Rychle operacni signaly zrcadlene z monitoring stacku, aby verejna sitova stranka nesla jednim pohledem topologii i zdravi stroje.' : 'Fast operational signals mirrored from the monitoring stack so the public network page carries both topology and machine health at a glance.'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricPanel
          label={cs ? 'Core target' : 'Core Target'}
          value={monitoring?.coreUp === 1 ? (cs ? 'ONLINE' : 'UP') : monitoring?.coreUp === 0 ? (cs ? 'OFFLINE' : 'DOWN') : '—'}
          detail={`${cs ? 'Vyska' : 'Height'} ${fmtMetric(monitoring?.chainHeight, 0, locale)}`}
          accent={monitoring?.coreUp === 1 ? 'text-emerald-400' : 'text-red-400'}
          icon={<Server className="h-5 w-5" />}
        />
        <MetricPanel
          label={cs ? 'Pool target' : 'Pool Target'}
          value={monitoring?.poolUp === 1 ? (cs ? 'ONLINE' : 'UP') : monitoring?.poolUp === 0 ? (cs ? 'OFFLINE' : 'DOWN') : '—'}
          detail={`${fmtMetric(monitoring?.poolSessions, 0, locale)} ${cs ? 'aktivnich relaci' : 'active sessions'}`}
          accent={monitoring?.poolUp === 1 ? 'text-emerald-400' : 'text-red-400'}
          icon={<Radio className="h-5 w-5" />}
        />
        <MetricPanel
          label={cs ? 'Accept rate' : 'Accept Rate'}
          value={fmtPct(monitoring?.poolAcceptRate)}
          detail={`${cs ? 'Uptime' : 'Uptime'} ${fmtUptime(monitoring?.poolUptime)}`}
          accent="text-zion-cyan"
          icon={<Activity className="h-5 w-5" />}
        />
        <MetricPanel
          label={cs ? 'Template fee' : 'Template Fees'}
          value={monitoring?.templateFees != null ? `${monitoring.templateFees.toFixed(4)} ZION` : '—'}
          detail={cs ? 'Aktualni fee envelope z aktivniho block template' : 'Current fee envelope from the active block template'}
          accent="text-zion-gold"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <MetricPanel
          label={cs ? 'Load avg 1m' : 'Load Avg 1m'}
          value={fmtMetric(monitoring?.load1, 2, locale)}
          detail={cs ? 'Zatez primarniho hostu' : 'Primary host pressure'}
          accent="text-zion-purple"
          icon={<Cpu className="h-5 w-5" />}
        />
        <MetricPanel
          label={cs ? 'Volna pamet' : 'Memory Free'}
          value={fmtBytes(monitoring?.memAvailable)}
          detail={monitoring?.memTotal != null ? `${fmtBytes(monitoring?.memTotal)} ${cs ? 'celkem' : 'total'}` : cs ? 'Pamet z node exporteru' : 'Node exporter memory'}
          accent="text-emerald-400"
          icon={<Database className="h-5 w-5" />}
        />
        <MetricPanel
          label={cs ? 'Volny disk' : 'Disk Free'}
          value={fmtBytes(monitoring?.diskAvailable)}
          detail={monitoring?.diskTotal != null ? `${fmtBytes(monitoring?.diskTotal)} ${cs ? 'celkem' : 'total'}` : cs ? 'Root filesystem' : 'Root filesystem'}
          accent="text-blue-400"
          icon={<HardDrive className="h-5 w-5" />}
        />
        <div className="zion-rainbow-sub p-6 flex flex-col justify-between" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">{cs ? 'Hlubsi drilldown' : 'Deep Drilldown'}</p>
            <p className="text-sm text-gray-300">{cs ? 'Pro sparkline grafy, syrove Prometheus metriky a inventar stacku pokracujte do plneho monitoringu.' : 'For sparklines, raw Prometheus-backed counters, and stack inventory, continue to the full monitoring dashboard.'}</p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs text-gray-500 gap-3">
            <span className="inline-flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-zion-cyan" /> {monitoringUpdatedAt ? `${cs ? 'Aktualizovano' : 'Updated'} ${monitoringUpdatedAt.toLocaleTimeString(locale)}` : cs ? 'Nacitam ziva data' : 'Loading live data'}</span>
            <Link href="/monitoring" className="text-zion-cyan hover:text-white transition-colors inline-flex items-center gap-1.5 shrink-0">
              {cs ? 'Plny monitoring' : 'Full monitoring'} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
