'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Layers,
  Lock,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Globe2,
  Orbit
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   DATA — sourced from authoritative ROADMAP.md (10 Feb 2026)
   ═══════════════════════════════════════════════════════════ */

const heroStats = [
  { label: 'Rust LOC', value: '52,590', descriptor: '5 crates' },
  { label: 'Tests passing', value: '780+', descriptor: '0 failing' },
  { label: 'Network', value: '3/3 online', descriptor: 'Helsinki · USA · Asia' },
  { label: 'MainNet Gate', value: 'NO-GO', descriptor: 'B-CRIT-01..03 open' }
];

const layerStack = [
  {
    layer: 'L1',
    emoji: '⛓️',
    title: 'ZION Blockchain (MainNet)',
    period: '2026',
    color: 'from-emerald-500 to-lime-400',
    border: 'border-emerald-500/40',
    items: [
      'PoW Cosmic Harmony v3 — ASIC-resistant',
      'UTXO model + Ed25519 signatures',
      'Decade Decay emise: 5,400 → 724 ZION/block (100+ let + tail ∞)',
      '16.28B genesis premine (immediately unlocked)',
      'LWMA DAA (60-block, ±25%)',
      'Fee burning — ALL fees destroyed',
      'Distribuce: 89% miner · 5% humanit. · 5% Issobella · 1% pool',
      'Dual-mining: ZION (CHv3) + VRSC (VerusHash)',
      'Mining pool (Stratum v2, PPLNS)',
      'P2P síť, IBD sync, seed nodes'
    ],
    active: true
  },
  {
    layer: 'L2',
    emoji: '💱',
    title: 'DEX & DeFi Layer',
    period: '2026 testnet ready · 2027 production',
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/40',
    items: [
      'Atomic Swaps (ZION ↔ BTC/ETH/XMR)',
      'wZION Bridge — Base Sepolia testnet ready ✅',
      'Liquidity Pools & AMM DEX',
      'DAO Governance v1'
    ],
    active: false
  },
  {
    layer: 'L3',
    emoji: '🧠',
    title: 'Warp & AI Native',
    period: '2026 implementation done · 2027 production',
    color: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/40',
    items: [
      'NCL — AI task marketplace',
      'AI Orchestrátor — agent routing',
      'WARP adapters 7/7 implemented ✅ (2026-03-02)',
      'AI Native SDK'
    ],
    active: false
  },
  {
    layer: 'L4',
    emoji: '🎮',
    title: 'ZION Oasis',
    period: '2029+',
    color: 'from-yellow-500 to-orange-500',
    border: 'border-yellow-500/40',
    items: [
      'UE5 open-world (consciousness mining)',
      'XP / Consciousness Level systém',
      'NFT avatary, předměty, území',
      'Play-to-Mine — herní aktivity → hashrate'
    ],
    active: false
  },
  {
    layer: 'L5',
    emoji: '🌍',
    title: 'Free World',
    period: '2030+',
    color: 'from-amber-500 to-yellow-500',
    border: 'border-amber-500/40',
    items: [
      'Humanitární mise — financováno 5% block reward',
      'Výzkum a vývoj kvantového motoru na volnou energii',
      'Off-grid komunity a decentralizovaná infrastruktura',
      'Humanitární desátek — 540 ZION/block (L1 Genesis)'
    ],
    active: false
  },
  {
    layer: 'L6',
    emoji: '🚀',
    title: 'ZION Issobella',
    period: '2040+',
    color: 'from-rose-500 to-red-500',
    border: 'border-rose-500/40',
    items: [
      'Vesmírná stanice ZION Issobella',
      '5% block reward fund (od bloku 1)',
      'Orbital mining & deep-space research',
      'Consciousness beyond Earth'
    ],
    active: false
  }
];

