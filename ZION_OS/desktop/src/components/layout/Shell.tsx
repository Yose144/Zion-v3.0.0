import {
  Gauge,
  Globe,
  GitBranch,
  Server,
  Users,
  Banknote,
  TrendingUp,
  TowerControl,
  Layers,
  Box,
  Zap,
  Leaf,
  Heart,
  Rocket,
  Brain,
  Bot,
  Briefcase,
  FlaskConical,
  Settings,
  HeartPulse,
  Bell,
  FileText,
  Database,
  Network,
  Search,
  Wallet,
  Landmark,
  ArrowRightLeft,
  Building2,
  LineChart,
  Calendar,
  BarChart3,
  FileCode,
  Bolt,
  TriangleAlert,
  Wrench,
  Radio,
  Sparkles,
  RefreshCw,
  Pause,
  Play,
  Moon,
  Sun,
  User,
  Rocket as RocketIcon,
  Wand2,
} from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useTheme } from '../../context/ThemeContext';
import { Kicker } from '../ui/Kicker';
import type { TabId } from '../../types';

interface ShellProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  children: React.ReactNode;
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString());

export default function Shell({ activeTab, onTabChange, children }: ShellProps) {
  const { status, alerts, lastError, autoRefresh, setAutoRefresh, refresh } = useDashboard();
  const { theme, toggle: toggleTheme } = useTheme();

  const topology = status?.topology === 'edge-primary' ? 'Edge-Primary' : 'Local-Dev';
  const connected = !lastError;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;

  const heroHeight = Math.max(
    status?.edge_node?.chain_height ?? 0,
    status?.node1?.chain_height ?? 0,
    status?.node2?.chain_height ?? 0,
    0,
  );
  const activeMiners =
    status?.pool_edge?.active_miners ?? status?.pool?.active_sessions ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-black pulse-gold relative"
            style={{
              background:
                'linear-gradient(135deg, rgb(255 215 0), rgb(147 51 234) 50%, rgb(6 182 212))',
            }}
          >
            Z
          </div>
          <div>
            <Kicker className="mb-1">Mainnet Launch · Command Center</Kicker>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none">
              <span className="text-gradient">ZION TerraNova</span>
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-700/50 text-purple-300">
            {topology}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              connected
                ? 'bg-emerald-700/50 text-emerald-300'
                : 'bg-red-700/50 text-red-300'
            }`}
          >
            {connected ? '● Connected' : '● Disconnected'}
          </span>
          {criticalAlerts > 0 && (
            <span className="px-3 py-1.5 bg-red-600 rounded-full text-xs font-bold animate-pulse">
              {criticalAlerts} alerts
            </span>
          )}
          <div className="zion-action-bar">
            <button
              onClick={toggleTheme}
              className="zion-action-btn"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button onClick={refresh} className="zion-action-btn" title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`zion-action-btn ${autoRefresh ? 'text-emerald-400' : ''}`}
              title="Auto refresh"
            >
              {autoRefresh ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button className="zion-action-btn" title="Settings">
              <Settings size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="zion-nav-shell mb-6">
        <div className="zion-nav-floor">
          <div className="zion-nav-brand hidden md:flex">
            <span className="logo-mark">Z</span> Command Center
          </div>

          <NavButton id="overview" icon={Gauge} label="Overview" active={activeTab} onClick={onTabChange} />

          <NavGroup label="Network" icon={Globe}>
            <NavButton id="nodes" icon={Network} label="Nodes" active={activeTab} onClick={onTabChange} />
            <NavButton id="topology" icon={GitBranch} label="Topology" active={activeTab} onClick={onTabChange} />
            <NavButton id="orchestrator" icon={Server} label="Orchestrator" active={activeTab} onClick={onTabChange} />
          </NavGroup>

          <NavGroup label="Pool" icon={Users}>
            <NavButton id="pool-miners" icon={Users} label="Miners" active={activeTab} onClick={onTabChange} />
            <NavButton id="payout" icon={Banknote} label="Payouts" active={activeTab} onClick={onTabChange} />
            <NavButton id="revenue" icon={TrendingUp} label="Revenue" active={activeTab} onClick={onTabChange} />
            <NavButton id="miner-live" icon={TowerControl} label="Live Miner" active={activeTab} onClick={onTabChange} />
          </NavGroup>

          <NavGroup label="Layers" icon={Layers}>
            <NavButton id="l1" icon={Box} label="L1 Consensus" active={activeTab} onClick={onTabChange} />
            <NavButton id="l2" icon={ArrowRightLeft} label="L2 Bridge / DAO" active={activeTab} onClick={onTabChange} />
            <NavButton id="l3" icon={Box} label="L3 Advanced" active={activeTab} onClick={onTabChange} />
            <NavButton id="warp" icon={Zap} label="WARP Bridge" active={activeTab} onClick={onTabChange} />
            <NavButton id="l4" icon={Leaf} label="L4 OASIS" active={activeTab} onClick={onTabChange} />
            <NavButton id="l5" icon={Heart} label="L5 Humanitarian" active={activeTab} onClick={onTabChange} />
            <NavButton id="l6" icon={Rocket} label="L6 Space" active={activeTab} onClick={onTabChange} />
          </NavGroup>

          <NavGroup label="AI" icon={Brain}>
            <NavButton id="hiran" icon={Brain} label="Hiran AI" active={activeTab} onClick={onTabChange} />
            <NavButton id="ai-agents" icon={Bot} label="AI Agents" active={activeTab} onClick={onTabChange} />
            <NavButton id="ncl-jobs" icon={Briefcase} label="NCL Jobs" active={activeTab} onClick={onTabChange} />
            <NavButton id="poc-lab" icon={FlaskConical} label="PoC Lab" active={activeTab} onClick={onTabChange} />
          </NavGroup>

          <NavGroup label="Ops" icon={Settings}>
            <NavButton id="services" icon={HeartPulse} label="Services Health" active={activeTab} onClick={onTabChange} />
            <NavButton id="alerts" icon={Bell} label="Alerts" active={activeTab} onClick={onTabChange} />
            <NavButton id="logs" icon={FileText} label="Logs" active={activeTab} onClick={onTabChange} />
            <NavButton id="backups" icon={Database} label="Backups" active={activeTab} onClick={onTabChange} />
            <NavButton id="fleet" icon={Network} label="Fleet" active={activeTab} onClick={onTabChange} />
            <NavButton id="settings" icon={Settings} label="Settings" active={activeTab} onClick={onTabChange} />
          </NavGroup>
        </div>

        <div className="zion-nav-floor">
          <QuickLink id="explorer" icon={Search} label="Explorer" active={activeTab} onClick={onTabChange} />
          <QuickLink id="wallets" icon={Wallet} label="Wallets" active={activeTab} onClick={onTabChange} />
          <QuickLink id="dao" icon={Landmark} label="DAO" active={activeTab} onClick={onTabChange} />
          <QuickLink id="bridge" icon={ArrowRightLeft} label="Bridge" active={activeTab} onClick={onTabChange} />
          <QuickLink id="bridge-validators" icon={User} label="Validators" active={activeTab} onClick={onTabChange} />
          <QuickLink id="warp-swap" icon={ArrowRightLeft} label="Swap" active={activeTab} onClick={onTabChange} />
          <QuickLink id="cex" icon={Building2} label="CEX" active={activeTab} onClick={onTabChange} />
          <QuickLink id="charts" icon={LineChart} label="Charts" active={activeTab} onClick={onTabChange} />
          <QuickLink id="events" icon={Calendar} label="Events" active={activeTab} onClick={onTabChange} />
          <QuickLink id="metrics" icon={BarChart3} label="Metrics" active={activeTab} onClick={onTabChange} />
          <QuickLink id="database" icon={Database} label="DB" active={activeTab} onClick={onTabChange} />
          <QuickLink id="env" icon={FileCode} label="Env" active={activeTab} onClick={onTabChange} />
          <QuickLink id="genesis" icon={Bolt} label="Genesis" active={activeTab} onClick={onTabChange} />
          <QuickLink id="blockers" icon={TriangleAlert} label="Blockers" active={activeTab} onClick={onTabChange} />
          <QuickLink id="ops" icon={Wrench} label="Ops" active={activeTab} onClick={onTabChange} />
          <QuickLink id="servers-setup" icon={Radio} label="Servers" active={activeTab} onClick={onTabChange} />
          <QuickLink id="launch-day" icon={RocketIcon} label="Launch" active={activeTab} onClick={onTabChange} />
          <QuickLink id="wizard" icon={Wand2} label="Wizard" active={activeTab} onClick={onTabChange} />
          <QuickLink id="agent" icon={User} label="Agent" active={activeTab} onClick={onTabChange} />
        </div>
      </nav>

      {/* Hero */}
      <section className="zion-hero-grid mb-6">
        <HeroCard
          icon="🌐"
          title="Network Status"
          value={connected ? 'Live' : 'Down'}
          sub={`v3.0.5 · ${fmt(status?.edge_node?.known_peers ?? status?.node1?.known_peers ?? 0)} peers`}
          rc="6 182 212"
        />
        <HeroCard
          icon="⛏"
          title="Pool"
          value={fmt(activeMiners)}
          sub="active sessions"
          rc="147 51 234"
        />
        <HeroCard
          icon="🔗"
          title="Latest Block"
          value={fmt(heroHeight)}
          sub="chain height"
          rc="251 191 36"
        />
        <HeroCard
          icon="⚡"
          title="Active Miners"
          value={fmt(activeMiners)}
          sub="connected workers"
          rc="16 185 129"
        />
      </section>

      <main className="dashboard-main">{children}</main>
    </div>
  );
}

function HeroCard({
  icon,
  title,
  value,
  sub,
  rc,
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  rc: string;
}) {
  return (
    <div className="zion-hero-card" style={{ '--rc': rc } as React.CSSProperties}>
      <div className="zhc-icon">{icon}</div>
      <div className="zhc-title">{title}</div>
      <div className="zhc-value">{value}</div>
      <div className="zhc-sub">{sub}</div>
    </div>
  );
}

function NavButton({
  id,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  id: TabId;
  icon: React.ElementType;
  label: string;
  active: TabId;
  onClick: (id: TabId) => void;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`tab-btn flex items-center gap-2 ${isActive ? 'tab-active' : ''}`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

function NavGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="zion-nav-group">
      <button className="tab-btn flex items-center gap-2">
        <Icon size={14} />
        <span>{label}</span>
        <span className="opacity-60 text-[10px]">▾</span>
      </button>
      <div className="zion-nav-dropdown">{children}</div>
    </div>
  );
}

function QuickLink({
  id,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  id: TabId;
  icon: React.ElementType;
  label: string;
  active: TabId;
  onClick: (id: TabId) => void;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`zion-quick-link ${isActive ? 'zql-active' : ''}`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
