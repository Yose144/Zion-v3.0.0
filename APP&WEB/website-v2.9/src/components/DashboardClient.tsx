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

const DashboardCopy = {
  poolHealth: { cs: `Zdravi poolu`, en: `Pool Health` },
  version: { cs: `Verze`, en: `Version` },
  launchGate: { cs: `Launch gate`, en: `Launch Gate` },
  publicLaunchDecisionOnlyAfterC: { cs: `Rozhodnuti o verejnem launchi az po closure evidence`, en: `Public launch decision only after closure evidence` },
  q1Q22026Hardening: { cs: `Q1-Q2 2026 · Zpevneni`, en: `Q1-Q2 2026 · Hardening` },
  launchWindowEnd2026Gated: { cs: `Launch window · konec 2026 (gated)`, en: `Launch window · end 2026 (gated)` },
  daoTreeOfLife: { cs: `DAO Strom zivota`, en: `DAO Tree of Life` },
  treeOfLifeLedgerForDaoGuardian: { cs: `Ledger stromu zivota pro DAO guardiany, governance kruhy a dohled nad treasury`, en: `Tree-of-life ledger for DAO guardians, governance circles, and treasury oversight` },
  daoPrototype: { cs: `DAO prototyp`, en: `DAO prototype` },
  poolMetricsDashboard: { cs: `Dashboard pool metrik`, en: `Pool Metrics Dashboard` },
  hashrateWorkersSharesBlockDisc: { cs: `Hashrate · Workeri · Shares · Rychlost nalezu bloku`, en: `Hashrate · Workers · Shares · Block discovery rate` },
  autoRefresh10s: { cs: `Auto-refresh 10 s`, en: `Auto-refresh 10s` },
  fullSystemDashboard: { cs: `Plny systemovy dashboard`, en: `Full System Dashboard` },
  cpuRamRpcLatencyApiHealthUptim: { cs: `CPU/RAM · RPC latence · API zdravi · uptime`, en: `CPU/RAM · RPC latency · API health · uptime` },
  stackWideTelemetry: { cs: `Telemetrie celeho stacku`, en: `Stack-wide telemetry` },
  advancedPoolDashboardPrometheu: { cs: `Pokrocily pool dashboard (Prometheus)`, en: `Advanced Pool Dashboard (Prometheus)` },
  rawPromqlExplorerAdHocQueriesC: { cs: `Raw PromQL explorer, ad-hoc dotazy a vlastni alerty`, en: `Raw PromQL explorer, ad-hoc queries & custom alerts` },
  latestBlock: { cs: `Posledni blok`, en: `Latest block` },
  height: { cs: `Vyska`, en: `Height` },
  timestamp: { cs: `Cas`, en: `Timestamp` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
  awaitingBlockchainMetrics: { cs: `Cekam na blockchain metriky…`, en: `Awaiting blockchain metrics…` },
  poolStats: { cs: `Statistiky poolu`, en: `Pool Stats` },
  activeMiners: { cs: `Aktivni mineri`, en: `Active miners` },
  poolHashrate: { cs: `Hashrate poolu`, en: `Pool hashrate` },
  blocksFound: { cs: `Nalezene bloky`, en: `Blocks found` },
  totalPaid: { cs: `Celkove vyplaceno`, en: `Total paid` },
  poolConfiguration: { cs: `Konfigurace poolu`, en: `Pool configuration` },
  poolFee: { cs: `Poplatek poolu:`, en: `Pool fee:` },
  minPayout: { cs: `Min vyplata:`, en: `Min payout:` },
  payoutInterval: { cs: `Interval vyplaty:`, en: `Payout interval:` },
  totalMiners: { cs: `Celkem mineru:`, en: `Total miners:` },
  networkStats: { cs: `Sitove statistiky`, en: `Network stats` },
  networkHashrate: { cs: `Sitovy hashrate:`, en: `Network hashrate:` },
  difficulty: { cs: `Obtiznost:`, en: `Difficulty:` },
  pendingPayouts: { cs: `Cekajici vyplaty:`, en: `Pending payouts:` },
  lastBlock: { cs: `Posledni blok:`, en: `Last block:` },
  poolMetricsUnavailable: { cs: `Metriky poolu nejsou dostupne`, en: `Pool metrics unavailable` },
  liveGrafanaMetrics: { cs: `Zive Grafana metriky`, en: `Live Grafana Metrics` },
  realTimeDashboardsEmbeddedDire: { cs: `Dashboardy v realnem case vlozene primo do ZION Mission Control`, en: `Real-time dashboards embedded directly on ZION Mission Control` },
  openGrafana: { cs: `Otevrit Grafanu`, en: `Open Grafana` },
  viewLiveData: { cs: `Zobrazit ziva data`, en: `View live data` },
  availableMetrics: { cs: `Dostupne metriky`, en: `Available Metrics` },
  poolMetrics: { cs: `Pool metriky`, en: `Pool Metrics` },
  blockHeight: { cs: `Vyska bloku`, en: `Block height` },
  transactionRate: { cs: `Rychlost transakci`, en: `Transaction rate` },
  connectedPeers: { cs: `Pripojeni peeri`, en: `Connected peers` },
  mempoolSize: { cs: `Velikost mempoolu`, en: `Mempool size` },
  apiPerformance: { cs: `Vykon API`, en: `API Performance` },
  latencyP95P99: { cs: `Latence (p95/p99)`, en: `Latency (p95/p99)` },
  errorRate: { cs: `Chybovost`, en: `Error rate` },
  activeConnections: { cs: `Aktivni spojeni`, en: `Active connections` },
  systemResources: { cs: `Systemove zdroje`, en: `System Resources` },
  cpuUsage: { cs: `Vytizeni CPU`, en: `CPU usage` },
  memoryUsage: { cs: `Vytizeni pameti`, en: `Memory usage` },
  diskIO: { cs: `Diskove I/O`, en: `Disk I/O` },
  networkTraffic: { cs: `Sitovy provoz`, en: `Network traffic` },
  recentBlocks: { cs: `Posledni bloky`, en: `Recent blocks` },
  txs: { cs: `Tx`, en: `Txs` },
  noBlockFeedDetectedFromApi: { cs: `Z API nebyl detekovan zadny block feed.`, en: `No block feed detected from API.` },
  whatSNext: { cs: `Co dal`, en: `What\'s next` },
  operationalRoadmap: { cs: `Operacni roadmapa`, en: `Operational roadmap` },
  pulledFromTheCurrentPublicLaun: { cs: `Prevzato z aktualni verejne launch cesty a rehearsal readiness materialu.`, en: `Pulled from the current public launch path and rehearsal-readiness material.` },
  openRoadmap: { cs: `Otevrit roadmapu`, en: `Open roadmap` },
};

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
    label: DashboardCopy.poolHealth[cs ? 'cs' : 'en'],
    value: '100%',
    description: 'Edge server pool + Edge server consensus node',
    icon: ShieldCheck
  },
  {
    label: DashboardCopy.version[cs ? 'cs' : 'en'],
    value: SITE_VERSION,
    description: cs ? `Verejna linie ${SITE_RELEASE_LABEL} · runtime v${SITE_RUNTIME_VERSION.replace('v', '')}` : `Public line ${SITE_RELEASE_LABEL} · runtime v${SITE_RUNTIME_VERSION.replace('v', '')}`,
    icon: Gauge
  },
  {
    label: DashboardCopy.launchGate[cs ? 'cs' : 'en'],
    value: 'NO-GO',
    description: DashboardCopy.publicLaunchDecisionOnlyAfterC[cs ? 'cs' : 'en'],
    icon: SignalHigh
  }
];

