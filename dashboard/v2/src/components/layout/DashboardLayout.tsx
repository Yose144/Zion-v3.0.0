// ─── ZION Dashboard v2 — DashboardLayout (v2.9 aesthetic) ───────────────────
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Menu, Activity } from 'lucide-react';
import { Sidebar, type TabId } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useStatusStore } from '../../stores/statusStore';
import { useAlertStore } from '../../stores/alertStore';
import { usePolling } from '../../hooks/usePolling';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Toast } from '../ui/Toast';
import { KeyboardHelp } from '../ui/KeyboardHelp';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Alert } from '../../types/api';

// ── Lazy tab imports ────────────────────────────────────────────────────────
const OverviewTab    = lazy(() => import('../tabs/OverviewTab'));
const LogsTab        = lazy(() => import('../tabs/LogsTab'));
const ExplorerTab    = lazy(() => import('../tabs/ExplorerTab'));
const ControlsTab    = lazy(() => import('../tabs/ControlsTab'));
const ChartsTab      = lazy(() => import('../tabs/ChartsTab'));
const ServicesTab    = lazy(() => import('../tabs/ServicesTab'));
const L1Tab          = lazy(() => import('../tabs/L1Tab'));
const LayersTab      = lazy(() => import('../tabs/LayersTab'));
const HiranTab       = lazy(() => import('../tabs/HiranTab'));
const DaoTab         = lazy(() => import('../tabs/DaoTab'));
const WalletsTab     = lazy(() => import('../tabs/WalletsTab'));
const AlertsTab      = lazy(() => import('../tabs/AlertsTab'));
const TopologyTab    = lazy(() => import('../tabs/TopologyTab'));
const EnvTab         = lazy(() => import('../tabs/EnvTab'));
const DatabaseTab    = lazy(() => import('../tabs/DatabaseTab'));
const OpsTab         = lazy(() => import('../tabs/OpsTab'));
const LaunchDayTab   = lazy(() => import('../tabs/LaunchDayTab'));
const SettingsTab    = lazy(() => import('../tabs/SettingsTab'));

function TabFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Activity size={16} className="animate-pulse text-purple-400" />
        <span className="text-sm font-medium tracking-wide">Loading module…</span>
      </div>
    </div>
  );
}

function TabContent({ active }: { active: TabId }) {
  switch (active) {
    case 'overview':    return <OverviewTab />;
    case 'logs':        return <LogsTab />;
    case 'explorer':    return <ExplorerTab />;
    case 'controls':    return <ControlsTab />;
    case 'charts':      return <ChartsTab />;
    case 'services':    return <ServicesTab />;
    case 'l1':          return <L1Tab />;
    case 'l2': case 'l3': case 'l4': case 'l5': case 'l6':
      return <LayersTab layer={active} />;
    case 'hiran':       return <HiranTab />;
    case 'dao':         return <DaoTab />;
    case 'wallets':     return <WalletsTab />;
    case 'alerts':      return <AlertsTab />;
    case 'topology':    return <TopologyTab />;
    case 'env':         return <EnvTab />;
    case 'database':    return <DatabaseTab />;
    case 'ops':         return <OpsTab />;
    case 'launch-day':  return <LaunchDayTab />;
    case 'settings':    return <SettingsTab />;
    default:            return <div className="p-8 text-slate-500">Tab not found</div>;
  }
}

// Tab label prettifier
const TAB_LABELS: Partial<Record<TabId, string>> = {
  'overview':   'Overview',
  'logs':       'Live Logs',
  'explorer':   'Block Explorer',
  'controls':   'Node Controls',
  'charts':     'Analytics',
  'services':   'Services',
  'l1':         'L1 Consensus',
  'l2':         'L2 Bridge',
  'l3':         'L3 Warp',
  'l4':         'L4 Oasis',
  'l5':         'L5 Space',
  'l6':         'L6 Free',
  'hiran':      'Hiran AI',
  'dao':        'DAO Governance',
  'wallets':    'Wallets',
  'alerts':     'Alerts',
  'topology':   'Network Topology',
  'env':        'Env Files',
  'database':   'Database',
  'ops':        'Ops',
  'launch-day': 'Launch Day',
  'settings':   'Settings',
};

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const collapsed = useSettingsStore(s => s.sidebarCollapsed);
  const update = useSettingsStore(s => s.update);
  const connected = useStatusStore(s => s.connected);

  // Init WebSocket (binds to stores)
  useWebSocket();

  // Bootstrap data fetches
  const fetchStatus  = useStatusStore(s => s.fetchStatus);
  const fetchHealth  = useStatusStore(s => s.fetchHealth);
  const fetchAlerts  = useAlertStore(s => s.fetchAlerts);

  useEffect(() => {
    fetchStatus();
    fetchHealth();
    fetchAlerts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling safety net
  usePolling(fetchStatus);
  usePolling(fetchHealth, 2);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTabChange: setActiveTab,
    onToggleSidebar: () => update({ sidebarCollapsed: !collapsed }),
    onShowHelp: () => setShowHelp(true),
  });

  // Toast listener
  useEffect(() => {
    const handler = (e: Event) => {
      const alert = (e as CustomEvent<Alert>).detail;
      setToasts(prev => [...prev, alert].slice(-5));
    };
    window.addEventListener('zion:alert', handler);
    return () => window.removeEventListener('zion:alert', handler);
  }, []);

  const dismissToast = (id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="flex h-screen overflow-hidden zion-shell">
      <Sidebar
        active={activeTab}
        onSelect={setActiveTab}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top header bar */}
        <header
          className="shrink-0 px-4 md:px-6 py-3 flex items-center gap-3"
          style={{
            background: 'rgba(5, 7, 16, 0.7)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={17} />
          </button>

          {/* Tab title — gradient on active */}
          <h1 className="text-sm font-semibold text-gradient flex-1">
            {TAB_LABELS[activeTab] ?? activeTab.replace(/-/g, ' ')}
          </h1>

          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'dot-healthy pulse-live' : 'dot-down'}`} />
            <span className="text-[11px] font-medium tracking-wide"
              style={{ color: connected ? 'rgba(134,239,172,0.7)' : 'rgba(248,113,113,0.7)' }}
            >
              {connected ? 'live' : 'polling'}
            </span>
          </div>

          {/* Help button */}
          <button
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors text-xs font-bold font-mono"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
            }}
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          <Suspense fallback={<TabFallback />}>
            <TabContent active={activeTab} />
          </Suspense>
        </div>
      </main>

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} alert={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Keyboard help modal */}
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