const constitution = [
  { param: 'Chain ID', value: 'zion-mainnet-1' },
  { param: 'Total Supply', value: '144,000,000,000 ZION' },
  { param: 'Mining Supply', value: '127,720,000,000 ZION' },
  { param: 'Genesis Premine', value: '16,280,000,000 ZION' },
  { param: 'Block Reward (D1)', value: '5,400.067 ZION' },
  { param: 'Emission Model', value: 'Decade Decay (-20%/10y)' },
  { param: 'Tail Emission', value: '724.785 ZION/block ∞' },
  { param: 'Block Time', value: '60 sekund' },
  { param: 'DAA', value: 'LWMA (60 bloků, ±25%)' },
  { param: 'Max Reorg', value: '10 bloků' },
  { param: 'Soft Finality', value: '60 bloků' },
  { param: 'Coinbase Maturity', value: '100 bloků' },
  { param: 'Consensus', value: 'PoW · Cosmic Harmony v3 + VRSC' },
  { param: 'Distribution', value: '89% miner · 5% hum. · 5% Issobella · 1% pool' },
  { param: 'Presale', value: '❌ NEEXISTUJE' },
  { param: 'Mining Horizon', value: '100+ let + tail ∞' }
];

const premineAllocation = [
  { category: 'ZION OASIS + Winners Golden Egg/Xp', zion: '8,250,000,000', share: '50.7%', lock: 'Okamžitě dostupné' },
  { category: 'DAO Treasury', zion: '4,000,000,000', share: '24.6%', lock: 'Okamžitě dostupné' },
  { category: 'Infrastructure & Dev', zion: '2,590,000,000', share: '15.9%', lock: 'Okamžitě dostupné' },
  { category: 'Humanitarian Fund', zion: '1,440,000,000', share: '8.8%', lock: 'Okamžitě dostupné' }
];

const componentStatus = [
  { name: 'core/ (blockchain)', loc: '~17k', tests: 275, status: '✅', readiness: 90 },
  { name: 'cosmic-harmony/ (PoW)', loc: '~11k', tests: 68, status: '✅', readiness: 88 },
  { name: 'pool/ (mining pool)', loc: '~12k', tests: 132, status: '✅', readiness: 90 },
  { name: 'miner/ (universal)', loc: '~6k', tests: 73, status: '✅', readiness: 85 },
  { name: 'desktop-agent/', loc: '~3k', tests: 0, status: '✅', readiness: 80 },
  { name: 'website-v2.9/', loc: '~5k', tests: 0, status: '🔄', readiness: 75 },
  { name: 'mobile-app/', loc: '~2k', tests: 0, status: '🔴', readiness: 55 },
  { name: 'warp/ (L2 NCL multichain)', loc: '~9k', tests: 252, status: '✅', readiness: 90 }
];

/* ─── PHASES ─── */

interface PhaseData {
  id: string;
  title: string;
  period: string;
  priority: string;
  progress: number;
  status: 'done' | 'active' | 'upcoming';
  description: string;
  sprints: { id: string; title: string; tests?: number; done: boolean }[];
  exitCriteria: { text: string; done: boolean }[];
}