const getRoadmapSlices = (cs: boolean) => [
  {
    title: 'Mainnet · 2026',
    bullets: ['Native Rust blockchain + pool infrastructure', 'Edge server topology: Edge server consensus + Edge server pool/relay', 'Real mining rewards · 5% humanitarian · 5% Issobella fund']
  },
  {
    title: DashboardCopy.q1Q22026Hardening[cs ? 'cs' : 'en'],
    bullets: cs ? ['Bezpecnostni audit (Trail of Bits)', 'Nativni penezenka + podpora Ledger/Trezor', 'Zapojeni komunitnich tezebnich poolu'] : ['Security audit (Trail of Bits)', 'Native wallet + Ledger/Trezor support', 'Community mining pools onboarding']
  },
  {
    title: DashboardCopy.launchWindowEnd2026Gated[cs ? 'cs' : 'en'],
    bullets: cs ? ['Verejny launch jen po closure reportu', 'Mosty a listing readiness az po GO rozhodnuti', 'Governance aktivace az po schvalenem launch baliku'] : ['Public launch only after closure reporting', 'Bridge and listing readiness only after a GO decision', 'Governance activation only after the approved launch package']
  }
];

const GRAFANA_BASE_URL = (process.env.NEXT_PUBLIC_GRAFANA_BASE_URL || 'https://zionterranova.com/grafana').replace(/\/$/, '');
const PROMETHEUS_BASE_URL = (process.env.NEXT_PUBLIC_PROMETHEUS_BASE_URL || 'https://zionterranova.com/prometheus').replace(/\/$/, '');

