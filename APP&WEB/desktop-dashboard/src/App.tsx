import { useEffect, useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import ServiceGrid from './components/ServiceGrid';
import MinerPanel from './components/MinerPanel';
import PoolPanel from './components/PoolPanel';
import ChainPanel from './components/ChainPanel';
import AlertsPanel from './components/AlertsPanel';
import ReadinessBar from './components/ReadinessBar';
import PerformanceCharts from './components/PerformanceCharts';
import { apiFetch, type V3Status, type ServiceHealth, type AlertItem, type ReadinessScore } from './lib/api';

const REFRESH_INTERVAL = 3000;

export default function App() {
  const [status, setStatus] = useState<V3Status | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [st, sv, al, rd] = await Promise.all([
        apiFetch<V3Status>('/api/status'),
        apiFetch<{ services: ServiceHealth[] }>('/api/services'),
        apiFetch<{ alerts: AlertItem[] }>('/api/alerts'),
        apiFetch<ReadinessScore>('/api/readiness'),
      ]);
      if (st) {
        setStatus(st);
        setLastError(null);
      }
      if (sv) setServices(sv.services);
      if (al) setAlerts(al.alerts);
      if (rd) setReadiness(rd);
    } catch (e) {
      setLastError('Backend unreachable');
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  const isEdge = status?.topology === 'edge-primary';

  return (
    <div className="min-h-screen">
      <TopBar
        status={status}
        autoRefresh={autoRefresh}
        onToggleRefresh={() => setAutoRefresh(v => !v)}
        onRefresh={refresh}
        lastError={lastError}
      />

      <main className="max-w-[1600px] mx-auto px-4 py-5 space-y-5">
        <ReadinessBar readiness={readiness} />

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Services</h2>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Live</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Degraded</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Down</span>
            </div>
          </div>
          <ServiceGrid services={services} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MinerPanel miner={status?.miner} />
          <PoolPanel pool={status?.pool} poolEdge={status?.pool_edge} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChainPanel status={status} />
          <AlertsPanel alerts={alerts} />
          <PerformanceCharts miner={status?.miner} />
        </div>
      </main>

      <footer className="border-t border-white/10 mt-6 py-3">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between text-[10px] text-gray-500">
          <span>ZION V3 Dashboard v3.0.0</span>
          <span className="font-mono">{status ? new Date(status.timestamp).toLocaleTimeString() : '—'}</span>
        </div>
      </footer>
    </div>
  );
}
