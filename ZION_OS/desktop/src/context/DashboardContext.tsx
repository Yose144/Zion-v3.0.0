import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  fetchFullStatus,
  fetchChecklist,
  fetchEdgeOverview,
  fetchRevenueDashboard,
  fetchPoolMinersDashboard,
  fetchWallets,
  fetchBlocks,
  fetchEvents,
  fetchAlertsHistory,
  fetchControls,
  fetchTopology,
  fetchAgentStatus,
  fetchLayerStatusLayer,
  fetchLogFiles,
  type V3Status,
  type ServiceHealth,
  type AlertItem,
  type ReadinessScore,
  type MonitoringStatus,
  type Checklist,
  type EdgeOverview,
  type RevenueDashboard,
  type PoolMinersDashboard,
  type WalletsResponse,
  type BlockSummary,
  type Wallet as WalletType,
  type BlockEvent,
  type TopologyResponse,
  type AgentStatus,
  type LayerStatusResponse,
  type LogFilesResponse,
} from '../lib/api';

const REFRESH_INTERVAL = 5000;

interface DashboardData {
  status: V3Status | null;
  services: ServiceHealth[];
  alerts: AlertItem[];
  readiness: ReadinessScore | null;
  monitoring: MonitoringStatus | null;
  checklist: Checklist | null;
  edgeOverview: EdgeOverview | null;
  revenue: RevenueDashboard | null;
  poolDashboard: PoolMinersDashboard | null;
  wallets: WalletsResponse | null;
  blocks: BlockSummary[] | null;
  events: { events: BlockEvent[] } | null;
  alertsHistory: { alerts: AlertItem[] } | null;
  controls: { actions: string[]; topology: string } | null;
  topology: TopologyResponse | null;
  agent: AgentStatus | null;
  layerStatus: LayerStatusResponse | null;
  logFiles: LogFilesResponse | null;
  lastError: string | null;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardData | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<V3Status | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringStatus | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [edgeOverview, setEdgeOverview] = useState<EdgeOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueDashboard | null>(null);
  const [poolDashboard, setPoolDashboard] = useState<PoolMinersDashboard | null>(null);
  const [wallets, setWallets] = useState<WalletsResponse | null>(null);
  const [blocks, setBlocks] = useState<BlockSummary[] | null>(null);
  const [events, setEvents] = useState<{ events: BlockEvent[] } | null>(null);
  const [alertsHistory, setAlertsHistory] = useState<{ alerts: AlertItem[] } | null>(null);
  const [controls, setControls] = useState<{ actions: string[]; topology: string } | null>(null);
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [layerStatus, setLayerStatus] = useState<LayerStatusResponse | null>(null);
  const [logFiles, setLogFiles] = useState<LogFilesResponse | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [
        full,
        chk,
        edge,
        rev,
        pool,
        wal,
        blk,
        ev,
        alh,
        ctrl,
        topo,
        ag,
        ls,
        lf,
      ] = await Promise.all([
        fetchFullStatus(),
        fetchChecklist(),
        fetchEdgeOverview(),
        fetchRevenueDashboard(),
        fetchPoolMinersDashboard(),
        fetchWallets(),
        fetchBlocks(20),
        fetchEvents(),
        fetchAlertsHistory(),
        fetchControls(),
        fetchTopology().catch(() => null),
        fetchAgentStatus().catch(() => null),
        fetchLayerStatusLayer('l1').catch(() => null),
        fetchLogFiles().catch(() => null),
      ]);

      setStatus(full.status);
      setServices(full.services);
      setAlerts(full.alerts);
      setReadiness(full.readiness);
      setMonitoring(full.monitoring);
      setChecklist(chk);
      setEdgeOverview(edge);
      setRevenue(rev);
      setPoolDashboard(pool);
      setWallets(wal);
      setBlocks(blk);
      setEvents(ev);
      setAlertsHistory(alh);
      setControls(ctrl);
      setTopology(topo);
      setAgent(ag);
      setLayerStatus(ls);
      setLogFiles(lf);

      setLastError(full.status ? null : 'Python dashboard (localhost:8766) není dostupný');
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

  return (
    <DashboardContext.Provider
      value={{
        status,
        services,
        alerts,
        readiness,
        monitoring,
        checklist,
        edgeOverview,
        revenue,
        poolDashboard,
        wallets,
        blocks,
        events,
        alertsHistory,
        controls,
        topology,
        agent,
        layerStatus,
        logFiles,
        lastError,
        autoRefresh,
        setAutoRefresh,
        refresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
