'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Blocks,
  Cpu,
  Gauge,
  LayoutDashboard,
  LineChart,
  Map,
  Pickaxe,
  ShieldCheck,
  SignalHigh,
  TrendingUp,
  TreeDeciduous,
  Zap
} from 'lucide-react';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_VERSION, SITE_VERSION, SITE_POOL_PRIMARY } from '@/lib/site';

interface DashboardClientProps {
  stats: any;
  health: any;
  blocks: any[];
  poolStats: any;
}

const getMissionMetrics = (cs: boolean) => [
  {
    label: 'Mainnet Status',
    value: 'ACTIVE',
    description: 'Edge server Rust infrastructure operational',
    icon: Zap
  },
  {
    label: cs ? 'Zdravi poolu' : 'Pool Health',
    value: '100%',
    description: 'Edge server pool + Edge server consensus node',
    icon: ShieldCheck
  },
  {
    label: cs ? 'Verze' : 'Version',
    value: SITE_VERSION,
    description: cs ? `Verejna linie ${SITE_RELEASE_LABEL} · runtime v${SITE_RUNTIME_VERSION.replace('v', '')}` : `Public line ${SITE_RELEASE_LABEL} · runtime v${SITE_RUNTIME_VERSION.replace('v', '')}`,
    icon: Gauge
  },
  {
    label: cs ? 'Launch gate' : 'Launch Gate',
    value: 'NO-GO',
    description: cs ? 'Rozhodnuti o verejnem launchi az po closure evidence' : 'Public launch decision only after closure evidence',
    icon: SignalHigh
  }
];

const getRoadmapSlices = (cs: boolean) => [
  {
    title: 'Mainnet · 2026',
    bullets: ['Native Rust blockchain + pool infrastructure', 'Edge server topology: Edge server consensus + Edge server pool/relay', 'Real mining rewards · 5% humanitarian · 5% Issobella fund']
  },
  {
    title: cs ? 'Q1-Q2 2026 · Zpevneni' : 'Q1-Q2 2026 · Hardening',
    bullets: cs ? ['Bezpecnostni audit (Trail of Bits)', 'Nativni penezenka + podpora Ledger/Trezor', 'Zapojeni komunitnich tezebnich poolu'] : ['Security audit (Trail of Bits)', 'Native wallet + Ledger/Trezor support', 'Community mining pools onboarding']
  },
  {
    title: cs ? 'Launch window · konec 2026 (gated)' : 'Launch window · end 2026 (gated)',
    bullets: cs ? ['Verejny launch jen po closure reportu', 'Mosty a listing readiness az po GO rozhodnuti', 'Governance aktivace az po schvalenem launch baliku'] : ['Public launch only after closure reporting', 'Bridge and listing readiness only after a GO decision', 'Governance activation only after the approved launch package']
  }
];

const GRAFANA_BASE_URL = (process.env.NEXT_PUBLIC_GRAFANA_BASE_URL || 'https://zionterranova.com/grafana').replace(/\/$/, '');
const PROMETHEUS_BASE_URL = (process.env.NEXT_PUBLIC_PROMETHEUS_BASE_URL || 'https://zionterranova.com/prometheus').replace(/\/$/, '');

