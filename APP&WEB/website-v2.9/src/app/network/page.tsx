'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import NetworkStatus from '@/components/NetworkStatus';
import NetworkMap from '@/components/NetworkMap';
import PoolFinder from '@/components/PoolFinder';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Globe2,
  Layers,
  MapPin,
  Orbit,
  Radio,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const heroStats = [
  { label: 'Seed Regions', value: '3', descriptor: 'EU · US-EAST · AP' },
  { label: 'Telemetry', value: '30s', descriptor: 'Auto-refresh interval' },
  { label: 'Sync Cohesion', value: '100%', descriptor: '3/3 nodes synced' },
  { label: 'Network', value: 'TestNet', descriptor: 'v2.9.7 · Rust native' },
];

const infraFeatures = [
  {
    icon: Server,
    title: 'Helsinki 🇫🇮 (EU-NORTH)',
    detail: 'Primary seed + pool — ARM64 8GB',
    ip: '77.42.31.72',
    status: 'Primary',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
  {
    icon: Server,
    title: 'Usa 🇺🇸 (US-EAST)',
    detail: 'Seed node — AMD64 4GB',
    ip: '178.156.240.160',
    status: 'Seed',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
  {
    icon: Server,
    title: 'Asia 🌏 (AP-SOUTHEAST)',
    detail: 'Seed node — AMD64 4GB',
    ip: '5.223.43.93',
    status: 'Seed',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
];

const guideBlocks = [
  {
    icon: Zap,
    title: 'Mining',
    description: 'Connect any Cosmic Harmony / CPU miner to the Helsinki pool.',
    items: [
      'Pool: 77.42.31.72:3333 (Helsinki — primary)',
      'Wallet: YOUR_ZION_ADDRESS',
      'Password: x',
    ],
  },
  {
    icon: Terminal,
    title: 'RPC API',
    description: 'Native Rust JSON-RPC endpoint for explorers and tooling.',
    items: [
      'Helsinki: http://77.42.31.72:8444/jsonrpc',
      'Usa:      http://178.156.240.160:8444/jsonrpc',
      'Asia:     http://5.223.43.93:8444/jsonrpc',
      'Method: POST',
    ],
  },
  {
    icon: Globe,
    title: 'P2P Layer',
    description: 'Native libp2p network for blockchain synchronization.',
    items: [
      'Helsinki: 77.42.31.72:8334',
      'Usa:      178.156.240.160:8334',
      'Asia:     5.223.43.93:8334',
    ],
  },
];

const networkFacts = [
  { text: 'Native Rust P2P — libp2p mesh', done: true },
  { text: '3 seed nodes in full consensus', done: true },
  { text: 'Stratum v2 mining on both pools', done: true },
  { text: 'JSON-RPC endpoints live (port 8444)', done: true },
  { text: '24/7 Docker containers with auto-restart', done: true },
  { text: 'LWMA DAA — target 60s block time', done: true },
  { text: '3 nodes across 3 regions', done: true },
  { text: 'Prometheus + Grafana monitoring', done: true },
  { text: 'Geographic load balancing', done: false },
];

export default function NetworkPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const factsDone = networkFacts.filter((f) => f.done).length;
  const factsTotal = networkFacts.length;

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const primaryPool = '77.42.31.72:3333';
  const backupPoolA = '178.156.240.160:3333';
  const backupPoolB = '5.223.43.93:3333';
  const xmrigFailover = `./xmrig -o stratum+tcp://${primaryPool} --url-backup=stratum+tcp://${backupPoolA} --url-backup=stratum+tcp://${backupPoolB} -u YOUR_ZION_ADDRESS -p x`;
  const healthCurl = 'curl -s https://www.zionterranova.com/api/health';
  const networkCurl = 'curl -s https://www.zionterranova.com/api/network';

  return (
    <div className="min-h-screen pt-28 md:pt-32 pb-24 px-4 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
                <Radio className="h-4 w-4" />
                ZION v2.9.7 · Network
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Live Status</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  P2P Network
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Real-time telemetry from native Rust nodes. Helsinki (primary + pool), Usa (Ashburn US-EAST), Asia (Singapore AP-SOUTHEAST)
                forming the TestNet mesh. All data refreshes every 30 seconds.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> Native Rust
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> TestNet 2.9.7
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> 3 Nodes Synced
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══════ OPERATOR TOOLKIT ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Operator Toolkit</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Terminal className="h-7 w-7 text-zion-cyan" />
              Network Ops Pro
            </h2>
            <p className="text-sm text-gray-400">Failover templates, health probes, and machine-readable monitoring endpoints.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Failover Mining</p>
              <p className="text-sm text-gray-300 mb-3">Primary + 2 backup stratum endpoints for operational continuity.</p>
              <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{xmrigFailover}</code>
              <button onClick={() => copyText('xmrig-failover', xmrigFailover)} className="mt-3 inline-flex items-center gap-2 text-xs text-zion-cyan hover:text-white transition">
                <Copy className="h-3.5 w-3.5" /> {copied === 'xmrig-failover' ? 'Copied' : 'Copy command'}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Health Probes</p>
              <div className="space-y-2">
                <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{healthCurl}</code>
                <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{networkCurl}</code>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => copyText('health-curl', healthCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'health-curl' ? 'Copied' : 'Copy health'}</button>
                <button onClick={() => copyText('network-curl', networkCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'network-curl' ? 'Copied' : 'Copy network'}</button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Export & Docs</p>
              <div className="space-y-2.5 text-sm">
                <a href="/api/network" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="font-mono text-xs text-gray-200">/api/network</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/api/health" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="font-mono text-xs text-gray-200">/api/health</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <Link href="/api-reference" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
                  <span className="text-gray-200">API Reference</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ INFRASTRUCTURE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Infrastructure</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-gold" />
              Seed Nodes
            </h2>
            <p className="text-sm text-gray-400">Native Rust nodes in Docker containers — full P2P mesh with automatic peer discovery.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {infraFeatures.map((node, idx) => (
              <motion.div
                key={node.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className={`relative overflow-hidden rounded-3xl border ${node.border} ${node.bg} p-6`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <node.icon className={`h-6 w-6 ${node.color}`} />
                    <div>
                      <h3 className="text-lg font-semibold text-white">{node.title}</h3>
                      <p className="text-sm text-gray-400">{node.detail}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] rounded-full border ${node.border} px-3 py-1 ${node.color} uppercase tracking-widest`}>
                    {node.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-mono">{node.ip}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Zap className="w-3.5 h-3.5 text-gray-500" />
                    <span>Stratum: port 3333</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Terminal className="w-3.5 h-3.5 text-gray-500" />
                    <span>RPC: port 8444</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <span>P2P: port 8334</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ LIVE TELEMETRY ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Live Telemetry</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              Node Status
            </h2>
            <p className="text-sm text-gray-400">Real-time health, block height, hashrate, and sync status from all seed nodes.</p>
          </div>
          <NetworkStatus className="max-w-none" />
        </motion.section>

        {/* ═══════ NETWORK MAP + POOL FINDER ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Geography</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-cyan" />
              Network Map &amp; Pool Finder
            </h2>
            <p className="text-sm text-gray-400">Visualize global node distribution and find the best mining pool for your location.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <NetworkMap />
            </div>
            <PoolFinder />
          </div>
        </motion.section>

        {/* ═══════ CONNECTION GUIDES ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Connect</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              Connection Guides
            </h2>
            <p className="text-sm text-gray-400">Everything you need to connect a miner, query the RPC API, or sync a node.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {guideBlocks.map((block, idx) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <block.icon className="h-5 w-5 text-zion-gold" />
                  <h3 className="text-lg font-semibold text-white">{block.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{block.description}</p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-1">
                  {block.items.map((line) => (
                    <code key={line} className="block text-sm font-mono text-zion-gold">{line}</code>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ NETWORK CHECKLIST ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Status</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              Network Readiness
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {networkFacts.map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm py-2">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${item.done ? 'text-emerald-400' : 'text-gray-600'}`} />
                <span className={item.done ? 'text-gray-300' : 'text-gray-500'}>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
            <span className="font-mono text-emerald-400">{factsDone}</span>
            <span>/</span>
            <span className="font-mono">{factsTotal}</span>
            <span>completed</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(factsDone / factsTotal) * 100}%` }} />
            </div>
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26 }}
          className="rounded-4xl border border-emerald-400/30 bg-linear-to-r from-emerald-500/20 via-zion-cyan/10 to-emerald-500/20 p-10 text-center"
        >
          <Radio className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-6 text-3xl font-semibold text-white">Join the ZION Network</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            Three native Rust nodes running 24/7, forming a resilient P2P mesh.
            Connect your miner, run your own node, or explore the blockchain.
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · MainNet 31.12.2026
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {['Cosmic Harmony PoW', 'Stratum v2', 'libp2p mesh', 'Docker native', 'Auto-failover'].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Activity className="h-4 w-4" /> Explorer
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-emerald-400 to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
              <Rocket className="h-4 w-4" /> Roadmap
            </Link>
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10"
            >
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova v2.9.7 — P2P Network Pro · Native Rust Infrastructure · 3 Seed Nodes · 3 Continents · MainNet 31.12.2026
        </p>
      </div>
    </div>
  );
}
