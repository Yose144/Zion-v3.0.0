"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { motion } from "framer-motion";
import ProSearchBar from "@/components/explorer/ProSearchBar";
import { useLang } from '@/contexts/LanguageContext';

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

const getQuickLinks = (cs: boolean) => [
  {
    title: ExplorerCopy.blockArchive[cs ? 'cs' : 'en'],
    description: ExplorerCopy.completeLedgerOfAllValidatedBl[cs ? 'cs' : 'en'],
    href: '/explorer/blocks',
    accent: 'from-zion-gold/80 to-zion-gold/80',
    icon: Layers,
  },
  {
    title: ExplorerCopy.transactionFeed[cs ? 'cs' : 'en'],
    description: ExplorerCopy.realTimeFlowOfFundsAndFees[cs ? 'cs' : 'en'],
    href: '/explorer/transactions',
    accent: 'from-zion-cyan/80 to-zion-purple/80',
    icon: Activity,
  },
  {
    title: ExplorerCopy.mempool[cs ? 'cs' : 'en'],
    description: ExplorerCopy.pendingTransactionsFeeHistogra[cs ? 'cs' : 'en'],
    href: '/explorer/mempool',
    accent: 'from-zion-gold/80 to-zion-gold/80',
    icon: Flame,
  },
  {
    title: ExplorerCopy.bridgeTracker[cs ? 'cs' : 'en'],
    description: ExplorerCopy.liveL1BaseBridgeStatusLockMint[cs ? 'cs' : 'en'],
    href: '/explorer/bridge',
    accent: 'from-zion-purple/80 to-zion-cyan/80',
    icon: ArrowLeftRight,
  },
  {
    title: ExplorerCopy.networkPeers[cs ? 'cs' : 'en'],
    description: ExplorerCopy.globalNodeConnectivityMap[cs ? 'cs' : 'en'],
    href: '#peers',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: Globe,
  },
  {
    title: ExplorerCopy.supplyDashboard[cs ? 'cs' : 'en'],
    description: ExplorerCopy.circulatingMinedPremineDecadeD[cs ? 'cs' : 'en'],
    href: '/explorer/supply',
    accent: 'from-zion-cyan/80 to-zion-cyan/80',
    icon: BarChart3,
  },
  {
    title: ExplorerCopy.chartsAnalytics[cs ? 'cs' : 'en'],
    description: ExplorerCopy.historicalDifficultyHashrateEm[cs ? 'cs' : 'en'],
    href: '#charts',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: TrendingUp,
  },
  {
    title: ExplorerCopy.networkStats[cs ? 'cs' : 'en'],
    description: ExplorerCopy.hashrateDifficultyBlockTimeTxT[cs ? 'cs' : 'en'],
    href: '/explorer/network-stats',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: Network,
  },
  {
    title: ExplorerCopy.search[cs ? 'cs' : 'en'],
    description: ExplorerCopy.unifiedSearchForBlocksTransact[cs ? 'cs' : 'en'],
    href: '/explorer/search',
    accent: 'from-zion-cyan/80 to-zion-purple/80',
    icon: Search,
  },
  {
    title: ExplorerCopy.explorerApi[cs ? 'cs' : 'en'],
    description: ExplorerCopy.directJsonEndpointsForIntegrat[cs ? 'cs' : 'en'],
    href: '/api-reference',
    accent: 'from-zion-purple/80 to-zion-purple/80',
    icon: ExternalLink,
  },
];

