// ─── ZION Dashboard v2 — DashboardLayout ─────────────────────────────────────
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';
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
      <div className="text-(--color-text-muted) text-sm animate-pulse">Loading...</div>
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
    default:            return <div className="p-8 text-(--color-text-muted)">Tab not found</div>;
  }
}

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const collapsed = useSettingsStore(s => s.sidebarCollapsed);
  const update = useSettingsStore(s => s.update);

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
    <div className="flex h-screen overflow-hidden bg-(--color-bg-base)">
      <Sidebar
        active={activeTab}
        onSelect={setActiveTab}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Tab title bar */}
        <header className="shrink-0 px-4 md:px-6 py-3 border-b border-(--color-border) flex items-center gap-3 bg-(--color-bg-panel)">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text) transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <h1 className="text-sm font-semibold text-(--color-text) capitalize flex-1">
            {activeTab.replace(/-/g, ' ')}
          </h1>

          {/* Help button */}
          <button
            className="p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text) transition-colors text-xs font-mono"
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
