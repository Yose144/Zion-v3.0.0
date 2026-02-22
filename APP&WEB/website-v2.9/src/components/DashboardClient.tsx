'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Cpu,
  Gauge,
  LineChart,
  ShieldCheck,
  SignalHigh,
  TrendingUp,
  TreeDeciduous,
  Zap
} from 'lucide-react';

interface DashboardClientProps {
  stats: any;
  health: any;
  blocks: any[];
  poolStats: any;
}

const missionMetrics = [
  {
    label: 'TestNet Status',
    value: 'LIVE',
    description: 'Native Rust infrastructure operational',
    icon: Zap
  },
  {
    label: 'Pool Health',
    value: '100%',
    description: '1 pool · Helsinki (EU-North)',  // pool only on Helsinki
    icon: ShieldCheck
  },
  {
    label: 'Version',
    value: 'v2.9.6',
    description: 'On the Star TestNet',
    icon: Gauge
  },
  {
    label: 'MainNet Target',
    value: '31 Dec 2026',
    description: 'After security audit + stress testing',
    icon: SignalHigh
  }
];

const roadmapSlices = [
  {
    title: 'TestNet Live · Jan 2026',
    bullets: ['Native Rust blockchain + pool infrastructure', '5 seed nodes: Helsinki · SeedDE · Usa1 · Usa2 · Asia3', 'Real mining rewards · 5% humanitarian · 5% Issobella fund']
  },
  {
    title: 'Q1-Q2 2026 · Hardening',
    bullets: ['Security audit (Trail of Bits)', 'Native wallet + Ledger/Trezor support', 'Community mining pools onboarding']
  },
  {
    title: 'MainNet · 31 Dec 2026',
    bullets: ['Full production deployment', 'Multi-chain bridges operational', 'DAO governance activation']
  }
];

const GRAFANA_BASE_URL = (process.env.NEXT_PUBLIC_GRAFANA_BASE_URL || 'https://zionterranova.com/grafana').replace(/\/$/, '');
const PROMETHEUS_BASE_URL = (process.env.NEXT_PUBLIC_PROMETHEUS_BASE_URL || 'https://zionterranova.com/prometheus').replace(/\/$/, '');

const grafanaDashboards = [
  {
    title: 'DAO Tree of Life',
    description: 'Tree-of-life ledger for DAO guardians, governance circles, and treasury oversight',
    href: '/dashboard/dao-tree',
    icon: TreeDeciduous,
    accent: 'text-emerald-300',
    pill: 'DAO prototype'
  },
  {
    title: 'Pool Metrics Dashboard',
    description: 'Hashrate · Workers · Shares · Block discovery rate',
    href: '/dashboard/pool-metrics',
    icon: BarChart3,
    accent: 'text-zion-cyan',
    pill: 'Auto-refresh 10s'
  },
  {
    title: 'Full System Dashboard',
    description: 'CPU/RAM · RPC latency · API health · uptime',
    href: '/dashboard/system-metrics',
    icon: LineChart,
    accent: 'text-zion-purple',
    pill: 'Stack-wide telemetry'
  },
  {
    title: 'Advanced Pool Dashboard (Prometheus)',
    description: 'Raw PromQL explorer, ad-hoc queries & custom alerts',
    href: '/dashboard/advanced-pool',
    icon: Activity,
    accent: 'text-zion-gold',
    pill: 'Prometheus /graph'
  }
];