const phases: PhaseData[] = [
  {
    id: '0',
    title: 'Spec Freeze & Core Rewrite',
    period: 'Únor 2026 (dokončeno 9. 2.)',
    priority: 'P0 Blocker → ✅ SPLNĚNO',
    progress: 100,
    status: 'done',
    description: '155 testů, 8 commitů. Emise, DAA, fee market, wallet, konsensus hardening — vše zmrazeno.',
    sprints: [
      { id: '0.0', title: 'Repo Migrace — čisté repo, workspace, Docker, CI/CD', done: true },
      { id: '0.1', title: 'Emission & Genesis — 5,400 ZION/block, 16.28B premine', done: true },
      { id: '0.2', title: 'DAA & Consensus — LWMA 60-blok, ±25%, fork-choice', done: true },
      { id: '0.3', title: 'Fee Market & Mempool — fee burning, double-spend, eviction', done: true },
      { id: '0.4', title: 'Wallet & TX — UTXO select, Ed25519, broadcast, E2E', done: true },
      { id: '0.5', title: 'Consensus Hardening — maturity=100, reorg=10, finality=60', done: true }
    ],
    exitCriteria: [
      { text: 'Unit testy pro nový reward model', done: true },
      { text: 'Genesis generuje 16.28B premine', done: true },
      { text: 'LWMA DAA deterministická', done: true },
      { text: 'Max reorg depth = 10 enforcován', done: true },
      { text: 'Coinbase maturity = 100 enforcována', done: true },
      { text: 'Wallet send E2E funguje', done: true }
    ]
  },
  {
    id: '1',
    title: 'Hardened TestNet',
    period: 'Únor — Květen 2026',
    priority: 'P0 Blocker',
    progress: 92,
    status: 'active',
    description: '168h stability PASS (2026-03-03), 3-node mesh online. Sprint 1.10 uzavřen, zbývá partition + 100 miners.',
    sprints: [
      { id: '1.0', title: 'Network Identity & Deploy — chain reset, Docker, 3-server', done: true },
      { id: '1.1', title: 'Config Validation — TOML parsing, boundary checks', tests: 70, done: true },
      { id: '1.2', title: 'Security & Edge-Case — reorg, double-spend, fork-choice', tests: 29, done: true },
      { id: '1.3', title: 'IBD Hardening — timeouts, stall detection, peer scoring', tests: 42, done: true },
      { id: '1.4', title: 'Pool Payout Integration — batch TX, PoolWallet, JSON-RPC', tests: 23, done: true },
      { id: '1.5', title: 'Buyback + DAO Treasury — 100% DAO revenue, burn address', tests: 28, done: true },
      { id: '1.6', title: 'Supply + Buyback API — getSupplyInfo, getNetworkInfo', tests: 15, done: true },
      { id: '1.7', title: 'P2P Rate-Limiting — 200 msgs/peer/60s, escalating bans', tests: 13, done: true },
      { id: '1.8', title: 'Health Check & Metrics — getHealthCheck, getMetrics', tests: 8, done: true },
      { id: '1.9', title: 'Stress Test Suite — high TX, rapid blocks, partition', tests: 21, done: true },
      { id: '1.10', title: '168h Stability Run — 3 nody, žádný kritický incident', done: true },
      { id: '1.11', title: 'Live Partition Test — izolace node 30 min, reconnect', done: false },
      { id: '1.12', title: '100 Miners Stress — simulace 100 Stratum klientů', done: false }
    ],
    exitCriteria: [
      { text: 'TestNet deploy na 3+ serverech', done: true },
      { text: 'Reorg/double-spend/fork testy (29 testů)', done: true },
      { text: 'IBD hardening (42 testů)', done: true },
      { text: 'Pool payout batch TX (23 testů)', done: true },
      { text: 'Buyback + DAO Treasury (28 testů)', done: true },
      { text: 'RPC API kompletní (36 testů)', done: true },
      { text: 'DoS ochrana (MessageRateLimiter)', done: true },
      { text: 'Stress test suite (21 testů)', done: true },
      { text: '168h stability run bez kritického incidentu', done: true },
      { text: 'Orphan rate < 2%', done: false },
      { text: 'Žádný critical bug 14 dní', done: false }
    ]
  },
  {
    id: '2',
    title: 'Node UX & Mining',
    period: 'Červen — Červenec 2026',
    priority: 'P1 Important',
    progress: 0,
    status: 'upcoming',
    description: 'Node spustitelný za 10 min, block explorer, mining guides, RPC docs.',
    sprints: [
      { id: '2.1', title: 'Node UX — README, config.toml, structured logging, CLI', done: false },
      { id: '2.2', title: 'Mining Polish — CPU baseline, GPU produkce, pool failover', done: false },
      { id: '2.3', title: 'Block Explorer — indexer, web UI, supply API, rich list', done: false }
    ],
    exitCriteria: [
      { text: 'Node spustitelný za 10 minut podle README', done: false },
      { text: 'Block explorer běží a indexuje', done: false },
      { text: 'Mining guides hotové', done: false },
      { text: 'RPC API zdokumentováno', done: false }
    ]
  },
  {
    id: '3',
    title: 'Infrastructure & Legal',
    period: 'Srpen — Září 2026',
    priority: 'P1 Important',
    progress: 55,
    status: 'active',
    description: 'HEL/USA/Asia infrastruktura běží, monitoring aktivní, legal/docs postupuje. wZION bridge je live na Base Sepolia testnetu.',
    sprints: [
      { id: '3.1', title: 'Seed Nodes & Monitoring — HEL/USA/Asia live, Prometheus + Grafana', done: true },
      { id: '3.2', title: 'Docker & Deploy — runbook + compose + live web deploy flow', done: true },
      { id: '3.3', title: 'Legal & Compliance — disclaimers, token-not-security, risk', done: true },
      { id: '3.4', title: 'Exchange Readiness — wZION + Bridge live on Base Sepolia (testnet)', done: true }
    ],
    exitCriteria: [
      { text: '3 seed nody ve 3 regionech (HEL/USA/Asia) stabilně online', done: true },
      { text: 'Monitoring + alerting aktivní', done: true },
      { text: 'Legal docs kompletní', done: true },
      { text: 'wZION + Bridge testnet-ready na Base Sepolia', done: true },
      { text: 'Produkční mainnet exchange rollout', done: false }
    ]
  },
  {
    id: '4',
    title: 'Dress Rehearsal',
    period: 'Říjen — Listopad 2026',
    priority: 'P0 Blocker',
    progress: 0,
    status: 'upcoming',
    description: '168h (7-day) stability run, security audit (Trail of Bits / OtterSec / Halborn), code freeze, bug bounty.',
    sprints: [
      { id: '4.1', title: 'Dress Rehearsal — staging chain, 1000 miners, disaster recovery', done: false },
      { id: '4.2', title: 'Security Audit — RFP, kickoff, mid-review, final, bug bounty', done: false },
      { id: '4.3', title: 'Code Freeze — feature freeze, tag v2.9.6-mainnet, SHA-256', done: false }
    ],
    exitCriteria: [
      { text: '7-day stability run bez pádu', done: false },
      { text: 'Security audit — žádný critical/high', done: false },
      { text: 'Code freeze — tag vytvořen', done: false },
      { text: 'Binární releasy s SHA-256', done: false },
      { text: 'Bug bounty program aktivní', done: false }
    ]
  },
  {
    id: '5',
    title: 'MainNet Launch 🚀',
    period: 'Prosinec 2026',
    priority: '🎯 Hard Deadline: 31.12.2026',
    progress: 0,
    status: 'upcoming',
    description: 'Genesis block vytvořen OFFLINE (air-gapped). Seed nodes, pool mining, explorer, supply API — vše živě.',
    sprints: [
      { id: 'T-14', title: 'Genesis freeze — všechny parametry zmrazeny', done: false },
      { id: 'T-7', title: 'Community announcement + wallety ke stažení', done: false },
      { id: 'T-2', title: 'Final node software release', done: false },
      { id: 'T-0', title: '🚀 MAINNET GENESIS — 31. 12. 2026', done: false }
    ],
    exitCriteria: [
      { text: 'Genesis block hash publikován', done: false },
      { text: 'Seed nodes online (5+)', done: false },
      { text: 'Pool + solo mining otevřen', done: false },
      { text: 'Block explorer live', done: false },
      { text: 'Supply API live', done: false }
    ]
  }
];

