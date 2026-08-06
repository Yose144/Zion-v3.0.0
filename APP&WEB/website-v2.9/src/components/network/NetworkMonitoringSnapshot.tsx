'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Activity, Cpu, Database, ExternalLink, HardDrive, Radio, RefreshCw, Server, Sparkles } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

const NetworkMonitoringSnapshotCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  observability: { cs: `Observabilita`, en: `Observability` },
  monitoringSnapshot: { cs: `Monitoring prehled`, en: `Monitoring Snapshot` },
  fastOperationalSignalsMirrored: { cs: `Rychle operacni signaly zrcadlene z monitoring stacku, aby verejna sitova stranka nesla jednim pohledem topologii i zdravi stroje.`, en: `Fast operational signals mirrored from the monitoring stack so the public network page carries both topology and machine health at a glance.` },
  coreTarget: { cs: `Core target`, en: `Core Target` },
  up: { cs: `ONLINE`, en: `UP` },
  down: { cs: `OFFLINE`, en: `DOWN` },
  height: { cs: `Vyska`, en: `Height` },
  poolTarget: { cs: `Pool target`, en: `Pool Target` },
  activeSessions: { cs: `aktivnich relaci`, en: `active sessions` },
  acceptRate: { cs: `Accept rate`, en: `Accept Rate` },
  uptime: { cs: `Uptime`, en: `Uptime` },
  templateFees: { cs: `Template fee`, en: `Template Fees` },
  currentFeeEnvelopeFromTheActiv: { cs: `Aktualni fee envelope z aktivniho block template`, en: `Current fee envelope from the active block template` },
  loadAvg1m: { cs: `Load avg 1m`, en: `Load Avg 1m` },
  primaryHostPressure: { cs: `Zatez primarniho hostu`, en: `Primary host pressure` },
  memoryFree: { cs: `Volna pamet`, en: `Memory Free` },
  total: { cs: `celkem`, en: `total` },
  nodeExporterMemory: { cs: `Pamet z node exporteru`, en: `Node exporter memory` },
  diskFree: { cs: `Volny disk`, en: `Disk Free` },
  rootFilesystem: { cs: `Root filesystem`, en: `Root filesystem` },
  deepDrilldown: { cs: `Hlubsi drilldown`, en: `Deep Drilldown` },
  forSparklinesRawPrometheusBack: { cs: `Pro sparkline grafy, syrove Prometheus metriky a inventar stacku pokracujte do plneho monitoringu.`, en: `For sparklines, raw Prometheus-backed counters, and stack inventory, continue to the full monitoring dashboard.` },
  updated: { cs: `Aktualizovano`, en: `Updated` },
  loadingLiveData: { cs: `Nacitam ziva data`, en: `Loading live data` },
  fullMonitoring: { cs: `Plny monitoring`, en: `Full monitoring` },
};

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
    const primary = nodes.find((n: any) => n.id === 'edge-vps');
    return {
      coreOnline: primary?.online ?? false,
      poolOnline: primary?.online ?? false,
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
    <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
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
  const locale = NetworkMonitoringSnapshotCopy.enUs[cs ? 'cs' : 'en'];
  const [monitoring, setMonitoring] = useState<MonitoringSnapshot | null>(null);
  const [monitoringUpdatedAt, setMonitoringUpdatedAt] = useState<Date | null>(null);

  const refreshMonitoring = useCallback(async () => {
    const next = await fetchMonitoringSnapshot();
    setMonitoring(next);
    setMonitoringUpdatedAt(new Date());
  }, []);

  usePolling(refreshMonitoring, 30_000);

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkMonitoringSnapshotCopy.observability[cs ? 'cs' : 'en']}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Database className="h-7 w-7 text-zion-gold" />
          {NetworkMonitoringSnapshotCopy.monitoringSnapshot[cs ? 'cs' : 'en']}
        </h2>
        <p className="text-sm text-gray-400">{NetworkMonitoringSnapshotCopy.fastOperationalSignalsMirrored[cs ? 'cs' : 'en']}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.coreTarget[cs ? 'cs' : 'en']}
          value={monitoring?.coreUp === 1 ? (NetworkMonitoringSnapshotCopy.up[cs ? 'cs' : 'en']) : monitoring?.coreUp === 0 ? (NetworkMonitoringSnapshotCopy.down[cs ? 'cs' : 'en']) : '—'}
          detail={`${NetworkMonitoringSnapshotCopy.height[cs ? 'cs' : 'en']} ${fmtMetric(monitoring?.chainHeight, 0, locale)}`}
          accent={monitoring?.coreUp === 1 ? 'text-zion-cyan-400' : 'text-zion-purple-400'}
          icon={<Server className="h-5 w-5" />}
        />
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.poolTarget[cs ? 'cs' : 'en']}
          value={monitoring?.poolUp === 1 ? (NetworkMonitoringSnapshotCopy.up[cs ? 'cs' : 'en']) : monitoring?.poolUp === 0 ? (NetworkMonitoringSnapshotCopy.down[cs ? 'cs' : 'en']) : '—'}
          detail={`${fmtMetric(monitoring?.poolSessions, 0, locale)} ${NetworkMonitoringSnapshotCopy.activeSessions[cs ? 'cs' : 'en']}`}
          accent={monitoring?.poolUp === 1 ? 'text-zion-cyan-400' : 'text-zion-purple-400'}
          icon={<Radio className="h-5 w-5" />}
        />
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.acceptRate[cs ? 'cs' : 'en']}
          value={fmtPct(monitoring?.poolAcceptRate)}
          detail={`${NetworkMonitoringSnapshotCopy.uptime[cs ? 'cs' : 'en']} ${fmtUptime(monitoring?.poolUptime)}`}
          accent="text-zion-cyan"
          icon={<Activity className="h-5 w-5" />}
        />
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.templateFees[cs ? 'cs' : 'en']}
          value={monitoring?.templateFees != null ? `${monitoring.templateFees.toFixed(4)} ZION` : '—'}
          detail={NetworkMonitoringSnapshotCopy.currentFeeEnvelopeFromTheActiv[cs ? 'cs' : 'en']}
          accent="text-zion-gold"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.loadAvg1m[cs ? 'cs' : 'en']}
          value={fmtMetric(monitoring?.load1, 2, locale)}
          detail={NetworkMonitoringSnapshotCopy.primaryHostPressure[cs ? 'cs' : 'en']}
          accent="text-zion-purple"
          icon={<Cpu className="h-5 w-5" />}
        />
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.memoryFree[cs ? 'cs' : 'en']}
          value={fmtBytes(monitoring?.memAvailable)}
          detail={monitoring?.memTotal != null ? `${fmtBytes(monitoring?.memTotal)} ${NetworkMonitoringSnapshotCopy.total[cs ? 'cs' : 'en']}` : NetworkMonitoringSnapshotCopy.nodeExporterMemory[cs ? 'cs' : 'en']}
          accent="text-zion-cyan-400"
          icon={<Database className="h-5 w-5" />}
        />
        <MetricPanel
          label={NetworkMonitoringSnapshotCopy.diskFree[cs ? 'cs' : 'en']}
          value={fmtBytes(monitoring?.diskAvailable)}
          detail={monitoring?.diskTotal != null ? `${fmtBytes(monitoring?.diskTotal)} ${NetworkMonitoringSnapshotCopy.total[cs ? 'cs' : 'en']}` : NetworkMonitoringSnapshotCopy.rootFilesystem[cs ? 'cs' : 'en']}
          accent="text-zion-purple-400"
          icon={<HardDrive className="h-5 w-5" />}
        />
        <div className="zion-rainbow-sub p-6 flex flex-col justify-between" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">{NetworkMonitoringSnapshotCopy.deepDrilldown[cs ? 'cs' : 'en']}</p>
            <p className="text-sm text-gray-300">{NetworkMonitoringSnapshotCopy.forSparklinesRawPrometheusBack[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs text-gray-500 gap-3">
            <span className="inline-flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-zion-cyan" /> {monitoringUpdatedAt ? `${NetworkMonitoringSnapshotCopy.updated[cs ? 'cs' : 'en']} ${monitoringUpdatedAt.toLocaleTimeString(locale)}` : NetworkMonitoringSnapshotCopy.loadingLiveData[cs ? 'cs' : 'en']}</span>
            <Link href="/monitoring" className="text-zion-cyan hover:text-white transition-colors inline-flex items-center gap-1.5 shrink-0">
              {NetworkMonitoringSnapshotCopy.fullMonitoring[cs ? 'cs' : 'en']} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
