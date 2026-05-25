// ─── ZION Dashboard v2 — Sidebar ────────────────────────────────────────────
import React from 'react';
import {
  LayoutDashboard, FileText, Search, Terminal,
  BarChart2, Server, Cpu, Layers, Brain,
  Vote, Wallet, AlertTriangle, Settings,
  Shield, Zap, Globe, Rocket, Database,
  CalendarClock, Wrench, Network, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useUnreadAlerts } from '../../stores/alertStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useStatusStore } from '../../stores/statusStore';

export type TabId =
  | 'overview' | 'logs' | 'explorer' | 'controls' | 'charts' | 'services'
  | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6'
  | 'hiran' | 'dao' | 'wallets' | 'alerts' | 'topology'
  | 'env' | 'database' | 'ops' | 'launch-day' | 'settings';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group?: string;
}

const NAV: NavItem[] = [
  // Core
  { id: 'overview',    label: 'Overview',    icon: LayoutDashboard, group: 'Core' },
  { id: 'logs',        label: 'Logs',        icon: FileText,        group: 'Core' },
  { id: 'explorer',   label: 'Explorer',    icon: Search,          group: 'Core' },
  { id: 'charts',     label: 'Charts',      icon: BarChart2,       group: 'Core' },
  // Infrastructure
  { id: 'services',   label: 'Services',    icon: Server,          group: 'Infra' },
  { id: 'topology',   label: 'Topology',    icon: Network,         group: 'Infra' },
  { id: 'controls',   label: 'Controls',    icon: Terminal,        group: 'Infra' },
  { id: 'l1',         label: 'L1 Consensus', icon: Cpu,            group: 'Layers' },
  { id: 'l2',         label: 'L2 Bridge',   icon: Zap,             group: 'Layers' },
  { id: 'l3',         label: 'L3 Warp',     icon: Rocket,          group: 'Layers' },
  { id: 'l4',         label: 'L4 Oasis',    icon: Globe,           group: 'Layers' },
  { id: 'l5',         label: 'L5 Space',    icon: Layers,          group: 'Layers' },
  { id: 'l6',         label: 'L6 Free',     icon: Shield,          group: 'Layers' },
  // AI
  { id: 'hiran',      label: 'Hiran AI',    icon: Brain,           group: 'AI' },
  // Finance & Gov
  { id: 'dao',        label: 'DAO',         icon: Vote,            group: 'Gov' },
  { id: 'wallets',    label: 'Wallets',     icon: Wallet,          group: 'Gov' },
  // Ops
  { id: 'alerts',     label: 'Alerts',      icon: AlertTriangle,   group: 'Ops' },
  { id: 'env',        label: 'Env Files',   icon: Wrench,          group: 'Ops' },
  { id: 'database',   label: 'Database',    icon: Database,        group: 'Ops' },
  { id: 'ops',        label: 'Ops',         icon: Settings,        group: 'Ops' },
  { id: 'launch-day', label: 'Launch Day',  icon: CalendarClock,   group: 'Ops' },
  { id: 'settings',   label: 'Settings',    icon: Settings,        group: 'Ops' },
];

const GROUPS = ['Core', 'Infra', 'Layers', 'AI', 'Gov', 'Ops'];

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  const unread = useUnreadAlerts();
  const collapsed = useSettingsStore(s => s.sidebarCollapsed);
  const update = useSettingsStore(s => s.update);
  const connected = useStatusStore(s => s.connected);

  return (
    <aside
      className={`flex flex-col shrink-0 bg-(--color-bg-panel) border-r border-(--color-border) h-full transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-(--color-border)">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-(--color-zion-gold) glow-gold tracking-wider">ZION</span>
            <span className="text-xs text-(--color-text-muted)">v2</span>
          </div>
        )}
        <button
          onClick={() => update({ sidebarCollapsed: !collapsed })}
          className="p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text) transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Connection indicator */}
      {!collapsed && (
        <div className="px-3 py-2 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'dot-healthy pulse-live' : 'dot-down'}`} />
          <span className="text-xs text-(--color-text-muted)">{connected ? 'Live' : 'Polling'}</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-4">
        {GROUPS.map(group => {
          const items = NAV.filter(n => n.group === group);
          return (
            <div key={group}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-(--color-text-muted)">
                  {group}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  const isAlerts = item.id === 'alerts';
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onSelect(item.id)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all
                          ${isActive
                            ? 'bg-(--color-zion-purple)/20 text-(--color-zion-purple) font-medium'
                            : 'text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text)'
                          }
                          ${collapsed ? 'justify-center' : ''}
                        `}
                      >
                        <Icon size={16} className="shrink-0" />
                        {!collapsed && (
                          <span className="truncate flex-1 text-left">{item.label}</span>
                        )}
                        {isAlerts && unread > 0 && (
                          <span className={`${collapsed ? 'absolute top-1 right-1' : ''} bg-(--color-zion-red) text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none`}>
                            {unread}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-(--color-border) text-[10px] text-(--color-text-muted)">
          ZION 2.9.6 · Dashboard v2
        </div>
      )}
    </aside>
  );
}
