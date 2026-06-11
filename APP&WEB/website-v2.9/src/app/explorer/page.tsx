"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { motion } from "framer-motion";
import ProSearchBar from "@/components/explorer/ProSearchBar";
import { useLang } from '@/contexts/LanguageContext';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Compass,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Network,
  Rocket,
  Search,
  SearchCode,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const ExplorerDashboard = dynamic(() => import("@/components/explorer/ExplorerDashboard"));
const ProExplorerStats = dynamic(() => import("@/components/explorer/ProExplorerStats"));
const ExplorerCharts = dynamic(() => import("@/components/explorer/ExplorerCharts"));
const EmissionMonitor = dynamic(() => import("@/components/explorer/EmissionMonitor"));
const MempoolFeed = dynamic(() => import("@/components/explorer/MempoolFeed"));
const ProRecentBlocks = dynamic(() => import("@/components/explorer/ProRecentBlocks"));
const ProRecentTransactions = dynamic(() => import("@/components/explorer/ProRecentTransactions"));
const NetworkTicker = dynamic(() => import("@/components/explorer/NetworkTicker"), {
  loading: () => <div className="h-[92px] bg-black/60 animate-pulse" />,
});
const NetworkPeers = dynamic(() => import("@/components/explorer/NetworkPeers"));
const RichListClient = dynamic(() => import("./richlist/RichListClient"));

