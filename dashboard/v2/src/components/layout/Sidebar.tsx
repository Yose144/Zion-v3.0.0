// ─── ZION Dashboard v2 — Sidebar (v2.9 aesthetic) ───────────────────────────
import React from 'react';
import {
  LayoutDashboard, FileText, Search, Terminal,
  BarChart2, Server, Cpu, Layers, Brain,
  Vote, Wallet, AlertTriangle, Settings,
  Shield, Zap, Globe, Rocket, Database,
  CalendarClock, Wrench, Network, ChevronLeft, ChevronRight, X,
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
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard, group: 'Core' },
  { id: 'logs',        label: 'Logs',         icon: FileText,        group: 'Core' },
  { id: 'explorer',   label: 'Explorer',     icon: Search,          group: 'Core' },
  { id: 'charts',     label: 'Charts',       icon: BarChart2,       group: 'Core' },
  // Infrastructure
  { id: 'services',   label: 'Services',     icon: Server,          group: 'Infra' },
  { id: 'topology',   label: 'Topology',     icon: Network,         group: 'Infra' },
  { id: 'controls',   label: 'Controls',     icon: Terminal,        group: 'Infra' },
  { id: 'l1',         label: 'L1 Consensus', icon: Cpu,             group: 'Layers' },
  { id: 'l2',         label: 'L2 Bridge',    icon: Zap,             group: 'Layers' },
  { id: 'l3',         label: 'L3 Warp',      icon: Rocket,          group: 'Layers' },
  { id: 'l4',         label: 'L4 Oasis',     icon: Globe,           group: 'Layers' },
  { id: 'l5',         label: 'L5 Space',     icon: Layers,          group: 'Layers' },
  { id: 'l6',         label: 'L6 Free',      icon: Shield,          group: 'Layers' },
  // AI
  { id: 'hiran',      label: 'Hiran AI',     icon: Brain,           group: 'AI' },
  // Finance & Gov
  { id: 'dao',        label: 'DAO',          icon: Vote,            group: 'Gov' },
  { id: 'wallets',    label: 'Wallets',      icon: Wallet,          group: 'Gov' },
  // Ops
  { id: 'alerts',     label: 'Alerts',       icon: AlertTriangle,   group: 'Ops' },
  { id: 'env',        label: 'Env Files',    icon: Wrench,          group: 'Ops' },
  { id: 'database',   label: 'Database',     icon: Database,        group: 'Ops' },
  { id: 'ops',        label: 'Ops',          icon: Settings,        group: 'Ops' },
  { id: 'launch-day', label: 'Launch Day',   icon: CalendarClock,   group: 'Ops' },
  { id: 'settings',   label: 'Settings',     icon: Settings,        group: 'Ops' },
];

const GROUPS = ['Core', 'Infra', 'Layers', 'AI', 'Gov', 'Ops'];

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ active, onSelect, mobileOpen = false, onMobileClose }: SidebarProps) {
  const unread = useUnreadAlerts();
  const collapsed = useSettingsStore(s => s.sidebarCollapsed);
  const update = useSettingsStore(s => s.update);
  const connected = useStatusStore(s => s.connected);

  const handleSelect = (id: TabId) => {
    onSelect(id);
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          flex flex-col shrink-0 h-full transition-all duration-200
          fixed md:relative inset-y-0 left-0 z-40
          ${collapsed ? 'w-14' : 'w-52'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background:
            'linear-gradient(180deg, rgba(7,10,20,0.92) 0%, rgba(5,7,16,0.88) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px) saturate(140%)',
        }}
      >
        {/* Header — ZION logo */}
        <div
          className="flex items-center justify-between px-3 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gradient glow tracking-widest">ZION</span>
              <span
                className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(255,215,0,0.1)',
                  border: '1px solid rgba(255,215,0,0.25)',
                  color: 'rgb(253 224 71)',
                }}
              >
                v2
              </span>
            </div>
          )}

          {/* Mobile close */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors md:hidden"
            >
              <X size={15} />
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => update({ sidebarCollapsed: !collapsed })}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors ml-auto hidden md:block"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Connection indicator */}
        {!collapsed && (
          <div className="px-3 py-2.5 flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'dot-healthy pulse-live' : 'dot-down'}`} />
            <span className="text-[11px] font-medium tracking-wide"
              style={{ color: connected ? 'rgb(134 239 172)' : 'rgb(248 113 113)' }}
            >
              {connected ? 'Live · WebSocket' : 'Polling mode'}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4">
          {GROUPS.map(group => {
            const items = NAV.filter(n => n.group === group);
            return (
              <div key={group}>
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                    {group}
                  </p>
                )}
                <ul className="space-y-0.5 px-1.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    const isAlerts = item.id === 'alerts';
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleSelect(item.id)}
                          title={collapsed ? item.label : undefined}
                          className={`
                            w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px]
                            transition-all duration-150 relative
                            ${collapsed ? 'justify-center' : ''}
                            ${isActive
                              ? 'font-semibold'
                              : 'text-slate-500 hover:text-slate-200 font-medium'
                            }
                          `}
                          style={isActive ? {
                            background:
                              'linear-gradient(135deg, rgba(147,51,234,0.18), rgba(6,182,212,0.08))',
                            border: '1px solid rgba(147,51,234,0.3)',
                            color: 'rgb(216 180 254)',
                            boxShadow: '0 0 18px rgba(147,51,234,0.15)',
                          } : {
                            background: 'transparent',
                            border: '1px solid transparent',
                          }}
                        >
                          <Icon
                            size={15}
                            className={`shrink-0 ${isActive ? 'text-violet-400' : ''}`}
                          />
                          {!collapsed && (
                            <span className="truncate flex-1 text-left">{item.label}</span>
                          )}
                          {isAlerts && unread > 0 && (
                            <span
                              className={`${collapsed ? 'absolute -top-1 -right-1' : ''} text-white text-[9px] rounded-full px-1.5 py-0.5 leading-none font-bold`}
                              style={{
                                background: 'linear-gradient(135deg, rgb(239,68,68), rgb(220,38,38))',
                                boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                              }}
                            >
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
          <div
            className="px-3 py-3 text-[10px] text-slate-600 font-medium tracking-wide"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-gradient-soft opacity-70">ZION 2.9.6</span>
            <span className="mx-1.5 opacity-30">·</span>
            <span className="opacity-50">Dashboard v2</span>
          </div>
        )}
      </aside>
    </>
  );
}