const getGrafanaDashboards = (cs: boolean) => [
  {
    title: cs ? 'DAO Strom zivota' : 'DAO Tree of Life',
    description: cs ? 'Ledger stromu zivota pro DAO guardiany, governance kruhy a dohled nad treasury' : 'Tree-of-life ledger for DAO guardians, governance circles, and treasury oversight',
    href: '/dashboard/dao-tree',
    icon: TreeDeciduous,
    accent: 'text-emerald-300',
    pill: cs ? 'DAO prototyp' : 'DAO prototype'
  },
  {
    title: cs ? 'Dashboard pool metrik' : 'Pool Metrics Dashboard',
    description: cs ? 'Hashrate · Workeri · Shares · Rychlost nalezu bloku' : 'Hashrate · Workers · Shares · Block discovery rate',
    href: '/dashboard/pool-metrics',
    icon: BarChart3,
    accent: 'text-zion-cyan',
    pill: cs ? 'Auto-refresh 10 s' : 'Auto-refresh 10s'
  },
  {
    title: cs ? 'Plny systemovy dashboard' : 'Full System Dashboard',
    description: cs ? 'CPU/RAM · RPC latence · API zdravi · uptime' : 'CPU/RAM · RPC latency · API health · uptime',
    href: '/dashboard/system-metrics',
    icon: LineChart,
    accent: 'text-zion-purple',
    pill: cs ? 'Telemetrie celeho stacku' : 'Stack-wide telemetry'
  },
  {
    title: cs ? 'Pokrocily pool dashboard (Prometheus)' : 'Advanced Pool Dashboard (Prometheus)',
    description: cs ? 'Raw PromQL explorer, ad-hoc dotazy a vlastni alerty' : 'Raw PromQL explorer, ad-hoc queries & custom alerts',
    href: '/dashboard/advanced-pool',
    icon: Activity,
    accent: 'text-zion-gold',
    pill: 'Prometheus /graph'
  }
];

type TabId = 'overview' | 'health' | 'blockchain' | 'pool' | 'roadmap';

const TABS: { id: TabId; icon: typeof LayoutDashboard; labelCs: string; labelEn: string }[] = [
  { id: 'overview', icon: LayoutDashboard, labelCs: 'Přehled', labelEn: 'Overview' },
  { id: 'health', icon: Activity, labelCs: 'Zdraví systému', labelEn: 'System Health' },
  { id: 'blockchain', icon: Blocks, labelCs: 'Blockchain', labelEn: 'Blockchain' },
  { id: 'pool', icon: Pickaxe, labelCs: 'Těžba & Pool', labelEn: 'Mining & Pool' },
  { id: 'roadmap', icon: Map, labelCs: 'Plán', labelEn: 'Roadmap' },
];

