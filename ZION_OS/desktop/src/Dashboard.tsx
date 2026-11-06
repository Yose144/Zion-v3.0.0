import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { showNotification, requestNotificationPermission } from './lib/api';
import { useDashboard } from './context/DashboardContext';
import Shell from './components/layout/Shell';
import WarpStarfield from './components/layout/WarpStarfield';
import type { TabId } from './types';
import { useLang } from './i18n';

const Overview = lazy(() => import('./views/Overview'));
const Mining = lazy(() => import('./views/Mining'));
const Network = lazy(() => import('./views/Network'));
const Ecosystem = lazy(() => import('./views/Ecosystem'));
const Ops = lazy(() => import('./views/Ops'));
const Placeholder = lazy(() => import('./views/Placeholder'));

const CORE_TABS: TabId[] = ['overview', 'mining', 'network', 'ecosystem', 'ops'];

export default function Dashboard() {
  const { alerts, lastError } = useDashboard();
  const { t } = useLang();
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
      case 'services':
      case 'alerts':
        return <Overview />;
      case 'mining':
      case 'pool-miners':
      case 'payout':
      case 'revenue':
      case 'miner-live':
      case 'charts':
      case 'events':
        return <Mining />;
      case 'network':
      case 'nodes':
      case 'topology':
      case 'explorer':
      case 'wallets':
      case 'agent':
        return <Network />;
      case 'ecosystem':
      case 'l1':
      case 'l2':
      case 'l3':
      case 'l4':
      case 'l5':
      case 'l6':
      case 'warp':
      case 'hiran':
      case 'dao':
      case 'bridge':
      case 'cex':
      case 'warp-swap':
        return <Ecosystem />;
      case 'ops':
      case 'logs':
      case 'backups':
      case 'settings':
      case 'fleet':
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
            {lastError}
          </div>
        )}
        <div
          key={activeTab}
          className="space-y-5 animate-[fadeIn_0.25s_ease-out]"
          style={{ '--rc': '255 215 0' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-extrabold text-gradient">{t(activeTab)}</h2>
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
