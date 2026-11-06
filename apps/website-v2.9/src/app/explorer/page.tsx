"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { motion } from "framer-motion";
import ProSearchBar from "@/components/explorer/ProSearchBar";
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Code,
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
  Zap,
} from "lucide-react";

const ExplorerCopy = {
  blockArchive: { cs: `Bloky`, en: `Blocks` },
  completeLedgerOfAllValidatedBl: { cs: `Kompletní ledger všech validovaných bloků`, en: `Complete ledger of all validated blocks` },
  transactionFeed: { cs: `Transakce`, en: `Transactions` },
  realTimeFlowOfFundsAndFees: { cs: `Transakce a fee v reálném čase`, en: `Real-time transactions and fees` },
  mempool: { cs: `Mempool`, en: `Mempool` },
  pendingTransactionsFeeHistogra: { cs: `Čekající transakce a fee histogram`, en: `Pending transactions and fee histogram` },
  bridgeTracker: { cs: `Bridge Tracker`, en: `Bridge Tracker` },
  liveL1BaseBridgeStatusLockMint: { cs: `Stav cross-chain bridge`, en: `Cross-chain bridge status` },
  networkPeers: { cs: `Síťové peery`, en: `Network Peers` },
  globalNodeConnectivityMap: { cs: `Globální mapa konektivity uzlů`, en: `Global node connectivity map` },
  supplyDashboard: { cs: `Supply`, en: `Supply` },
  circulatingMinedPremineDecadeD: { cs: `Cirkulující, vytěžené a celkové zásoby`, en: `Circulating, mined and total supply` },
  chartsAnalytics: { cs: `Grafy`, en: `Charts` },
  historicalDifficultyHashrateEm: { cs: `Historická obtížnost, hashrate a emise`, en: `Historical difficulty, hashrate and emission` },
  networkStats: { cs: `Statistiky sítě`, en: `Network Stats` },
  hashrateDifficultyBlockTimeTxT: { cs: `Hashrate, obtížnost, čas bloku a TX trendy`, en: `Hashrate, difficulty, block time and TX trends` },
  search: { cs: `Hledat`, en: `Search` },
  unifiedSearchForBlocksTransact: { cs: `Hledání bloků, transakcí a adres`, en: `Search blocks, transactions and addresses` },
  explorerApi: { cs: `API`, en: `API` },
  directJsonEndpointsForIntegrat: { cs: `JSON endpointy pro integraci a monitoring`, en: `JSON endpoints for integration and monitoring` },
  explorerPro: { cs: `Explorer`, en: `Explorer` },
  realTime: { cs: `Reálný čas`, en: `Real-Time` },
  blockchainExplorer: { cs: `Blockchain Explorer`, en: `Blockchain Explorer` },
  liveMainnetData: { cs: `Živá mainnet data`, en: `Live Mainnet Data` },
  autoRefresh15s: { cs: `Auto-refresh 15 s`, en: `Auto-Refresh 15s` },
  k2NodeMesh: { cs: `Síť uzlů`, en: `Node Mesh` },
  trinity1111Services: { cs: `Plně funkční`, en: `Fully Operational` },
  apiDocs: { cs: `API dokumentace`, en: `API Docs` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  networkStatistics: { cs: `Síťové statistiky`, en: `Network Statistics` },
  realTimeMetricsFromTheZionBloc: { cs: `Metriky v reálném čase z blockchainu ZION.`, en: `Real-time metrics from the ZION blockchain.` },
  ledger: { cs: `Ledger`, en: `Ledger` },
  blocksTransactions: { cs: `Bloky a transakce`, en: `Blocks & Transactions` },
  latestConfirmedBlocksAndTransa: { cs: `Nejnovější potvrzené bloky a transakce ze sítě ZION.`, en: `Latest confirmed blocks and transactions from the ZION network.` },
  quickNavigation: { cs: `Rychlá navigace`, en: `Quick Navigation` },
  jumpToSection: { cs: `Skok do sekce`, en: `Jump to section` },
  v32Ledger: { cs: `Funkce sítě`, en: `Network Features` },
  newFeaturesAndSecurityPatchesV: { cs: `Přehled klíčových vlastností a zabezpečení sítě.`, en: `Overview of key network features and security.` },
  accountModelMemo: { cs: `Memo pole`, en: `Memo Field` },
  txMemoFieldForBridgeDaoAndSwap: { cs: `Každá transakce může nést volitelný veřejný memo text.`, en: `Every transaction can carry an optional public memo text.` },
  f47F5Patches: { cs: `Ověření transakcí`, en: `Transaction Validation` },
  maxTxAmountCapAndSenderBalance: { cs: `Maximální částka a kontrola zůstatku odesílatele.`, en: `Maximum amount cap and sender balance verification.` },
  k2NodeRpcMesh: { cs: `Decentralizovaná síť`, en: `Decentralized Network` },
  rpcAutoFailoverAcrossEdge18443: { cs: `Distribuovaná RPC infrastruktura pro vysokou dostupnost.`, en: `Distributed RPC infrastructure for high availability.` },
  memoryLeakFix: { cs: `Stabilní infrastruktura`, en: `Stable Infrastructure` },
  poolNodeMemoryLeaksFixedWatchd: { cs: `Node a pool běží s watchdogem a kontinuálním health-checkem.`, en: `Node and pool run with watchdog and continuous health checks.` },
  analytics: { cs: `Analytika`, en: `Analytics` },
  networkCharts: { cs: `Síťové grafy`, en: `Network Charts` },
  historicalDifficultyHashrateEm_2: { cs: `Historické trendy obtížnosti, hashrate, emise a velikosti bloku.`, en: `Historical difficulty, hashrate, emission and block size trends.` },
  supply: { cs: `Zasoba`, en: `Supply` },
  emissionMonitor: { cs: `Monitoring emise`, en: `Emission Monitor` },
  trackMiningProgressDecadeDecay: { cs: `Sledujte postup těžby a emisi podle Decade Decay modelu.`, en: `Track mining progress and emission under the Decade Decay model.` },
  p2pNetwork: { cs: `P2P síť`, en: `P2P Network` },
  connectivityOfThe2NodeP2pMeshE: { cs: `Globální P2P konektivita sítě ZION v reálném čase.`, en: `Global ZION P2P network connectivity in real time.` },
  realTime_2: { cs: `Real-time`, en: `Real-time` },
  liveBlockFeed: { cs: `Živý feed bloků`, en: `Live Block Feed` },
  newBlocksDeliveredViaServerSen: { cs: `Nové bloky doručeny okamžitě po potvrzení.`, en: `New blocks delivered instantly upon confirmation.` },
  distribution: { cs: `Distribuce`, en: `Distribution` },
  richList: { cs: `Rich list`, en: `Rich List` },
  topZionHoldersByBalancePremine: { cs: `Top držitelé ZION podle zůstatku.`, en: `Top ZION holders by balance.` },
  realTimeBlockchainDataFromNati: { cs: `Blockchain data v reálném čase z uzlů ZION. Každý blok, transakce a adresa – plně transparentní, plně otevřené.`, en: `Real-time blockchain data from ZION nodes. Every block, transaction, and address — fully transparent, fully open.` },
  decadeDecayEmission5400724Zion: { cs: `Decade Decay emise: 5,400 → 724 ZION/block · 100+ let + tail ∞ · Veškeré fee spáleno · 89/5/5/1 distribuce.`, en: `Decade Decay emission: 5,400 → 724 ZION/block · 100+ years + tail ∞ · All fees burned · 89/5/5/1 distribution.` },
  networkStatus: { cs: `Stav sítě`, en: `Network Status` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  networkFeatures: { cs: `Síť`, en: `Network` },
};

const ExplorerDashboard = dynamic(() => import("@/components/explorer/ExplorerDashboard"), { ssr: false });
const ProExplorerStats = dynamic(() => import("@/components/explorer/ProExplorerStats"), { ssr: false });
const ExplorerCharts = dynamic(() => import("@/components/explorer/ExplorerCharts"), { ssr: false });
const EmissionMonitor = dynamic(() => import("@/components/explorer/EmissionMonitor"), { ssr: false });
const MempoolFeed = dynamic(() => import("@/components/explorer/MempoolFeed"), { ssr: false });
const ProRecentBlocks = dynamic(() => import("@/components/explorer/ProRecentBlocks"), { ssr: false });
const ProRecentTransactions = dynamic(() => import("@/components/explorer/ProRecentTransactions"), { ssr: false });
const NetworkPeers = dynamic(() => import("@/components/explorer/NetworkPeers"), { ssr: false });
const RichListClient = dynamic(() => import("./richlist/RichListClient"), { ssr: false });
const SseBlockFeed = dynamic(() => import("@/components/explorer/v4/dashboard/SseBlockFeed"), { ssr: false });

/* ═══════════════════════════════════════════════════════════
   EXPLORER PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const getQuickLinks = (cs: boolean, lang: Lang) => [
  {
    title: tx5(ExplorerCopy.blockArchive, lang),
    description: tx5(ExplorerCopy.completeLedgerOfAllValidatedBl, lang),
    href: '/explorer/blocks',
    accent: 'from-zion-gold/80 to-zion-gold/80',
    icon: Layers,
  },
  {
    title: tx5(ExplorerCopy.transactionFeed, lang),
    description: tx5(ExplorerCopy.realTimeFlowOfFundsAndFees, lang),
    href: '/explorer/transactions',
    accent: 'from-zion-cyan/80 to-zion-purple/80',
    icon: Activity,
  },
  {
    title: tx5(ExplorerCopy.mempool, lang),
    description: tx5(ExplorerCopy.pendingTransactionsFeeHistogra, lang),
    href: '/explorer/mempool',
    accent: 'from-zion-gold/80 to-zion-gold/80',
    icon: Flame,
  },
  {
    title: tx5(ExplorerCopy.bridgeTracker, lang),
    description: tx5(ExplorerCopy.liveL1BaseBridgeStatusLockMint, lang),
    href: '/explorer/bridge',
    accent: 'from-zion-purple/80 to-zion-cyan/80',
    icon: ArrowLeftRight,
  },
  {
    title: tx5(ExplorerCopy.networkPeers, lang),
    description: tx5(ExplorerCopy.globalNodeConnectivityMap, lang),
    href: '#peers',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: Globe,
  },
  {
    title: tx5(ExplorerCopy.supplyDashboard, lang),
    description: tx5(ExplorerCopy.circulatingMinedPremineDecadeD, lang),
    href: '/explorer/supply',
    accent: 'from-zion-cyan/80 to-zion-cyan/80',
    icon: BarChart3,
  },
  {
    title: tx5(ExplorerCopy.chartsAnalytics, lang),
    description: tx5(ExplorerCopy.historicalDifficultyHashrateEm, lang),
    href: '#charts',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: TrendingUp,
  },
  {
    title: tx5(ExplorerCopy.networkStats, lang),
    description: tx5(ExplorerCopy.hashrateDifficultyBlockTimeTxT, lang),
    href: '/explorer/network-stats',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: Network,
  },
  {
    title: tx5(ExplorerCopy.search, lang),
    description: tx5(ExplorerCopy.unifiedSearchForBlocksTransact, lang),
    href: '/explorer/search',
    accent: 'from-zion-cyan/80 to-zion-purple/80',
    icon: Search,
  },
  {
    title: tx5(ExplorerCopy.explorerApi, lang),
    description: tx5(ExplorerCopy.directJsonEndpointsForIntegrat, lang),
    href: '/api-reference',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: ExternalLink,
  },
];

export default function ExplorerPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const quickLinks = getQuickLinks(cs, lang);

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14 pt-6">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="zion-badge text-zion-cyan border-zion-cyan/40 bg-zion-cyan/10">
                <SearchCode className="h-4 w-4" />
                ZION Mainnet · {tx5(ExplorerCopy.explorerPro, lang)}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{tx5(ExplorerCopy.realTime, lang)}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {tx5(ExplorerCopy.blockchainExplorer, lang)}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs ? `Prozkoumejte bloky, transakce a adresy na živém ZION mainnetu. Transparentní, rychlý a otevřený blockchain explorer s aktuálními daty sítě.` : t5(`Explore blocks, transactions and addresses on the live ZION mainnet. A transparent, fast and open blockchain explorer with live network data.`, lang)}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="zion-badge zion-badge-gold">
                  <Sparkles className="h-3 w-3" /> {tx5(ExplorerCopy.liveMainnetData, lang)}
                </span>
                <span className="zion-badge zion-badge-green">
                  <Activity className="h-3 w-3" /> {tx5(ExplorerCopy.autoRefresh15s, lang)}
                </span>
                <span className="zion-badge text-zion-cyan border-zion-cyan/40 bg-zion-cyan/10">
                  <Globe className="h-3 w-3" /> {tx5(ExplorerCopy.k2NodeMesh, lang)}
                </span>
                <span className="zion-badge zion-badge-green">
                  {tx5(ExplorerCopy.trinity1111Services, lang)}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/explorer/api-docs" className="zion-button-secondary">
                  <Code className="h-4 w-4" /> {tx5(ExplorerCopy.apiDocs, lang)}
                </Link>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.telemetry, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {tx5(ExplorerCopy.networkStatistics, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.realTimeMetricsFromTheZionBloc, lang)}</p>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.ledger, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              {tx5(ExplorerCopy.blocksTransactions, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.latestConfirmedBlocksAndTransa, lang)}</p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-6">
              <Suspense fallback={<div className="zion-section animate-pulse h-[500px]" />}>
                <ProRecentBlocks />
              </Suspense>
              <Suspense fallback={<div className="zion-section animate-pulse h-[500px]" />}>
                <ProRecentTransactions />
              </Suspense>
            </div>

            <div className="space-y-6">
              <Suspense fallback={<div className="zion-section animate-pulse h-80" />}>
                <ExplorerDashboard />
              </Suspense>
              <Suspense fallback={<div className="zion-section animate-pulse h-[280px]" />}>
                <MempoolFeed />
              </Suspense>

              {/* Quick Navigator */}
              <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-zion-gold/10">
                    <Compass className="h-4.5 w-4.5 text-zion-gold" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{tx5(ExplorerCopy.quickNavigation, lang)}</h3>
                    <p className="text-[11px] text-gray-500">{tx5(ExplorerCopy.jumpToSection, lang)}</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.title}
                      href={link.href}
                      className="group flex items-center gap-3 zion-rainbow-sub p-3 transition-all duration-200"
                      style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
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

        {/* ═══════ NETWORK FEATURES ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.networkFeatures, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-zion-gold" />
              {tx5(ExplorerCopy.v32Ledger, lang)}
            </h2>
            <p className="text-sm text-gray-400">
              {tx5(ExplorerCopy.newFeaturesAndSecurityPatchesV, lang)}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: tx5(ExplorerCopy.accountModelMemo, lang),
                detail: tx5(ExplorerCopy.txMemoFieldForBridgeDaoAndSwap, lang),
                accent: 'text-zion-cyan',
              },
              {
                title: tx5(ExplorerCopy.f47F5Patches, lang),
                detail: tx5(ExplorerCopy.maxTxAmountCapAndSenderBalance, lang),
                accent: 'text-zion-cyan',
              },
              {
                title: tx5(ExplorerCopy.k2NodeRpcMesh, lang),
                detail: tx5(ExplorerCopy.rpcAutoFailoverAcrossEdge18443, lang),
                accent: 'text-zion-purple',
              },
              {
                title: tx5(ExplorerCopy.memoryLeakFix, lang),
                detail: tx5(ExplorerCopy.poolNodeMemoryLeaksFixedWatchd, lang),
                accent: 'text-zion-gold',
              },
            ].map((card) => (
              <div key={card.title} className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <h3 className={`text-base font-semibold mb-1 ${card.accent}`}>{card.title}</h3>
                <p className="text-sm text-gray-400">{card.detail}</p>
              </div>
            ))}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.analytics, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-zion-purple" />
              {tx5(ExplorerCopy.networkCharts, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.historicalDifficultyHashrateEm_2, lang)}</p>
          </div>
          <Suspense fallback={<div className="zion-section animate-pulse h-[400px]" />}>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.supply, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-gold" />
              {tx5(ExplorerCopy.emissionMonitor, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.trackMiningProgressDecadeDecay, lang)}</p>
          </div>
          <Suspense fallback={<div className="zion-section animate-pulse h-[280px]" />}>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.p2pNetwork, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-cyan" />
              {tx5(ExplorerCopy.networkPeers, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.connectivityOfThe2NodeP2pMeshE, lang)}</p>
          </div>
          <Suspense fallback={<div className="zion-section animate-pulse h-[280px]" />}>
            <NetworkPeers />
          </Suspense>
        </motion.section>

        {/* ═══════ SSE LIVE BLOCK FEED ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.realTime_2, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Zap className="h-7 w-7 text-zion-gold" />
              {tx5(ExplorerCopy.liveBlockFeed, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.newBlocksDeliveredViaServerSen, lang)}</p>
          </div>
          <Suspense fallback={<div className="zion-section animate-pulse h-[200px]" />}>
            <SseBlockFeed />
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(ExplorerCopy.distribution, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-gold" />
              {tx5(ExplorerCopy.richList, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(ExplorerCopy.topZionHoldersByBalancePremine, lang)}</p>
          </div>
          <Suspense fallback={<div className="zion-section animate-pulse h-[400px]" />}>
            <RichListClient embedded />
          </Suspense>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26 }}
          className="zion-cta-banner"
        >
          <SearchCode className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">ZION TerraNova Explorer</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {tx5(ExplorerCopy.realTimeBlockchainDataFromNati, lang)}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {tx5(ExplorerCopy.decadeDecayEmission5400724Zion, lang)}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/network" className="zion-button-secondary">
              <Globe className="h-4 w-4" /> {tx5(ExplorerCopy.networkStatus, lang)}
            </Link>
            <Link href="/roadmap" className="zion-button-primary">
              <Activity className="h-4 w-4" /> {tx5(ExplorerCopy.roadmap, lang)}
            </Link>
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary"
            >
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs ? `ZION TerraNova - Blockchain Explorer · Živá data ze sítě` : t5(`ZION TerraNova - Blockchain Explorer · Live network data`, lang)}
        </p>
      </div>
    </div>
  );
}