export default function DashboardClient({ stats, health, blocks, poolStats }: DashboardClientProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const missionMetrics = getMissionMetrics(cs);
  const roadmapSlices = getRoadmapSlices(cs);
  const grafanaDashboards = getGrafanaDashboards(cs);
  const computedUptime = health?.uptime ? `${Math.floor(health.uptime / 3600)}h` : '—';
  const totalSupply = stats?.total_supply ?? stats?.max_supply;

  // Format hashrate helper
  const formatHashrate = (hashrate: number) => {
    if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
    if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
    if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} kH/s`;
    return `${hashrate.toFixed(0)} H/s`;
  };

  return (
    <div className="zion-shell min-h-screen pt-32 pb-20">
      <div className="zion-container max-w-7xl space-y-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-card p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Mission control</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">Live systems dashboard</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                Real-time telemetry from ZION {SITE_RELEASE_LABEL}: health checks, node status, blockchain vitals, and mining pool metrics across the Edge server topology.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {missionMetrics.map((metric) => (
                <div key={metric.label} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-5">
                  <metric.icon className="h-6 w-6 text-zion-gold" />
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gray-400">{metric.label}</p>
                  <p className="text-3xl font-semibold text-white">{metric.value}</p>
                  <p className="text-sm text-gray-300">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="sticky top-20 z-30 -mx-2 px-2 py-3 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold shadow-[0_4px_20px_rgba(147,51,234,0.2)]'
                      : 'border-white/8 bg-white/5 text-gray-400 hover:border-white/18 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  {cs ? tab.labelCs : tab.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ OVERVIEW ═══════ */}
        <div className="grid gap-6 lg:grid-cols-2">
          {(activeTab === 'overview' || activeTab === 'health') && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] bg-black/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className={`w-6 h-6 ${
                  health?.status === 'ok' || health?.status === 'healthy'
                    ? 'text-emerald-400'
                    : health?.status === 'degraded'
                    ? 'text-yellow-400 animate-pulse'
                    : 'text-red-400'
                }`} />
                <div>
                  <h2 className="text-2xl font-semibold text-white">System health</h2>
                  <p className="text-sm text-gray-400">RPC · pool · orchestrator · observability</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/admin" className="text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-white inline-flex items-center gap-1">
                  Admin
                  <ArrowRight className="h-3 w-3" />
                </Link>
                  <Link href="/health" target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1">
                  View API
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Status</p>
                <p className={`mt-2 text-2xl font-semibold ${
                  health?.status === 'ok' || health?.status === 'operational' || health?.status === 'healthy' 
                    ? 'text-emerald-400' 
                    : health?.status === 'degraded' 
                    ? 'text-yellow-400' 
                    : 'text-gray-400'
                }`}>
                  {health?.status === 'ok' || health?.status === 'operational' ? '✓ Operational' : 
                   health?.status === 'healthy' ? '✓ Healthy' :
                   health?.status === 'degraded' ? '⚠ Degraded' : 
                   '○ Checking...'}
                </p>
              </div>
              <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Version</p>
                <p className="mt-2 text-2xl font-semibold text-white">{health?.version || SITE_VERSION}</p>
              </div>
              <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Uptime</p>
                <p className="mt-2 text-2xl font-semibold text-white">{computedUptime}</p>
              </div>
              <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Services</p>
                <div className="mt-2 space-y-1 text-sm text-gray-300">
                  <p>
                    <span className={health?.dependencies?.rpc_node?.healthy ? 'text-emerald-400' : 'text-gray-600'}>
                      {health?.dependencies?.rpc_node?.healthy ? '●' : '○'}
                    </span>{' '}
                    RPC Node
                  </p>
                  <p>
                    <span className={health?.dependencies?.mining_pool?.healthy ? 'text-emerald-400' : 'text-gray-600'}>
                      {health?.dependencies?.mining_pool?.healthy ? '●' : '○'}
                    </span>{' '}
                    Mining Pool
                  </p>
                  <p>
                    <span className={health?.dependencies?.prometheus?.healthy ? 'text-emerald-400' : 'text-gray-600'}>
                      {health?.dependencies?.prometheus?.healthy ? '●' : '○'}
                    </span>{' '}
                    Prometheus
                  </p>
                  <p>
                    <span className={health?.dependencies?.grafana?.healthy ? 'text-emerald-400' : 'text-gray-600'}>
                      {health?.dependencies?.grafana?.healthy ? '●' : '○'}
                    </span>{' '}
                    Grafana
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
          )}

          {(activeTab === 'overview' || activeTab === 'blockchain') && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] bg-black/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-zion-gold" />
              <h2 className="text-2xl font-semibold text-white">Blockchain vitals</h2>
              {!stats && <span className="text-xs text-yellow-400">API offline</span>}
            </div>
            {stats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Blocks" value={stats.total_blocks ? stats.total_blocks.toLocaleString() : '—'} />
                  <MetricCard label="Total supply" value={totalSupply ? `${(totalSupply / 1e9).toFixed(2)}B` : '—'} />
                  <MetricCard label="Transactions" value={stats.total_transactions ? stats.total_transactions.toLocaleString() : '—'} />
                  <MetricCard label="Difficulty" value={stats.difficulty || '—'} />
                </div>
                {stats.latest_block && (
                  <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Posledni blok' : 'Latest block'}</p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>{cs ? 'Vyska' : 'Height'}</span>
                        <span className="font-mono">{stats.latest_block.height}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Hash</span>
                        <span className="font-mono text-xs">
                          {stats.latest_block.hash
                            ? `${stats.latest_block.hash.substring(0, 18)}...`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>{cs ? 'Cas' : 'Timestamp'}</span>
                        <span>{stats.latest_block?.timestamp ? new Date(stats.latest_block.timestamp * 1000).toLocaleString(cs ? 'cs-CZ' : 'en-US') : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-12">{cs ? 'Cekam na blockchain metriky…' : 'Awaiting blockchain metrics…'}</div>
            )}
          </motion.div>
          )}
        </div>

        {(activeTab === 'overview' || activeTab === 'pool') && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] bg-black/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Mining pool status</h2>
                <p className="text-sm text-gray-400">Live metrics from stratum+tcp://{SITE_POOL_PRIMARY}</p>
              </div>
            </div>
            <Link href="/pool/stats" target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1">
              {cs ? 'Statistiky poolu' : 'Pool Stats'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {poolStats ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  label={cs ? 'Aktivni mineri' : 'Active miners'} 
                  value={poolStats.active_miners?.toString() || '0'} 
                />
                <MetricCard 
                  label={cs ? 'Hashrate poolu' : 'Pool hashrate'} 
                  value={formatHashrate(poolStats.pool_hashrate || 0)} 
                />
                <MetricCard 
                  label={cs ? 'Nalezene bloky' : 'Blocks found'} 
                  value={poolStats.blocks_found ? poolStats.blocks_found.toLocaleString() : '0'} 
                />
                <MetricCard 
                  label={cs ? 'Celkove vyplaceno' : 'Total paid'} 
                  value={poolStats.total_paid ? `${(poolStats.total_paid / 1e9).toFixed(2)}B` : '0'} 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Konfigurace poolu' : 'Pool configuration'}</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>{cs ? 'Poplatek poolu:' : 'Pool fee:'}</span>
                      <span className="font-mono">{poolStats?.pool_fee ?? '—'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{cs ? 'Min vyplata:' : 'Min payout:'}</span>
                      <span className="font-mono">{poolStats?.min_payout ?? '—'} ZION</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{cs ? 'Interval vyplaty:' : 'Payout interval:'}</span>
                      <span className="font-mono">{poolStats?.payment_interval ?? '—'}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{cs ? 'Celkem mineru:' : 'Total miners:'}</span>
                      <span className="font-mono">{poolStats?.total_miners ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Sitove statistiky' : 'Network stats'}</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>{cs ? 'Sitovy hashrate:' : 'Network hashrate:'}</span>
                      <span className="font-mono">{formatHashrate(poolStats?.network_hashrate ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{cs ? 'Obtiznost:' : 'Difficulty:'}</span>
                      <span className="font-mono">{poolStats?.network_difficulty ? poolStats.network_difficulty.toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{cs ? 'Cekajici vyplaty:' : 'Pending payouts:'}</span>
                      <span className="font-mono">{(poolStats?.pending_payouts ?? 0).toFixed(2)} ZION</span>
                    </div>
                    {poolStats?.last_block_time && (
                      <div className="flex justify-between">
                        <span>{cs ? 'Posledni blok:' : 'Last block:'}</span>
                        <span className="text-xs">{new Date(poolStats.last_block_time * 1000).toLocaleTimeString(cs ? 'cs-CZ' : 'en-US')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-12">{cs ? 'Metriky poolu nejsou dostupne' : 'Pool metrics unavailable'}</div>
          )}
        </motion.div>
        )}

        {(activeTab === 'overview' || activeTab === 'pool') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ '--rc': '99, 102, 241' } as React.CSSProperties}
          className="zion-rainbow-card rounded-[28px] bg-black/50 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-zion-cyan" />
              <div>
                <h2 className="text-2xl font-semibold text-white">{cs ? 'Zive Grafana metriky' : 'Live Grafana Metrics'}</h2>
                <p className="text-sm text-gray-400">{cs ? 'Dashboardy v realnem case vlozene primo do ZION Mission Control' : 'Real-time dashboards embedded directly on ZION Mission Control'}</p>
              </div>
            </div>
            <Link
              href={`${GRAFANA_BASE_URL}/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1"
            >
              {cs ? 'Otevrit Grafanu' : 'Open Grafana'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {grafanaDashboards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group zion-rainbow-sub p-5 transition-all"
                style={{ '--rc': '99, 102, 241' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <card.icon className={`w-6 h-6 ${card.accent}`} />
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{card.pill}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-zion-cyan transition-colors">{card.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{card.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-zion-cyan">
                  {cs ? 'Zobrazit ziva data' : 'View live data'}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 zion-section p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">{cs ? 'Dostupne metriky' : 'Available Metrics'}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-zion-purple font-semibold">{cs ? 'Pool metriky' : 'Pool Metrics'}</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {cs ? 'Aktivni mineri' : 'Active miners'}</li>
                  <li>• {cs ? 'Hashrate poolu' : 'Pool hashrate'}</li>
                  <li>• Shares accepted/rejected</li>
                  <li>• {cs ? 'Nalezene bloky' : 'Blocks found'}</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-gold font-semibold">Blockchain</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {cs ? 'Vyska bloku' : 'Block height'}</li>
                  <li>• {cs ? 'Rychlost transakci' : 'Transaction rate'}</li>
                  <li>• {cs ? 'Pripojeni peeri' : 'Connected peers'}</li>
                  <li>• {cs ? 'Velikost mempoolu' : 'Mempool size'}</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-cyan font-semibold">{cs ? 'Vykon API' : 'API Performance'}</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• Request rate</li>
                  <li>• {cs ? 'Latence (p95/p99)' : 'Latency (p95/p99)'}</li>
                  <li>• {cs ? 'Chybovost' : 'Error rate'}</li>
                  <li>• {cs ? 'Aktivni spojeni' : 'Active connections'}</li>
                </ul>
              </div>
              <div>
                <p className="text-emerald-400 font-semibold">{cs ? 'Systemove zdroje' : 'System Resources'}</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {cs ? 'Vytizeni CPU' : 'CPU usage'}</li>
                  <li>• {cs ? 'Vytizeni pameti' : 'Memory usage'}</li>
                  <li>• {cs ? 'Diskove I/O' : 'Disk I/O'}</li>
                  <li>• {cs ? 'Sitovy provoz' : 'Network traffic'}</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {(activeTab === 'overview' || activeTab === 'blockchain') && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-zion-gold" />
            <h2 className="text-2xl font-semibold text-white">{cs ? 'Posledni bloky' : 'Recent blocks'}</h2>
          </div>
          {blocks && blocks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {blocks.map((block: any) => (
                <div key={block.hash} className="zion-tile p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">#{block.height}</p>
                      <p className="font-mono text-xs text-zion-cyan">{block.hash?.substring(0, 16)}...</p>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(block.timestamp * 1000).toLocaleTimeString(cs ? 'cs-CZ' : 'en-US')}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-400">
                    <span>{cs ? 'Tx' : 'Txs'} {block.transactions || 0}</span>
                    {block.consciousness_level && <span>{block.consciousness_level}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">{cs ? 'Z API nebyl detekovan zadny block feed.' : 'No block feed detected from API.'}</div>
          )}
        </motion.div>
        )}

        {(activeTab === 'overview' || activeTab === 'roadmap') && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '99, 102, 241' } as React.CSSProperties} className="zion-rainbow-card rounded-4xl border-zion-gold/30 bg-linear-to-r from-zion-purple/20 via-zion-gold/10 to-zion-cyan/20 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-200">{cs ? 'Co dal' : 'What\'s next'}</p>
              <h2 className="text-3xl font-semibold text-white">{cs ? 'Operacni roadmapa' : 'Operational roadmap'}</h2>
              <p className="text-sm text-gray-100 max-w-xl mt-2">{cs ? 'Prevzato z aktualni verejne launch cesty a rehearsal readiness materialu.' : 'Pulled from the current public launch path and rehearsal-readiness material.'}</p>
            </div>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-black/60 px-5 py-2 text-sm font-semibold text-white">
              {cs ? 'Otevrit roadmapu' : 'Open roadmap'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {roadmapSlices.map((slice) => (
              <div key={slice.title} className="zion-tile p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Sprint</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{slice.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-200">
                  {slice.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <ArrowRight className="h-3 w-3 text-zion-gold mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="zion-tile p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
