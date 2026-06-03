// ─── ZION Dashboard v2 — DashboardLayout (v2.9 aesthetic) ───────────────────
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Menu, Activity, Sun, Moon, Monitor } from 'lucide-react';
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

function ThemeSwitcher({ current, onChange }: { current: string; onChange: (t: 'dark' | 'light' | 'system') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const icon =
    current === 'light' ? <Sun size={14} className="text-amber-400" /> :
    current === 'dark'  ? <Moon size={14} className="text-indigo-300" /> :
    <Monitor size={14} className="text-gray-400" />;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 hover:border-white/20 transition-colors"
        title={`Theme: ${current}`}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 flex flex-col gap-0.5 p-1 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-xl z-50 min-w-[7rem]">
          {(['dark','light','system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { onChange(t); setOpen(false); }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] capitalize transition-colors ${
                current === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'light' && <Sun size={12} className="text-amber-400" />}
              {t === 'dark' && <Moon size={12} className="text-indigo-300" />}
              {t === 'system' && <Monitor size={12} className="text-gray-400" />}
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TabFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-500">
        <Activity size={16} className="animate-pulse text-zion-purple" />
        <span className="text-sm font-medium tracking-wide text-gray-400">Loading module…</span>
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
  const theme = useSettingsStore(s => s.theme);

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
    <div className="flex h-screen overflow-hidden" style={{ background: 'rgb(var(--color-bg))' }}>
      <Sidebar
        active={activeTab}
        onSelect={setActiveTab}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top header bar — same as website nav style */}
        <header className="shrink-0 px-3 md:px-6 py-2.5 md:py-3 flex items-center gap-2 md:gap-3 border-b border-white/8 bg-black/80 backdrop-blur-2xl">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={17} />
          </button>

          {/* Tab title */}
          <h1 className="text-sm font-semibold text-white flex-1">
            {TAB_LABELS[activeTab] ?? activeTab.replace(/-/g, ' ')}
          </h1>

          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-white/8 bg-white/5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}
              style={connected ? { boxShadow: '0 0 6px rgba(74,222,128,0.8)' } : undefined}
            />
            <span className={`text-[11px] font-medium tracking-wide ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'live' : 'polling'}
            </span>
          </div>

          {/* Theme switcher */}
          <ThemeSwitcher current={theme} onChange={(t) => update({ theme: t })} />

          {/* Help button */}
          <button
            className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-gray-500 hover:text-white hover:border-white/20 transition-colors text-xs font-bold font-mono"
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
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 flex flex-col gap-2 pointer-events-none items-center md:items-end">
        {toasts.map(t => (
          <Toast key={t.id} alert={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Keyboard help modal */}
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
