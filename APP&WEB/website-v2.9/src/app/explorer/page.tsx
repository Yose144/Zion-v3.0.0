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
  blockArchive: { cs: `Archiv bloku`, en: `Block Archive` },
  completeLedgerOfAllValidatedBl: { cs: `Kompletní ledger všech validovaných bloků`, en: `Complete ledger of all validated blocks` },
  transactionFeed: { cs: `Tok transakcí`, en: `Transaction Feed` },
  realTimeFlowOfFundsAndFees: { cs: `Tok fondů a fee v reálném čase`, en: `Real-time flow of funds and fees` },
  mempool: { cs: `Mempool`, en: `Mempool` },
  pendingTransactionsFeeHistogra: { cs: `Čekající transakce, fee histogram, double-spend`, en: `Pending transactions, fee histogram, double-spend` },
  bridgeTracker: { cs: `Bridge Tracker`, en: `Bridge Tracker` },
  liveL1BaseBridgeStatusLockMint: { cs: `Live stav L1↔Base mostu, lock/mint/burn/unlock`, en: `Live L1↔Base bridge status, lock/mint/burn/unlock` },
  networkPeers: { cs: `Síťoví peeri`, en: `Network Peers` },
  globalNodeConnectivityMap: { cs: `Globální mapa konektivity nodů`, en: `Global node connectivity map` },
  supplyDashboard: { cs: `Supply Dashboard`, en: `Supply Dashboard` },
  circulatingMinedPremineDecadeD: { cs: `Circulating, vytěženo, premine, Decade Decay`, en: `Circulating, mined, premine, Decade Decay` },
  chartsAnalytics: { cs: `Grafy a analytika`, en: `Charts & Analytics` },
  historicalDifficultyHashrateEm: { cs: `Historická obtížnost, hashrate a emise`, en: `Historical difficulty, hashrate & emission` },
  networkStats: { cs: `Network Stats`, en: `Network Stats` },
  hashrateDifficultyBlockTimeTxT: { cs: `Hashrate, obtížnost, čas bloku, TX trendy`, en: `Hashrate, difficulty, block time, TX trends` },
  search: { cs: `Hledat`, en: `Search` },
  unifiedSearchForBlocksTransact: { cs: `Jednotne hledani bloku, tx a adres`, en: `Unified search for blocks, transactions and addresses` },
  explorerApi: { cs: `API explorera`, en: `Explorer API` },
  directJsonEndpointsForIntegrat: { cs: `Priame JSON endpointy pro integraci a monitoring`, en: `Direct JSON endpoints for integration and monitoring` },
  explorerPro: { cs: `Průzkumník Pro`, en: `Explorer Pro` },
  realTime: { cs: `Živé`, en: `Real-Time` },
  blockchainExplorer: { cs: `Průzkumník blockchainu`, en: `Blockchain Explorer` },
  liveMainnetData: { cs: `Živá mainnet data`, en: `Live Mainnet Data` },
  autoRefresh15s: { cs: `Auto-refresh 15 s`, en: `Auto-Refresh 15s` },
  k2NodeMesh: { cs: `2-uzlový mesh`, en: `2-node mesh` },
  trinity1111Services: { cs: `Trinity · 11/11 služeb`, en: `Trinity · 11/11 services` },
  apiDocs: { cs: `API dokumentace`, en: `API Docs` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  networkStatistics: { cs: `Síťové statistiky`, en: `Network Statistics` },
  realTimeMetricsFromTheZionBloc: { cs: `Metriky v reálném čase z blockchain daemonu ZION.`, en: `Real-time metrics from the ZION blockchain daemon.` },
  ledger: { cs: `Ledger`, en: `Ledger` },
  blocksTransactions: { cs: `Bloky a transakce`, en: `Blocks & Transactions` },
  latestConfirmedBlocksAndTransa: { cs: `Nejnovější potvrzené bloky a tok transakcí ze chainu ZION.`, en: `Latest confirmed blocks and transaction feed from the ZION chain.` },
  quickNavigation: { cs: `Rychlá navigace`, en: `Quick Navigation` },
  jumpToSection: { cs: `Skok do sekce`, en: `Jump to section` },
  v32Ledger: { cs: `Ledger v3.2.0`, en: `v3.2.0 Ledger` },
  newFeaturesAndSecurityPatchesV: { cs: `Nové vlastnosti a bezpečnostní patche ověřené end-to-end na živém mainnetu.`, en: `New features and security patches verified end-to-end on the live mainnet.` },
  accountModelMemo: { cs: `Account-model memo`, en: `Account-model memo` },
  txMemoFieldForBridgeDaoAndSwap: { cs: `TX pole memo pro BRIDGE, DAO a SWAP — E2E potvrzeno v bloku 752.`, en: `TX memo field for BRIDGE, DAO, and SWAP — E2E confirmed in block 752.` },
  f47F5Patches: { cs: `F4.7 + F5 patche`, en: `F4.7 + F5 patches` },
  maxTxAmountCapAndSenderBalance: { cs: `Max-tx-amount cap a sender balance check aktivní od genesis.`, en: `Max-tx-amount cap and sender balance check active from genesis.` },
  k2NodeRpcMesh: { cs: `2-uzlový RPC mesh`, en: `2-node RPC mesh` },
  rpcAutoFailoverAcrossEdge18443: { cs: `RPC auto-failover přes Edge 1 (8443) a Edge 2 (8448). Local Backup je offline.`, en: `RPC auto-failover across Edge 1 (8443) and Edge 2 (8448). Local Backup is offline.` },
  memoryLeakFix: { cs: `Memory leak fix`, en: `Memory leak fix` },
  poolNodeMemoryLeaksFixedWatchd: { cs: `Pool + node memory leak opraveny, watchdog hlídá zdraví.`, en: `Pool + node memory leaks fixed, watchdog monitors health.` },
  analytics: { cs: `Analytika`, en: `Analytics` },
  networkCharts: { cs: `Síťové grafy`, en: `Network Charts` },
  historicalDifficultyHashrateEm_2: { cs: `Historické trendy obtížnosti, hashrate, emise a velikosti bloku.`, en: `Historical difficulty, hashrate, emission, and block size trends.` },
  supply: { cs: `Zasoba`, en: `Supply` },
  emissionMonitor: { cs: `Monitoring emise`, en: `Emission Monitor` },
  trackMiningProgressDecadeDecay: { cs: `Sledujte postup těžby – Decade Decay: 5,400 -> 724 ZION/blok, 100+ let + tail ∞.`, en: `Track mining progress - Decade Decay: 5,400 -> 724 ZION/block, 100+ years + tail ∞.` },
  p2pNetwork: { cs: `P2P síť`, en: `P2P Network` },
  connectivityOfThe2NodeP2pMeshE: { cs: `Konektivita 2-uzlového P2P meshe — Edge 1 a Edge 2 v reálném čase. Local Backup Node je offline.`, en: `Connectivity of the 2-node P2P mesh — Edge 1 and Edge 2 in real time. Local Backup Node is offline.` },
  realTime_2: { cs: `Real-time`, en: `Real-time` },
  liveBlockFeed: { cs: `Živý feed bloků`, en: `Live Block Feed` },
  newBlocksDeliveredViaServerSen: { cs: `Nové bloky doručené přes Server-Sent Events — okamžitě po potvrzení.`, en: `New blocks delivered via Server-Sent Events — instantly upon confirmation.` },
  distribution: { cs: `Distribuce`, en: `Distribution` },
  richList: { cs: `Rich list`, en: `Rich List` },
  topZionHoldersByBalancePremine: { cs: `Top držitelé ZION podle zůstatku – premine alokace, těžební odměny a ekonomika sítě.`, en: `Top ZION holders by balance - premine allocations, mining rewards, and network economics.` },
  realTimeBlockchainDataFromNati: { cs: `Blockchain data v reálném čase z nativních Rust nodů. Každý blok, transakce a adresa – plně transparentní, plně otevřené.`, en: `Real-time blockchain data from native Rust nodes. Every block, transaction, and address - fully transparent, fully open.` },
  decadeDecayEmission5400724Zion: { cs: `Decade Decay emise: 5,400 → 724 ZION/block · 100+ let + tail ∞ · Veškeré fee spáleno · 89/5/5/1 distribuce · Memo E2E potvrzeno v bloku 752 · Public launch 31.12.2026`, en: `Decade Decay emission: 5,400 → 724 ZION/block · 100+ years + tail ∞ · All fees burned · 89/5/5/1 distribution · Memo E2E confirmed in block 752 · Public launch 31.12.2026` },
  networkStatus: { cs: `Stav sítě`, en: `Network Status` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
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
    accent: 'from-zion-gold/80 to-amber-600/80',
    icon: Layers,
  },
  {
    title: ExplorerCopy.transactionFeed[cs ? 'cs' : 'en'],
    description: ExplorerCopy.realTimeFlowOfFundsAndFees[cs ? 'cs' : 'en'],
    href: '/explorer/transactions',
    accent: 'from-zion-cyan/80 to-blue-600/80',
    icon: Activity,
  },
  {
    title: ExplorerCopy.mempool[cs ? 'cs' : 'en'],
    description: ExplorerCopy.pendingTransactionsFeeHistogra[cs ? 'cs' : 'en'],
    href: '/explorer/mempool',
    accent: 'from-amber-500/80 to-orange-600/80',
    icon: Flame,
  },
  {
    title: ExplorerCopy.bridgeTracker[cs ? 'cs' : 'en'],
    description: ExplorerCopy.liveL1BaseBridgeStatusLockMint[cs ? 'cs' : 'en'],
    href: '/explorer/bridge',
    accent: 'from-blue-500/80 to-cyan-600/80',
    icon: ArrowLeftRight,
  },
  {
    title: ExplorerCopy.networkPeers[cs ? 'cs' : 'en'],
    description: ExplorerCopy.globalNodeConnectivityMap[cs ? 'cs' : 'en'],
    href: '#peers',
    accent: 'from-purple-500/80 to-indigo-600/80',
    icon: Globe,
  },
  {
    title: ExplorerCopy.supplyDashboard[cs ? 'cs' : 'en'],
    description: ExplorerCopy.circulatingMinedPremineDecadeD[cs ? 'cs' : 'en'],
    href: '/explorer/supply',
    accent: 'from-emerald-500/80 to-teal-600/80',
    icon: BarChart3,
  },
  {
    title: ExplorerCopy.chartsAnalytics[cs ? 'cs' : 'en'],
    description: ExplorerCopy.historicalDifficultyHashrateEm[cs ? 'cs' : 'en'],
    href: '#charts',
    accent: 'from-rose-500/80 to-pink-600/80',
    icon: TrendingUp,
  },
  {
    title: ExplorerCopy.networkStats[cs ? 'cs' : 'en'],
    description: ExplorerCopy.hashrateDifficultyBlockTimeTxT[cs ? 'cs' : 'en'],
    href: '/explorer/network-stats',
    accent: 'from-violet-500/80 to-purple-600/80',
    icon: Network,
  },
  {
    title: ExplorerCopy.search[cs ? 'cs' : 'en'],
    description: ExplorerCopy.unifiedSearchForBlocksTransact[cs ? 'cs' : 'en'],
    href: '/explorer/search',
    accent: 'from-zion-cyan/80 to-blue-600/80',
    icon: Search,
  },
  {
    title: ExplorerCopy.explorerApi[cs ? 'cs' : 'en'],
    description: ExplorerCopy.directJsonEndpointsForIntegrat[cs ? 'cs' : 'en'],
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
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="zion-badge text-zion-cyan border-zion-cyan/40 bg-zion-cyan/10">
                <SearchCode className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {ExplorerCopy.explorerPro[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{ExplorerCopy.realTime[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerCopy.blockchainExplorer[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? `Prozkoumejte bloky, transakce a adresy na živém mainnetu ZION TerraNova ${SITE_RELEASE_LABEL}. Kanonický runtime běží na ${SITE_RUNTIME_LABEL} — 2-uzlový P2P mesh (Edge 1 + Edge 2), account-model transakce s memo polem, E2E testy potvrzené v bloku 752.`
                  : `Search blocks, transactions, and addresses on the live ZION TerraNova ${SITE_RELEASE_LABEL} mainnet. Canonical runtime runs on ${SITE_RUNTIME_LABEL} — 2-node P2P mesh (Edge 1 + Edge 2), account-model transactions with memo field, E2E tests confirmed in block 752.`}
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
              <Activity className="h-7 w-7 text-emerald-400" />
              {ExplorerCopy.networkStatistics[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{ExplorerCopy.realTimeMetricsFromTheZionBloc[cs ? 'cs' : 'en']}</p>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
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
              <div className="zion-rainbow-card p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
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
                      style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
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

        {/* ═══════ v3.2.0 E2E LEDGER FEATURES ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">v3.2.0 E2E</p>
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
                accent: 'text-emerald-400',
              },
              {
                title: ExplorerCopy.k2NodeRpcMesh[cs ? 'cs' : 'en'],
                detail: ExplorerCopy.rpcAutoFailoverAcrossEdge18443[cs ? 'cs' : 'en'],
                accent: 'text-purple-400',
              },
              {
                title: ExplorerCopy.memoryLeakFix[cs ? 'cs' : 'en'],
                detail: ExplorerCopy.poolNodeMemoryLeaksFixedWatchd[cs ? 'cs' : 'en'],
                accent: 'text-amber-400',
              },
            ].map((card) => (
              <div key={card.title} className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
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
              <BarChart3 className="h-7 w-7 text-purple-400" />
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
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} - Blockchain Explorer Pro · Živá data z 2-uzlového Rust runtime · v3.2.0 E2E Trinity`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} - Blockchain Explorer Pro · Live data from 2-node Rust runtime · v3.2.0 E2E Trinity`}
        </p>
      </div>
    </div>
  );
}