const postLaunch = [
  {
    title: '6A: Silent Mainnet',
    sub: 'Dny 1–30',
    items: ['Monitor orphan rate < 2%', 'Difficulty stabilita 60s ± 10%', 'Explorer + Supply API veřejný', 'Hotfix releases pokud potřeba']
  },
  {
    title: '6B: První DEX Listing',
    sub: 'Dny 14–45',
    items: ['Deploy wZION ERC-20 (Base/Arbitrum)', 'Uniswap pool (wZION/ETH)', 'Počáteční likvidita + price discovery']
  },
  {
    title: '6C: CMC & CoinGecko',
    sub: 'Dny 30–60',
    items: ['CoinGecko application', 'CoinMarketCap application', 'Supply data feed']
  },
  {
    title: '6D: CEX Outreach',
    sub: 'Dny 45–120',
    items: ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (po volume)', 'Binance / Coinbase — NE jako první krok']
  }
];

const securityChecklist = [
  { text: 'Ed25519 signature verification', done: true },
  { text: 'Double-spend ochrana (mempool + UTXO)', done: true },
  { text: 'Overflow ochrana (checked_add)', done: true },
  { text: 'P2P rate limiting', done: true },
  { text: 'Coinbase maturity 100 bloků', done: true },
  { text: 'Reorg limit 10 bloků', done: true },
  { text: 'Timestamp validace ±120s', done: true },
  { text: 'Mempool limits (50k TX, min fee)', done: true },
  { text: 'RPC autentizace (API key)', done: false },
  { text: 'Block size limit (max 1 MB)', done: false },
  { text: 'TX size limit (max 100 KB)', done: false },
  { text: 'External audit', done: false }
];