export default function DashboardClient({ stats, health, blocks, poolStats }: DashboardClientProps) {
  const computedUptime = health?.uptime ? `${Math.floor(health.uptime / 3600)}h` : '—';

  // Format hashrate helper
  const formatHashrate = (hashrate: number) => {
    if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
    if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
    if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} kH/s`;
    return `${hashrate.toFixed(0)} H/s`;
  };

  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="container mx-auto max-w-7xl space-y-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-white/10 bg-black/60 p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Mission control</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">Live systems dashboard</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                Real-time telemetry from ZION On the Star v2.9.6 TestNet: health checks, node status, blockchain vitals, and mining pool metrics across 2 EU regions.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {missionMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <metric.icon className="h-6 w-6 text-zion-gold" />
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gray-400">{metric.label}</p>
                  <p className="text-3xl font-semibold text-white">{metric.value}</p>
                  <p className="text-sm text-gray-300">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-black/50 p-6">
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
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Version</p>
                <p className="mt-2 text-2xl font-semibold text-white">{health?.version || 'v2.9.6'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Uptime</p>
                <p className="mt-2 text-2xl font-semibold text-white">{computedUptime}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-black/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-zion-gold" />
              <h2 className="text-2xl font-semibold text-white">Blockchain vitals</h2>
              {!stats && <span className="text-xs text-yellow-400">API offline</span>}
            </div>
            {stats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Blocks" value={stats.total_blocks ? stats.total_blocks.toLocaleString() : '—'} />
                  <MetricCard label="Total supply" value={stats.total_supply ? `${(stats.total_supply / 1e9).toFixed(2)}B` : '—'} />
                  <MetricCard label="Transactions" value={stats.total_transactions ? stats.total_transactions.toLocaleString() : '—'} />
                  <MetricCard label="Difficulty" value={stats.difficulty || '—'} />
                </div>
                {stats.latest_block && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Latest block</p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>Height</span>
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
                        <span>Timestamp</span>
                        <span>{stats.latest_block?.timestamp ? new Date(stats.latest_block.timestamp * 1000).toLocaleString() : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-12">Awaiting blockchain metrics…</div>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Mining pool status</h2>
                <p className="text-sm text-gray-400">Live metrics from stratum+tcp://77.42.31.72:3333</p>
              </div>
            </div>
            <Link href="/pool/stats" target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1">
              Pool Stats
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {poolStats ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  label="Active miners" 
                  value={poolStats.active_miners?.toString() || '0'} 
                />
                <MetricCard 
                  label="Pool hashrate" 
                  value={formatHashrate(poolStats.pool_hashrate || 0)} 
                />
                <MetricCard 
                  label="Blocks found" 
                  value={poolStats.blocks_found ? poolStats.blocks_found.toLocaleString() : '0'} 
                />
                <MetricCard 
                  label="Total paid" 
                  value={poolStats.total_paid ? `${(poolStats.total_paid / 1e9).toFixed(2)}B` : '0'} 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Pool configuration</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>Pool fee:</span>
                      <span className="font-mono">{poolStats?.pool_fee ?? '—'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min payout:</span>
                      <span className="font-mono">{poolStats?.min_payout ?? '—'} ZION</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payout interval:</span>
                      <span className="font-mono">{poolStats?.payment_interval ?? '—'}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total miners:</span>
                      <span className="font-mono">{poolStats?.total_miners ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Network stats</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span>Network hashrate:</span>
                      <span className="font-mono">{formatHashrate(poolStats?.network_hashrate ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Difficulty:</span>
                      <span className="font-mono">{poolStats?.network_difficulty ? poolStats.network_difficulty.toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending payouts:</span>
                      <span className="font-mono">{(poolStats?.pending_payouts ?? 0).toFixed(2)} ZION</span>
                    </div>
                    {poolStats?.last_block_time && (
                      <div className="flex justify-between">
                        <span>Last block:</span>
                        <span className="text-xs">{new Date(poolStats.last_block_time * 1000).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-12">Pool metrics unavailable</div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[28px] border border-white/10 bg-black/50 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-zion-cyan" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Live Grafana Metrics</h2>
                <p className="text-sm text-gray-400">Real-time dashboards embedded directly on ZION Mission Control</p>
              </div>
            </div>
            <Link
              href={`${GRAFANA_BASE_URL}/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs uppercase tracking-[0.3em] text-zion-cyan inline-flex items-center gap-1"
            >
              Open Grafana
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {grafanaDashboards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-zion-cyan/60 hover:bg-black/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <card.icon className={`w-6 h-6 ${card.accent}`} />
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{card.pill}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-zion-cyan transition-colors">{card.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{card.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-zion-cyan">
                  View live data
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">Available Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-zion-purple font-semibold">Pool Metrics</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• Active miners</li>
                  <li>• Pool hashrate</li>
                  <li>• Shares accepted/rejected</li>
                  <li>• Blocks found</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-gold font-semibold">Blockchain</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• Block height</li>
                  <li>• Transaction rate</li>
                  <li>• Connected peers</li>
                  <li>• Mempool size</li>
                </ul>
              </div>
              <div>
                <p className="text-zion-cyan font-semibold">API Performance</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• Request rate</li>
                  <li>• Latency (p95/p99)</li>
                  <li>• Error rate</li>
                  <li>• Active connections</li>
                </ul>
              </div>
              <div>
                <p className="text-emerald-400 font-semibold">System Resources</p>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• CPU usage</li>
                  <li>• Memory usage</li>
                  <li>• Disk I/O</li>
                  <li>• Network traffic</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-zion-gold" />
            <h2 className="text-2xl font-semibold text-white">Recent blocks</h2>
          </div>
          {blocks && blocks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {blocks.map((block: any) => (
                <div key={block.hash} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">#{block.height}</p>
                      <p className="font-mono text-xs text-zion-cyan">{block.hash?.substring(0, 16)}...</p>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(block.timestamp * 1000).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-400">
                    <span>Txs {block.transactions || 0}</span>
                    {block.consciousness_level && <span>{block.consciousness_level}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">No block feed detected from API.</div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/20 via-zion-gold/10 to-zion-cyan/20 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-200">What&apos;s next</p>
              <h2 className="text-3xl font-semibold text-white">Operational roadmap</h2>
              <p className="text-sm text-gray-100 max-w-xl mt-2">Pulled directly from docs/roadmaps and FINAL_REPORT_v2.9.6_SESSION.</p>
            </div>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-black/60 px-5 py-2 text-sm font-semibold text-white">
              Open roadmap
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {roadmapSlices.map((slice) => (
              <div key={slice.title} className="rounded-2xl border border-white/20 bg-black/30 p-4">
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
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