/* ═══════════════════════════════════════════════════════════
   EXPLORER PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const getQuickLinks = (cs: boolean) => [
  {
    title: cs ? 'Archiv bloku' : 'Block Archive',
    description: cs ? 'Kompletni ledger vsech validovanych bloku' : 'Complete ledger of all validated blocks',
    href: '/explorer/blocks',
    accent: 'from-zion-gold/80 to-amber-600/80',
    icon: Layers,
  },
  {
    title: cs ? 'Tok transakci' : 'Transaction Feed',
    description: cs ? 'Tok fondu a fee v realnem case' : 'Real-time flow of funds and fees',
    href: '/explorer/transactions',
    accent: 'from-zion-cyan/80 to-blue-600/80',
    icon: Activity,
  },
  {
    title: cs ? 'Mempool' : 'Mempool',
    description: cs ? 'Cekajici transakce, fee histogram, double-spend' : 'Pending transactions, fee histogram, double-spend',
    href: '/explorer/mempool',
    accent: 'from-amber-500/80 to-orange-600/80',
    icon: Flame,
  },
  {
    title: cs ? 'Bridge Tracker' : 'Bridge Tracker',
    description: cs ? 'Live stav L1↔Base mostu, lock/mint/burn/unlock' : 'Live L1↔Base bridge status, lock/mint/burn/unlock',
    href: '/explorer/bridge',
    accent: 'from-blue-500/80 to-cyan-600/80',
    icon: ArrowLeftRight,
  },
  {
    title: cs ? 'Sitovi peeri' : 'Network Peers',
    description: cs ? 'Globalni mapa konektivity nodu' : 'Global node connectivity map',
    href: '#peers',
    accent: 'from-purple-500/80 to-indigo-600/80',
    icon: Globe,
  },
  {
    title: cs ? 'Supply Dashboard' : 'Supply Dashboard',
    description: cs ? 'Circulating, vytezeno, premine, Decade Decay' : 'Circulating, mined, premine, Decade Decay',
    href: '/explorer/supply',
    accent: 'from-emerald-500/80 to-teal-600/80',
    icon: BarChart3,
  },
  {
    title: cs ? 'Grafy a analytika' : 'Charts & Analytics',
    description: cs ? 'Historicka obtiznost, hashrate a emise' : 'Historical difficulty, hashrate & emission',
    href: '#charts',
    accent: 'from-rose-500/80 to-pink-600/80',
    icon: TrendingUp,
  },
  {
    title: cs ? 'Network Stats' : 'Network Stats',
    description: cs ? 'Hashrate, obtiznost, cas bloku, TX trendy' : 'Hashrate, difficulty, block time, TX trends',
    href: '/explorer/network-stats',
    accent: 'from-violet-500/80 to-purple-600/80',
    icon: Network,
  },
  {
    title: cs ? 'Hledat' : 'Search',
    description: cs ? 'Jednotne hledani bloku, tx a adres' : 'Unified search for blocks, transactions and addresses',
    href: '/explorer/search',
    accent: 'from-zion-cyan/80 to-blue-600/80',
    icon: Search,
  },
  {
    title: cs ? 'API explorera' : 'Explorer API',
    description: cs ? 'Priame JSON endpointy pro integraci a monitoring' : 'Direct JSON endpoints for integration and monitoring',
    href: '/api-reference',
    accent: 'from-fuchsia-500/80 to-violet-600/80',
    icon: ExternalLink,
  },
];

export default function ExplorerPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const quickLinks = getQuickLinks(cs);

  return (
    <div className="pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ── Live network ticker ── */}
        <div className="zion-panel overflow-hidden">
          <NetworkTicker />
        </div>

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <SearchCode className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? 'Pruzkumnik Pro' : 'Explorer Pro'}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'Zive' : 'Real-Time'}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'Průzkumník blockchainu' : 'Blockchain Explorer'}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Search blocks, transactions, and addresses on the current ZION TerraNova {SITE_RELEASE_LABEL} controlled V3 Core + Edge mainnet.
                Canonical runtime stays on {SITE_RUNTIME_LABEL}.
                Smart hash resolver, live data from the current Edge VPS runtime, and auto-refresh every 10 seconds.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {cs ? 'Zive mainnet data' : 'Live Mainnet Data'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Activity className="h-3 w-3 text-emerald-400" /> {cs ? 'Auto-refresh 15 s' : 'Auto-Refresh 15s'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Globe className="h-3 w-3 text-zion-cyan" /> Core + Edge
                </span>
              </div>
            </div>
            <div className="w-full lg:max-w-xl">
              <ProSearchBar />
            </div>
          </div>
        </motion.section>

        {/* ═══════ NETWORK STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? 'Sitove statistiky' : 'Network Statistics'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Metriky v realnem case z blockchain daemonu ZION.' : 'Real-time metrics from the ZION blockchain daemon.'}</p>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/8 bg-white/3 p-4 animate-pulse">
                    <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
                    <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                    <div className="h-6 w-20 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            }
          >
            <ProExplorerStats />
          </Suspense>
        </motion.section>

        {/* ═══════ MAIN CONTENT: Tables + Sidebar ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Ledger' : 'Ledger'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              {cs ? 'Bloky a transakce' : 'Blocks & Transactions'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Nejnovejsi potvrzene bloky a tok transakci ze chainu ZION.' : 'Latest confirmed blocks and transaction feed from the ZION chain.'}</p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-6">
              <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[500px]" />}>
                <ProRecentBlocks />
              </Suspense>
              <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[500px]" />}>
                <ProRecentTransactions />
              </Suspense>
            </div>

            <div className="space-y-6">
              <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-80" />}>
                <ExplorerDashboard />
              </Suspense>
              <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[280px]" />}>
                <MempoolFeed />
              </Suspense>

              {/* Quick Navigator */}
              <div className="zion-panel rounded-4xl bg-black/60 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-zion-gold/10">
                    <Compass className="h-4.5 w-4.5 text-zion-gold" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{cs ? 'Rychla navigace' : 'Quick Navigation'}</h3>
                    <p className="text-[11px] text-gray-500">{cs ? 'Skok do sekce' : 'Jump to section'}</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.title}
                      href={link.href}
                      className="group flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 p-3 transition-all duration-200 hover:border-white/15 hover:bg-white/4"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${link.accent}
                        opacity-80 transition group-hover:opacity-100`}>
                        <link.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{link.title}</p>
                        <p className="text-[11px] text-gray-500 truncate">{link.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ CHARTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          id="charts"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Analytika' : 'Analytics'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-purple-400" />
              {cs ? 'Sitove grafy' : 'Network Charts'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Historicke trendy obtiznosti, hashrate, emise a velikosti bloku.' : 'Historical difficulty, hashrate, emission, and block size trends.'}</p>
          </div>
          <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[400px]" />}>
            <ExplorerCharts />
          </Suspense>
        </motion.section>

        {/* ═══════ EMISSION MONITOR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Zasoba' : 'Supply'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-gold" />
              {cs ? 'Monitoring emise' : 'Emission Monitor'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Sledujte postup tezby - Decade Decay: 5,400 -> 724 ZION/blok, 100+ let + tail ∞.' : 'Track mining progress - Decade Decay: 5,400 -> 724 ZION/block, 100+ years + tail ∞.'}</p>
          </div>
          <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[280px]" />}>
            <EmissionMonitor />
          </Suspense>
        </motion.section>

        {/* ═══════ NETWORK PEERS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          id="peers"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'P2P sit' : 'P2P Network'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Sitovi peeri' : 'Network Peers'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Konektivita aktualniho verejneho hostu s archivovanou historii multi-host validace.' : 'Current public host connectivity with archived multi-host validation history.'}</p>
          </div>
          <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[280px]" />}>
            <NetworkPeers />
          </Suspense>
        </motion.section>

        {/* ═══════ RICH LIST (embedded) ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          id="richlist"
          className="scroll-mt-28"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Distribuce' : 'Distribution'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-gold" />
              {cs ? 'Rich list' : 'Rich List'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Top drzitele ZION podle zustatku - premine alokace, tezebni odmeny a ekonomika site.' : 'Top ZION holders by balance - premine allocations, mining rewards, and network economics.'}</p>
          </div>
          <Suspense fallback={<div className="rounded-4xl border border-white/8 bg-black/60 animate-pulse h-[400px]" />}>
            <RichListClient embedded />
          </Suspense>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26 }}
          className="rounded-4xl border border-zion-cyan/30 bg-linear-to-r from-zion-cyan/20 via-zion-purple/10 to-zion-cyan/20 p-5 sm:p-8 md:p-10 text-center"
        >
          <SearchCode className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">ZION TerraNova Explorer</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs ? 'Blockchain data v realnem case z nativnich Rust nodu. Kazdy blok, transakce a adresa - plne transparentni, plne otevrene.' : 'Real-time blockchain data from native Rust nodes. Every block, transaction, and address - fully transparent, fully open.'}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            Decade Decay emise: 5,400 → 724 ZION/block · 100+ let + tail ∞ · All fees burned · 89/5/5/1 distribuce · Public launch target 31.12.2026
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/network" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Globe className="h-4 w-4" /> {cs ? 'Stav site' : 'Network Status'}
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-cyan to-zion-purple px-6 py-3 text-sm font-semibold text-black">
              <Activity className="h-4 w-4" /> {cs ? 'Roadmapa' : 'Roadmap'}
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
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} - Blockchain Explorer Pro · Data v realnem case z nativniho Rust runtime · Core + Edge topologie`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} - Blockchain Explorer Pro · Real-time data from native Rust runtime · Core + Edge topology`}
        </p>
      </div>
    </div>
  );
}
