import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { showNotification, requestNotificationPermission } from './lib/api';
import { useDashboard } from './context/DashboardContext';
import Shell from './components/layout/Shell';
import WarpStarfield from './components/layout/WarpStarfield';
import type { TabId } from './types';

const Overview = lazy(() => import('./views/Overview'));
const Mining = lazy(() => import('./views/Mining'));
const Network = lazy(() => import('./views/Network'));
const Ecosystem = lazy(() => import('./views/Ecosystem'));
const Ops = lazy(() => import('./views/Ops'));
const Placeholder = lazy(() => import('./views/Placeholder'));

const CORE_TABS: TabId[] = ['overview', 'mining', 'network', 'ecosystem', 'ops'];

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  mining: 'Mining',
  network: 'Network',
  ecosystem: 'Ecosystem',
  ops: 'Ops',
  nodes: 'Nodes',
  topology: 'Topology',
  orchestrator: 'Orchestrator',
  'pool-miners': 'Miners',
  payout: 'Payouts',
  revenue: 'Revenue',
  'miner-live': 'Live Miner',
  l1: 'L1',
  l2: 'L2',
  l3: 'L3',
  l4: 'L4',
  l5: 'L5',
  l6: 'L6',
  warp: 'WARP',
  hiran: 'Hiran AI',
  'ai-agents': 'AI Agents',
  'ncl-jobs': 'NCL Jobs',
  'poc-lab': 'PoC Lab',
  services: 'Services',
  alerts: 'Alerts',
  logs: 'Logs',
  backups: 'Backups',
  fleet: 'Fleet',
  settings: 'Settings',
  explorer: 'Explorer',
  wallets: 'Wallets',
  dao: 'DAO',
  bridge: 'Bridge',
  'bridge-validators': 'Validators',
  'warp-swap': 'Swap',
  cex: 'CEX',
  charts: 'Charts',
  events: 'Events',
  metrics: 'Metrics',
  database: 'DB',
  env: 'Env',
  genesis: 'Genesis',
  blockers: 'Blockers',
  'servers-setup': 'Servers',
  'launch-day': 'Launch',
  wizard: 'Wizard',
  agent: 'Agent',
};

export default function Dashboard() {
  const { alerts, lastError } = useDashboard();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    alerts.forEach((a) => {
      const key = a.id || a.title;
      if (a.severity === 'critical' && key && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        showNotification('ZION Alert', `${a.title}: ${a.detail}`);
      }
    });
  }, [alerts]);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'mining':
        return <Mining />;
      case 'network':
        return <Network />;
      case 'ecosystem':
        return <Ecosystem />;
      case 'ops':
        return <Ops />;
      default:
        return <Placeholder tab={activeTab} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      <WarpStarfield />
      <Shell activeTab={activeTab} onTabChange={setActiveTab}>
        {lastError && (
          <div className="px-3 py-2 rounded bg-amber-900/30 border border-amber-500/20 text-amber-200 text-xs mb-4">
            {lastError} — Spusť Python dashboard: <code>python ZION_OS/dashboard/app.py</code>
          </div>
        )}
        <div
          key={activeTab}
          className="space-y-5 animate-[fadeIn_0.25s_ease-out]"
          style={{ '--rc': '255 215 0' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-extrabold text-gradient">{TAB_LABELS[activeTab]}</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <Suspense
            fallback={
              <div className="zion-card p-8 flex items-center justify-center text-sm text-gray-400">
                <span className="animate-pulse">Loading view…</span>
              </div>
            }
          >
            {renderTab()}
          </Suspense>
        </div>
      </Shell>
    </div>
  );
}
