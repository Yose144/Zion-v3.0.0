import { useEffect, useState, useCallback, useRef } from 'react';
import TopBar from './components/TopBar';
import ServiceGrid from './components/ServiceGrid';
import MinerPanel from './components/MinerPanel';
import PoolPanel from './components/PoolPanel';
import ChainPanel from './components/ChainPanel';
import AlertsPanel from './components/AlertsPanel';
import ReadinessBar from './components/ReadinessBar';
import PerformanceCharts from './components/PerformanceCharts';
import ControlsPanel from './components/ControlsPanel';
import LogViewer from './components/LogViewer';
import {
  apiFetch,
  probeTcp,
  rpcCall,
  type V3Status,
  type ServiceHealth,
  type AlertItem,
  type ReadinessScore,
} from './lib/api';

const REFRESH_INTERVAL = 5000;
const EDGE_HOST = '100.76.16.108';
const LOCAL_HOST = '127.0.0.1';

export default function App() {
  const [status, setStatus] = useState<V3Status | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [nativeActive, setNativeActive] = useState(false);

  const nativeProbeAll = useCallback(async () => {
    const [edgeRpc, edgePool, localRpc, localP2p] = await Promise.all([
      probeTcp(EDGE_HOST, 8443, 2000),
      probeTcp(EDGE_HOST, 8444, 2000),
      probeTcp(LOCAL_HOST, 8443, 2000),
      probeTcp(LOCAL_HOST, 8333, 2000),
    ]);

    let edgeHeight: number | null = null;
    let localHeight: number | null = null;

    if (edgeRpc) {
      try {
        const resp = (await rpcCall(
          `http://${EDGE_HOST}:8443/jsonrpc`,
          'getChainInfo',
          null
        )) as any;
        edgeHeight = resp?.result?.chain_height ?? null;
      } catch {
        /* ignore */
      }
    }

    if (localRpc) {
      try {
        const resp = (await rpcCall(
          `http://${LOCAL_HOST}:8443/jsonrpc`,
          'getChainInfo',
          null
        )) as any;
        localHeight = resp?.result?.chain_height ?? null;
      } catch {
        /* ignore */
      }
    }

    const nativeServices: ServiceHealth[] = [
      {
        id: 'edge-node',
        name: 'Edge Node',
        icon: '🌍',
        level: 'L1',
        kind: 'node',
        alive: edgeRpc,
        status: edgeRpc ? 'running' : 'down',
        meta: edgeHeight != null ? { chain_height: edgeHeight } : undefined,
      },
      {
        id: 'edge-pool',
        name: 'Edge Pool',
        icon: '⛏️',
        level: 'L1',
        kind: 'pool',
        alive: edgePool,
        status: edgePool ? 'running' : 'down',
      },
      {
        id: 'local-node',
        name: 'Local Node',
        icon: '🔷',
        level: 'L1',
        kind: 'node',
        alive: localRpc,
        status: localRpc ? 'running' : 'down',
        meta: localHeight != null ? { chain_height: localHeight } : undefined,
      },
      {
        id: 'local-p2p',
        name: 'Local P2P',
        icon: '📡',
        level: 'L1',
        kind: 'node',
        alive: localP2p,
        status: localP2p ? 'running' : 'down',
      },
    ];

    const nativeStatus: V3Status = {
      timestamp: new Date().toISOString(),
      topology: 'edge-primary',
      node1: {
        running: localRpc,
        chain_height: localHeight,
        known_peers: 0,
        mempool_size: 0,
      },
      node2: { running: false, chain_height: null, known_peers: 0, mempool_size: 0 },
      edge_node: {
        running: edgeRpc,
        chain_height: edgeHeight,
        known_peers: 0,
        mempool_size: 0,
      },
      pool: { running: false },
      pool_edge: { running: edgePool, host: EDGE_HOST },
      miner: {
        running: false,
        hashrate: null,
        gpu_backend: null,
        gpu_device: null,
        shares_accepted: 0,
        shares_rejected: 0,
        pool_addr: null,
        current_height: null,
      },
    };

    return { services: nativeServices, status: nativeStatus };
  }, []);

  const refresh = useCallback(async () => {
    let httpOk = false;

    // 1) Try Python dashboard backend (HTTP)
    try {
      const [st, sv, al, rd] = await Promise.all([
        apiFetch<V3Status>('/api/status'),
        apiFetch<{ services: ServiceHealth[] }>('/api/services'),
        apiFetch<{ alerts: AlertItem[] }>('/api/alerts'),
        apiFetch<ReadinessScore>('/api/readiness'),
      ]);
      if (st) setStatus(st);
      if (sv) {
        setServices(sv.services);
        setNativeActive(false);
      }
      if (al) setAlerts(al.alerts);
      if (rd) setReadiness(rd);
      httpOk = !!(st || sv);
      if (httpOk) setLastError(null);
    } catch {
      /* HTTP failed */
    }

    // 2) Always run native probes for ground-truth service health
    try {
      const native = await nativeProbeAll();
      if (!httpOk) {
        // HTTP down → use native as primary data source
        setStatus(native.status);
        setServices(native.services);
        setAlerts([
          {
            severity: 'warning',
            title: 'Python backend offline',
            detail:
              'Dashboard is running in native probe mode. Start the Python backend (port 8766) for full metrics.',
            id: 'native-fallback',
          },
        ]);
        setReadiness({ score: 0, checks: [] });
        setLastError('Native probes active — Python backend unreachable');
        setNativeActive(true);
      }
    } catch (e) {
      if (!httpOk) {
        setLastError('Backend unreachable');
      }
    }
  }, [nativeProbeAll]);

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  // Desktop notifications for critical alerts
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().catch(() => {});
    }
    alerts.forEach(a => {
      const key = a.id || a.title;
      if (a.severity === 'critical' && key && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        try {
          new Notification('ZION Alert', {
            body: `${a.title}: ${a.detail}`,
            icon: '/zion_logo.png',
          });
        } catch {
          /* ignore */
        }
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
        {nativeActive && (
          <div className="px-3 py-2 rounded bg-amber-900/30 border border-amber-500/20 text-amber-200 text-xs">
            ⚠️ Running in native probe mode — Python dashboard backend (port 8766) is offline.
            Start it for full metrics, payouts, and miner telemetry.
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