const getGrafanaDashboards = (cs: boolean) => [
  {
    title: DashboardCopy.daoTreeOfLife[cs ? 'cs' : 'en'],
    description: DashboardCopy.treeOfLifeLedgerForDaoGuardian[cs ? 'cs' : 'en'],
    href: '/dashboard/dao-tree',
    icon: TreeDeciduous,
    accent: 'text-zion-cyan-300',
    pill: DashboardCopy.daoPrototype[cs ? 'cs' : 'en']
  },
  {
    title: DashboardCopy.poolMetricsDashboard[cs ? 'cs' : 'en'],
    description: DashboardCopy.hashrateWorkersSharesBlockDisc[cs ? 'cs' : 'en'],
    href: '/dashboard/pool-metrics',
    icon: BarChart3,
    accent: 'text-zion-cyan',
    pill: DashboardCopy.autoRefresh10s[cs ? 'cs' : 'en']
  },
  {
    title: DashboardCopy.fullSystemDashboard[cs ? 'cs' : 'en'],
    description: DashboardCopy.cpuRamRpcLatencyApiHealthUptim[cs ? 'cs' : 'en'],
    href: '/dashboard/system-metrics',
    icon: LineChart,
    accent: 'text-zion-purple',
    pill: DashboardCopy.stackWideTelemetry[cs ? 'cs' : 'en']
  },
  {
    title: DashboardCopy.advancedPoolDashboardPrometheu[cs ? 'cs' : 'en'],
    description: DashboardCopy.rawPromqlExplorerAdHocQueriesC[cs ? 'cs' : 'en'],
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-card p-10 backdrop-blur-xl">
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
                <div key={metric.label} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-5">
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
                      ? 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold shadow-[0_4px_20px_rgba(228,30,43,0.2)]'
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
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] bg-black/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className={`w-6 h-6 ${
                  health?.status === 'ok' || health?.status === 'healthy'
                    ? 'text-zion-cyan-400'
                    : health?.status === 'degraded'
                    ? 'text-zion-gold-400 animate-pulse'
                    : 'text-zion-purple-400'
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
              <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Status</p>
                <p className={`mt-2 text-2xl font-semibold ${
                  health?.status === 'ok' || health?.status === 'operational' || health?.status === 'healthy' 
                    ? 'text-zion-cyan-400' 
                    : health?.status === 'degraded' 
                    ? 'text-zion-gold-400' 
                    : 'text-gray-400'
                }`}>
                  {health?.status === 'ok' || health?.status === 'operational' ? '✓ Operational' : 
                   health?.status === 'healthy' ? '✓ Healthy' :
                   health?.status === 'degraded' ? '⚠ Degraded' : 
                   '○ Checking...'}
                </p>
              </div>
              <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Version</p>
                <p className="mt-2 text-2xl font-semibold text-white">{health?.version || SITE_VERSION}</p>
              </div>
              <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Uptime</p>
                <p className="mt-2 text-2xl font-semibold text-white">{computedUptime}</p>
              </div>
              <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Services</p>
                <div className="mt-2 space-y-1 text-sm text-gray-300">
                  <p>
                    <span className={health?.dependencies?.rpc_node?.healthy ? 'text-zion-cyan-400' : 'text-gray-600'}>
                      {health?.dependencies?.rpc_node?.healthy ? '●' : '○'}
                    </span>{' '}
                    RPC Node
                  </p>
                  <p>
                    <span className={health?.dependencies?.mining_pool?.healthy ? 'text-zion-cyan-400' : 'text-gray-600'}>
                      {health?.dependencies?.mining_pool?.healthy ? '●' : '○'}
                    </span>{' '}
                    Mining Pool
                  </p>
                  <p>
                    <span className={health?.dependencies?.prometheus?.healthy ? 'text-zion-cyan-400' : 'text-gray-600'}>
                      {health?.dependencies?.prometheus?.healthy ? '●' : '○'}
                    </span>{' '}
                    Prometheus
                  </p>
                  <p>
                    <span className={health?.dependencies?.grafana?.healthy ? 'text-zion-cyan-400' : 'text-gray-600'}>
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
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] bg-black/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-zion-gold" />
              <h2 className="text-2xl font-semibold text-white">Blockchain vitals</h2>
              {!stats && <span className="text-xs text-zion-gold-400">API offline</span>}
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
                  <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{DashboardCopy.latestBlock[cs ? 'cs' : 'en']}</p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>{DashboardCopy.height[cs ? 'cs' : 'en']}</span>
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
                        <span>{DashboardCopy.timestamp[cs ? 'cs' : 'en']}</span>
                        <span>{stats.latest_block?.timestamp ? new Date(stats.latest_block.timestamp * 1000).toLocaleString(DashboardCopy.enUs[cs ? 'cs' : 'en']) : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-12">{DashboardCopy.awaitingBlockchainMetrics[cs ? 'cs' : 'en']}</div>
            )}
          </motion.div>
          )}
        </div>

        {(activeTab === 'overview' || activeTab === 'pool') && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] bg-black/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Mining pool status</h2>
                <p className="text-sm text-gray-400">Live metrics from stratum+tcp://{SITE_POOL_PRIMARY}</p>
              </div>
            </div>
            <Link href="/pool/stats" target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1">
              {DashboardCopy.poolStats[cs ? 'cs' : 'en']}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {poolStats ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  label={DashboardCopy.activeMiners[cs ? 'cs' : 'en']} 
                  value={poolStats.active_miners?.toString() || '0'} 
                />
                <MetricCard 
                  label={DashboardCopy.poolHashrate[cs ? 'cs' : 'en']} 
                  value={formatHashrate(poolStats.pool_hashrate || 0)} 
                />
                <MetricCard 
                  label={DashboardCopy.blocksFound[cs ? 'cs' : 'en']} 
                  value={poolStats.blocks_found ? poolStats.blocks_found.toLocaleString() : '0'} 
                />
                <MetricCard 
                  label={DashboardCopy.totalPaid[cs ? 'cs' : 'en']} 
                  value={poolStats.total_paid ? `${(poolStats.total_paid / 1e9).toFixed(2)}B` : '0'} 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{DashboardCopy.poolConfiguration[cs ? 'cs' : 'en']}</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>{DashboardCopy.poolFee[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{poolStats?.pool_fee ?? '—'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{DashboardCopy.minPayout[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{poolStats?.min_payout ?? '—'} ZION</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{DashboardCopy.payoutInterval[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{poolStats?.payment_interval ?? '—'}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{DashboardCopy.totalMiners[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{poolStats?.total_miners ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-sub p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{DashboardCopy.networkStats[cs ? 'cs' : 'en']}</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>{DashboardCopy.networkHashrate[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{formatHashrate(poolStats?.network_hashrate ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{DashboardCopy.difficulty[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{poolStats?.network_difficulty ? poolStats.network_difficulty.toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{DashboardCopy.pendingPayouts[cs ? 'cs' : 'en']}</span>
                      <span className="font-mono">{(poolStats?.pending_payouts ?? 0).toFixed(2)} ZION</span>
                    </div>
                    {poolStats?.last_block_time && (
                      <div className="flex justify-between">
                        <span>{DashboardCopy.lastBlock[cs ? 'cs' : 'en']}</span>
                        <span className="text-xs">{new Date(poolStats.last_block_time * 1000).toLocaleTimeString(DashboardCopy.enUs[cs ? 'cs' : 'en'])}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-12">{DashboardCopy.poolMetricsUnavailable[cs ? 'cs' : 'en']}</div>
          )}
        </motion.div>
        )}

        {(activeTab === 'overview' || activeTab === 'pool') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
          className="zion-rainbow-card rounded-[28px] bg-black/50 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-zion-cyan" />
              <div>
                <h2 className="text-2xl font-semibold text-white">{DashboardCopy.liveGrafanaMetrics[cs ? 'cs' : 'en']}</h2>
                <p className="text-sm text-gray-400">{DashboardCopy.realTimeDashboardsEmbeddedDire[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
            <Link
              href={`${GRAFANA_BASE_URL}/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1"
            >
              {DashboardCopy.openGrafana[cs ? 'cs' : 'en']}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {grafanaDashboards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group zion-rainbow-sub p-5 transition-all"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <card.icon className={`w-6 h-6 ${card.accent}`} />
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{card.pill}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-zion-cyan transition-colors">{card.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{card.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-zion-cyan">
                  {DashboardCopy.viewLiveData[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 zion-section p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">{DashboardCopy.availableMetrics[cs ? 'cs' : 'en']}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-zion-purple font-semibold">{DashboardCopy.poolMetrics[cs ? 'cs' : 'en']}</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {DashboardCopy.activeMiners[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.poolHashrate[cs ? 'cs' : 'en']}</li>
                  <li>• Shares accepted/rejected</li>
                  <li>• {DashboardCopy.blocksFound[cs ? 'cs' : 'en']}</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-gold font-semibold">Blockchain</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {DashboardCopy.blockHeight[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.transactionRate[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.connectedPeers[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.mempoolSize[cs ? 'cs' : 'en']}</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-cyan font-semibold">{DashboardCopy.apiPerformance[cs ? 'cs' : 'en']}</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• Request rate</li>
                  <li>• {DashboardCopy.latencyP95P99[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.errorRate[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.activeConnections[cs ? 'cs' : 'en']}</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-cyan-400 font-semibold">{DashboardCopy.systemResources[cs ? 'cs' : 'en']}</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {DashboardCopy.cpuUsage[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.memoryUsage[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.diskIO[cs ? 'cs' : 'en']}</li>
                  <li>• {DashboardCopy.networkTraffic[cs ? 'cs' : 'en']}</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {(activeTab === 'overview' || activeTab === 'blockchain') && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-card rounded-[28px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-zion-gold" />
            <h2 className="text-2xl font-semibold text-white">{DashboardCopy.recentBlocks[cs ? 'cs' : 'en']}</h2>
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
                    <span className="text-xs text-gray-400">{new Date(block.timestamp * 1000).toLocaleTimeString(DashboardCopy.enUs[cs ? 'cs' : 'en'])}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-400">
                    <span>{DashboardCopy.txs[cs ? 'cs' : 'en']} {block.transactions || 0}</span>
                    {block.consciousness_level && <span>{block.consciousness_level}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">{DashboardCopy.noBlockFeedDetectedFromApi[cs ? 'cs' : 'en']}</div>
          )}
        </motion.div>
        )}

        {(activeTab === 'overview' || activeTab === 'roadmap') && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ '--rc': '228, 30, 43' } as React.CSSProperties} className="zion-rainbow-card rounded-4xl border-zion-gold/30 bg-linear-to-r from-zion-purple/20 via-zion-gold/10 to-zion-cyan/20 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-200">{DashboardCopy.whatSNext[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{DashboardCopy.operationalRoadmap[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-100 max-w-xl mt-2">{DashboardCopy.pulledFromTheCurrentPublicLaun[cs ? 'cs' : 'en']}</p>
            </div>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-black/60 px-5 py-2 text-sm font-semibold text-white">
              {DashboardCopy.openRoadmap[cs ? 'cs' : 'en']}
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