/* ═══════════════════════════════════
   COMPONENT
   ═══════════════════════════════════ */

export default function RoadmapPage() {
  const secDone = securityChecklist.filter((i) => i.done).length;
  const secTotal = securityChecklist.length;

  return (
    <div className="zion-shell min-h-screen pt-32 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-14">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Target className="h-4 w-4" />
                ZION v2.9.7 · Roadmap
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Mission Control</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  Flight plan to MainNet
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Realistický plán: stabilní TestNet se 3 nody (HEL/USA/Asia) → Base Sepolia bridge ready → WARP implementation complete → MainNet launch{' '}
                <strong className="text-white">31. 12. 2026</strong>.
                Jednoduchý L1 blockchain, který funguje bezchybně, je základem pro nekonečný ekosystém nad ním.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> Updated 3. Mar 2026
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> MainNet · 31.12.2026
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> 780+ testů passing
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

        {/* ── LAYER ARCHITECTURE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Architecture</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              Layer Stack
            </h2>
            <p className="text-sm text-gray-400">Každý layer je nezávislý. L1 nikdy nekompromitujeme kvůli vyšším vrstvám.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {layerStack.map((layer, idx) => (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 + idx * 0.06 }}
                className={`relative overflow-hidden rounded-3xl border ${layer.active ? layer.border : 'border-white/10'} ${layer.active ? 'bg-black/60 ring-1 ring-emerald-500/20' : 'bg-black/30'} p-6`}
              >
                {layer.active && (
                  <div className={`absolute inset-0 bg-linear-to-br ${layer.color} opacity-10 blur-2xl`} />
                )}
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{layer.emoji}</span>
                    {layer.active && (
                      <span className="text-[10px] rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200 uppercase tracking-widest">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{layer.layer} · {layer.period}</p>
                  <h3 className="text-lg font-semibold text-white">{layer.title}</h3>
                  <ul className="space-y-1.5 text-sm text-gray-300">
                    {layer.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${layer.active ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── COMPONENT STATUS TABLE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Telemetry</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Code2 className="h-7 w-7 text-zion-cyan" />
              Component Status
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Komponenta</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">LOC</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Testy</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Stav</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {componentStatus.map((comp) => (
                  <tr key={comp.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-white">{comp.name}</td>
                    <td className="py-3 px-4 text-gray-300">{comp.loc}</td>
                    <td className="py-3 px-4 text-gray-300">{comp.tests || '—'}</td>
                    <td className="py-3 px-4">{comp.status}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 rounded-full bg-white/10">
                          <div
                            className={`h-2 rounded-full ${comp.readiness >= 85 ? 'bg-emerald-400' : comp.readiness >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${comp.readiness}%` }}
                          />
                        </div>
                        <span className="text-gray-300">{comp.readiness}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── L1 PHASES ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">L1 Execution</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-purple" />
              Fáze 0 – 5 · TestNet → MainNet
            </h2>
            <p className="text-sm text-gray-400">Každá fáze má jasné exit criteria. Žádné zkratky.</p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-linear-to-b from-emerald-400 via-zion-purple to-zion-gold hidden md:block" />
            <div className="space-y-6">
              {phases.map((phase, idx) => {
                const statusColor =
                  phase.status === 'done'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : phase.status === 'active'
                    ? 'border-zion-cyan/40 bg-zion-cyan/5'
                    : 'border-white/10 bg-black/30';
                const statusBadge =
                  phase.status === 'done'
                    ? { text: 'Dokončeno', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' }
                    : phase.status === 'active'
                    ? { text: 'Probíhá', cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' }
                    : { text: 'Plánováno', cls: 'border-white/20 bg-white/5 text-gray-300' };

                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.04 }}
                    className="relative flex gap-6"
                  >
                    <div className="relative z-10 mt-2 hidden md:flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60 text-sm font-bold text-white">
                      {phase.id}
                    </div>

                    <div className={`flex-1 rounded-3xl border ${statusColor} p-6 backdrop-blur-sm`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-white">Fáze {phase.id} — {phase.title}</h3>
                          <p className="text-sm text-gray-400 mt-1">{phase.period} · {phase.priority}</p>
                          <p className="text-sm text-gray-300 mt-2">{phase.description}</p>
                        </div>
                        <span className={`text-xs rounded-full border px-3 py-1 shrink-0 ${statusBadge.cls} uppercase tracking-widest`}>
                          {statusBadge.text}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-4">
                        <div className="h-2 flex-1 rounded-full bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${phase.progress}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className={`h-2 rounded-full ${phase.status === 'done' ? 'bg-emerald-400' : 'bg-linear-to-r from-blue-500 via-zion-cyan to-zion-purple'}`}
                          />
                        </div>
                        <span className="text-sm font-mono text-gray-300">{phase.progress}%</span>
                      </div>

                      <div className="mt-5 grid gap-2 md:grid-cols-2">
                        {phase.sprints.map((sprint) => (
                          <div key={sprint.id} className="flex items-start gap-2 text-sm">
                            {sprint.done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                            )}
                            <span className={sprint.done ? 'text-gray-300' : 'text-gray-500'}>
                              <span className="font-mono text-xs text-gray-500 mr-1">{sprint.id}</span>
                              {sprint.title}
                              {sprint.tests ? <span className="text-gray-600 ml-1">({sprint.tests} testů)</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      <details className="mt-5 group">
                        <summary className="text-xs uppercase tracking-[0.3em] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none">
                          Exit Criteria ({phase.exitCriteria.filter((e) => e.done).length}/{phase.exitCriteria.length}) ▸
                        </summary>
                        <div className="mt-3 grid gap-1.5 md:grid-cols-2">
                          {phase.exitCriteria.map((ec) => (
                            <div key={ec.text} className="flex items-start gap-2 text-sm">
                              {ec.done ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-gray-600 mt-0.5 shrink-0" />
                              )}
                              <span className={ec.done ? 'text-gray-300' : 'text-gray-500'}>{ec.text}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ── POST-LAUNCH (Fáze 6) ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">After Launch</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-gold" />
              Fáze 6 · Post-Launch &amp; Exchange
            </h2>
            <p className="text-sm text-gray-400">Leden — Červen 2027 · MainNet → stabilita → DEX → CEX → CMC/CG. Žádný hype první den.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {postLaunch.map((block, idx) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-base font-semibold text-white">{block.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{block.sub}</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <ArrowRight className="h-3 w-3 text-zion-gold mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3">Exchange Sequence</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                { n: '1️⃣', label: 'Base / Arbitrum (Uni v3)', cls: 'text-emerald-300' },
                { n: '2️⃣', label: 'BNB Chain (PancakeSwap)', cls: 'text-yellow-300' },
                { n: '3️⃣', label: 'CoinGecko + CMC', cls: 'text-blue-300' },
                { n: '4️⃣', label: 'Tier-3 CEX (MEXC, XT)', cls: 'text-purple-300' },
                { n: '5️⃣', label: 'Tier-2 CEX (po volume)', cls: 'text-gray-400' }
              ].map((step) => (
                <span key={step.n} className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 ${step.cls}`}>
                  {step.n} {step.label}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── CONSTITUTION + PREMINE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="rounded-3xl border border-zion-gold/30 bg-linear-to-br from-zion-gold/10 via-transparent to-zion-purple/10 p-8">
            <div className="flex items-center gap-3 mb-5">
              <Lock className="h-6 w-6 text-zion-gold" />
              <div>
                <h2 className="text-2xl font-semibold text-white">MainNet Constitution</h2>
                <p className="text-sm text-gray-400">Zmrazené parametry — nelze změnit bez hard forku</p>
              </div>
            </div>
            <div className="space-y-0">
              {constitution.map((row) => (
                <div key={row.param} className="flex items-center justify-between py-2.5 border-b border-white/5 text-sm">
                  <span className="text-gray-400">{row.param}</span>
                  <span className="font-mono text-white flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-zion-gold/60" />
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
            <div className="flex items-center gap-3 mb-5">
              <Scale className="h-6 w-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Genesis Premine</h2>
                <p className="text-sm text-gray-400">16,280,000,000 ZION — transparentní alokace</p>
              </div>
            </div>
            <div className="space-y-4">
              {premineAllocation.map((row) => (
                <div key={row.category} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{row.category}</h4>
                    <span className="text-xs text-zion-gold font-mono">{row.share}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-300">
                    <span className="font-mono">{row.zion} ZION</span>
                    <span className="text-xs text-gray-500">{row.lock}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-linear-to-r from-zion-gold to-zion-purple"
                      style={{ width: row.share }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── SECURITY CHECKLIST ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Security</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-emerald-400" />
              Pre-MainNet Security Checklist
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {securityChecklist.map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm py-2">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-600 shrink-0" />
                )}
                <span className={item.done ? 'text-gray-300' : 'text-gray-500'}>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
            <span className="font-mono text-emerald-400">{secDone}</span>
            <span>/</span>
            <span className="font-mono">{secTotal}</span>
            <span>completed</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(secDone / secTotal) * 100}%` }} />
            </div>
          </div>
        </motion.section>

        {/* ── MASTER TIMELINE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Timeline</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-zion-gold" />
              Master Timeline 2026 – 2040+
            </h2>
          </div>
          <div className="space-y-4">
            {[
              { layer: 'L1 Blockchain', period: '2026', phases: 'Fáze 0 ✅ → 1 🔄 (168h PASS) → 2–4 → MainNet 🚀', color: 'from-emerald-400 to-lime-400', width: '42%', offset: '0%' },
              { layer: 'L2 NCL', period: '2027', phases: 'Neural Conscious Layer · wZION Bridge ✅ · AI-native', color: 'from-blue-400 to-cyan-400', width: '22%', offset: '44%' },
              { layer: 'L3 ZION DAO', period: '2028', phases: 'Governance · Treasury 4B ZION · WARP 7/7 ✅', color: 'from-purple-400 to-pink-400', width: '22%', offset: '56%' },
              { layer: 'L4 Oasis', period: '2029+', phases: 'UE5 · Play-to-Mine · Beta', color: 'from-yellow-400 to-orange-400', width: '18%', offset: '68%' },
              { layer: 'L5 Free World', period: '2030+', phases: 'Humanitární mise · Volná energie', color: 'from-amber-400 to-yellow-400', width: '18%', offset: '72%' },
              { layer: 'L6 Issobella', period: '2040+', phases: 'Orbital Station · Fund', color: 'from-rose-400 to-red-400', width: '12%', offset: '88%' }
            ].map((row) => (
              <div key={row.layer} className="flex items-center gap-4">
                <div className="w-28 md:w-36 shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{row.layer}</p>
                  <p className="text-xs text-gray-500">{row.period}</p>
                </div>
                <div className="flex-1 h-10 rounded-xl bg-white/5 relative overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-xl bg-linear-to-r ${row.color} opacity-60 flex items-center px-3`}
                    style={{ width: row.width, left: row.offset }}
                  >
                    <span className="text-[11px] text-white font-medium truncate">{row.phases}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 mt-2">
              <div className="w-28 md:w-36 shrink-0" />
              <div className="flex-1 flex justify-between text-[10px] text-gray-600 px-1">
                {['2026 Q1', 'Q2', 'Q3', 'Q4', '2027 Q1', 'Q2', 'Q3', 'Q4', '2028'].map((q) => (
                  <span key={q}>{q}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── CTA ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.36 }}
          className="rounded-4xl border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10 text-center"
        >
          <Rocket className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">MainNet launch · 31. 12. 2026</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            L1 je srdce. Stavíme zdola nahoru. Žádné zkratky.
            Na podzim proběhne dress rehearsal + security audit, pak soft-launch a 31. 12. 2026 genesis block.
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            Právní pozice: ZION = protocol-native utility token, NE security. Žádné ICO/IEO/IDO. Tokeny jsou{' '}
            <strong className="text-white">mined, not sold</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {['144B total supply', '5,400 ZION/block (D1)', 'Decade Decay -20%/10y', 'Fee burning', '100+ let mining', '5% Issobella Fund'].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <BookOpen className="h-4 w-4" /> Documentation
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold to-zion-purple px-6 py-3 text-sm font-semibold text-black">
              <Activity className="h-4 w-4" /> Live Dashboard
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
          ZION TerraNova v2.9.7 — L1 TerraNova · L2 NCL · L3 DAO · L4 Oasis · L5 Free World · L6 ZION Issobella · &quot;On the Star — 6-Layer Architecture&quot; · Poslední aktualizace: 2026-03-03
        </p>
      </div>
    </div>
  );
}
