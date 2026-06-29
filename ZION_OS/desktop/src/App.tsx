import { useEffect, useState, useCallback, useRef } from 'react';
import TopBar from './components/TopBar';
import ServiceGrid from './components/ServiceGrid';
import MinerPanel from './components/MinerPanel';
import PoolPanel from './components/PoolPanel';
import ChainPanel from './components/ChainPanel';
import DefiPanel from './components/DefiPanel';
import BridgePanel from './components/BridgePanel';
import AlertsPanel from './components/AlertsPanel';
import ReadinessBar from './components/ReadinessBar';
import PerformanceCharts from './components/PerformanceCharts';
import ControlsPanel from './components/ControlsPanel';
import LogViewer from './components/LogViewer';
import MonitoringPanel from './components/MonitoringPanel';
import {
  fetchFullStatus,
  requestNotificationPermission,
  showNotification,
  type V3Status,
  type ServiceHealth,
  type AlertItem,
  type ReadinessScore,
  type MonitoringStatus,
} from './lib/api';

const REFRESH_INTERVAL = 5000;

export default function App() {
  const [status, setStatus] = useState<V3Status | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchFullStatus();

      if (data.status) {
        setStatus(data.status);
        setServices(data.services);
        setAlerts(data.alerts);
        setReadiness(data.readiness);
        setMonitoring(data.monitoring);
        setLastError(null);
      } else {
        setLastError('Python dashboard (localhost:8766) neni dostupny');
      }
    } catch (e) {
      setLastError('Backend unreachable');
    }
  }, []);

  useEffect(() => {
    refresh();
    requestNotificationPermission();
    if (!autoRefresh) return;
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  // Desktop notifications for critical alerts
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    alerts.forEach(a => {
      const key = a.id || a.title;
      if (a.severity === 'critical' && key && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        showNotification('ZION Alert', `${a.title}: ${a.detail}`);
      }
    });
  }, [alerts]);

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
        {lastError && (
          <div className="px-3 py-2 rounded bg-amber-900/30 border border-amber-500/20 text-amber-200 text-xs">
            ⚠️ {lastError} — Spust Python dashboard: <code>python ZION_OS/dashboard/app.py</code>
          </div>
        )}

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

        <MonitoringPanel monitoring={monitoring} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ControlsPanel />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <MinerPanel miner={status?.miner} />
            <PoolPanel pool={status?.pool} poolEdge={status?.pool_edge} />
          </div>
        </div>

        <LogViewer />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChainPanel status={status} />
          <AlertsPanel alerts={alerts} />
          <PerformanceCharts miner={status?.miner} />
        </div>

        {/* DeFi + Bridge panels — fetch from Edge website API */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DefiPanel />
          <BridgePanel />
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