export default function ExplorerPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const quickLinks = getQuickLinks(cs);

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
                ZION Mainnet · {ExplorerCopy.explorerPro[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{ExplorerCopy.realTime[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerCopy.blockchainExplorer[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? `Prozkoumejte bloky, transakce a adresy na živém ZION mainnetu. Transparentní, rychlý a otevřený blockchain explorer s aktuálními daty sítě.`
                  : `Explore blocks, transactions and addresses on the live ZION mainnet. A transparent, fast and open blockchain explorer with live network data.`}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="zion-badge zion-badge-gold">
                  <Sparkles className="h-3 w-3" /> {ExplorerCopy.liveMainnetData[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-badge zion-badge-green">
                  <Activity className="h-3 w-3" /> {ExplorerCopy.autoRefresh15s[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-badge text-zion-cyan border-zion-cyan/40 bg-zion-cyan/10">
                  <Globe className="h-3 w-3" /> {ExplorerCopy.k2NodeMesh[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-badge zion-badge-green">
                  {ExplorerCopy.trinity1111Services[cs ? 'cs' : 'en']}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/explorer/api-docs" className="zion-button-secondary">
                  <Code className="h-4 w-4" /> {ExplorerCopy.apiDocs[cs ? 'cs' : 'en']}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.telemetry[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {ExplorerCopy.networkStatistics[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.realTimeMetricsFromTheZionBloc[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.ledger[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              {ExplorerCopy.blocksTransactions[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.latestConfirmedBlocksAndTransa[cs ? 'cs' : 'en']}</p>
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
                    <h3 className="text-base font-semibold text-white">{ExplorerCopy.quickNavigation[cs ? 'cs' : 'en']}</h3>
                    <p className="text-[11px] text-gray-500">{ExplorerCopy.jumpToSection[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.networkFeatures[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-zion-gold" />
              {ExplorerCopy.v32Ledger[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {ExplorerCopy.newFeaturesAndSecurityPatchesV[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: ExplorerCopy.accountModelMemo[cs ? 'cs' : 'en'],
                detail: ExplorerCopy.txMemoFieldForBridgeDaoAndSwap[cs ? 'cs' : 'en'],
                accent: 'text-zion-cyan',
              },
              {
                title: ExplorerCopy.f47F5Patches[cs ? 'cs' : 'en'],
                detail: ExplorerCopy.maxTxAmountCapAndSenderBalance[cs ? 'cs' : 'en'],
                accent: 'text-zion-cyan',
              },
              {
                title: ExplorerCopy.k2NodeRpcMesh[cs ? 'cs' : 'en'],
                detail: ExplorerCopy.rpcAutoFailoverAcrossEdge18443[cs ? 'cs' : 'en'],
                accent: 'text-zion-purple',
              },
              {
                title: ExplorerCopy.memoryLeakFix[cs ? 'cs' : 'en'],
                detail: ExplorerCopy.poolNodeMemoryLeaksFixedWatchd[cs ? 'cs' : 'en'],
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.analytics[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-zion-purple" />
              {ExplorerCopy.networkCharts[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.historicalDifficultyHashrateEm_2[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.supply[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-gold" />
              {ExplorerCopy.emissionMonitor[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.trackMiningProgressDecadeDecay[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.p2pNetwork[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-cyan" />
              {ExplorerCopy.networkPeers[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.connectivityOfThe2NodeP2pMeshE[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.realTime_2[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Zap className="h-7 w-7 text-zion-gold" />
              {ExplorerCopy.liveBlockFeed[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.newBlocksDeliveredViaServerSen[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerCopy.distribution[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-gold" />
              {ExplorerCopy.richList[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.topZionHoldersByBalancePremine[cs ? 'cs' : 'en']}</p>
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
            {ExplorerCopy.realTimeBlockchainDataFromNati[cs ? 'cs' : 'en']}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {ExplorerCopy.decadeDecayEmission5400724Zion[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/network" className="zion-button-secondary">
              <Globe className="h-4 w-4" /> {ExplorerCopy.networkStatus[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/roadmap" className="zion-button-primary">
              <Activity className="h-4 w-4" /> {ExplorerCopy.roadmap[cs ? 'cs' : 'en']}
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
          {cs
            ? `ZION TerraNova - Blockchain Explorer · Živá data ze sítě`
            : `ZION TerraNova - Blockchain Explorer · Live network data`}
        </p>
      </div>
    </div>
  );
}
