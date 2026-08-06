"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  HardHat,
  Heart,
  HelpCircle,
  Layers,
  Pickaxe,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Shield,
  Signal,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
const LiveToast = dynamic(() => import('@/components/explorer/LiveToast'));
const Pool24hCharts = dynamic(() => import('@/components/pool/Pool24hCharts'));
const PoolEventsFeed = dynamic(() => import('@/components/pool/PoolEventsFeed'));
const PoolRewardDonut = dynamic(() => import('@/components/pool/PoolRewardDonut'));
const PoolBlocksClient = dynamic(() => import('@/components/pool/PoolBlocksClient'));
const PoolMinersClient = dynamic(() => import('@/components/pool/PoolMinersClient'));
const PoolCalculatorClient = dynamic(() => import('@/components/pool/PoolCalculatorClient'));
const PoolBenchmarksClient = dynamic(() => import('@/components/pool/PoolBenchmarksClient'));
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { SITE_POOL_PRIMARY, SITE_RELEASE_LABEL } from '@/lib/site';

const PoolDashboardCopy = {
  miningPool: { cs: `Těžební pool`, en: `Mining Pool` },
  mineZion: { cs: `Těžte ZION`, en: `Mine ZION` },
  pplnsRewards89Miner5Humanitari: { cs: `Odměny PPLNS · 89 % pro minera · 5 % humanitární tithe · 5 % fond Issobella. Veřejný pool běží na Edge Node 1 jako součást v3.0.6 E2E sítě s 2-uzlovým P2P meshem, RPC audit logem a memory leak fixem.`, en: `PPLNS rewards · 89% miner · 5% humanitarian · 5% Issobella fund. The public pool runs on Edge Node 1 as part of the v3.0.6 E2E network with a 2-node P2P mesh, RPC audit log, and memory leak fix.` },
  liveData: { cs: `Živá data`, en: `Live Data` },
  autoRefresh15s: { cs: `Auto-refresh 15 s`, en: `Auto-Refresh 15s` },
  edgeNode1: { cs: `Edge Node 1`, en: `Edge Node 1` },
  trinity1111Services: { cs: `Trinity · 11/11 služeb`, en: `Trinity · 11/11 services` },
  quickConnect: { cs: `Rychlé připojení`, en: `Quick Connect` },
  gettingStartedGuide: { cs: `Průvodce začátkem`, en: `Getting started guide` },
  poolSections: { cs: `Pool sekce`, en: `Pool sections` },
  overview: { cs: `Přehled`, en: `Overview` },
  blocks: { cs: `Bloky`, en: `Blocks` },
  miners: { cs: `Mineři`, en: `Miners` },
  calculator: { cs: `Kalkulačka`, en: `Calculator` },
  benchmarks: { cs: `Benchmarky`, en: `Benchmarks` },
  invalidZionAddressMustStartWit: { cs: `Neplatná ZION adresa — musí začínat na zion1`, en: `Invalid ZION address — must start with zion1` },
  enterYourZionAddressToViewMine: { cs: `Zadejte svou ZION adresu pro zobrazení statistik minera...`, en: `Enter your ZION address to view miner stats...` },
  searchMiner: { cs: `Najít minera`, en: `Search Miner` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  poolStatistics: { cs: `Statistiky poolu`, en: `Pool Statistics` },
  realTimeMetricsAggregatedFromT: { cs: `Metriky v reálném čase agregované z veřejného pool API na Edge Node 1 (8455).`, en: `Real-time metrics aggregated from the public pool API on Edge Node 1 (8455).` },
  poolHashrate: { cs: `Hashrate poolu`, en: `Pool Hashrate` },
  k24hAvg: { cs: `24h průměr`, en: `24h avg` },
  liveBackendIsNotExportingHashr: { cs: `Živý backend zatím hashrate neexportuje`, en: `Live backend is not exporting hashrate yet` },
  totalComputationalPowerOfAllMi: { cs: `Celkový výpočetní výkon všech minerů v poolu.`, en: `Total computational power of all miners in the pool.` },
  activeMiners: { cs: `Aktivní mineři`, en: `Active Miners` },
  numberOfMinersWhoSubmittedASha: { cs: `Počet minerů, kteří odeslali share za posledních 10 minut.`, en: `Number of miners who submitted a share in the last 10 minutes.` },
  blocksFound: { cs: `Nalezené bloky`, en: `Blocks Found` },
  totalNumberOfBlocksFoundByThis: { cs: `Celkový počet bloků nalezených tímto poolem.`, en: `Total number of blocks found by this pool.` },
  shareEfficiency: { cs: `Efektivita share`, en: `Share Efficiency` },
  ratioOfValidSharesToTotalSubmi: { cs: `Poměr validních shares k celkovým odevzdaným.`, en: `Ratio of valid shares to total submitted shares.` },
  acceptRate: { cs: `Míra přijetí`, en: `Accept Rate` },
  percentageOfSharesAcceptedByTh: { cs: `Procento share přijatých poolem (validních řešení).`, en: `Percentage of shares accepted by the pool (valid solutions).` },
  rejectedShares: { cs: `Odmítnuté shares`, en: `Rejected Shares` },
  numberOfRejectedSharesOftenCau: { cs: `Počet odmítnutých share — často způsobený duplicitním řešením nebo špatnou obtížností.`, en: `Number of rejected shares — often caused by duplicate solutions or stale difficulty.` },
  serversOnline: { cs: `Servery online`, en: `Servers Online` },
  numberOfAvailablePoolServers: { cs: `Počet dostupných pool serverů.`, en: `Number of available pool servers.` },
  minerShare: { cs: `Podíl minera`, en: `Miner Share` },
  percentageOfRewardGoingToTheMi: { cs: `Procento odměny, které získá miner (zbytek jde na fondy a fee).`, en: `Percentage of reward going to the miner (rest goes to funds and fee).` },
  pplnsWindowFillDeterminesHowMa: { cs: `Naplnění PPLNS okna — určuje, kolik posledních share se započítává do odměn.`, en: `PPLNS window fill — determines how many recent shares count towards rewards.` },
  totalPaid: { cs: `Celkem vyplaceno`, en: `Total Paid` },
  totalZionPaidOutToMinersInPool: { cs: `Celkové množství ZION vyplacené minerům v historii poolu.`, en: `Total ZION paid out to miners in pool history.` },
  networkHashrate: { cs: `Síťový hashrate`, en: `Network Hashrate` },
  offline: { cs: `Offline`, en: `Offline` },
  totalComputationalPowerOfTheEn: { cs: `Celkový výpočetní výkon celé ZION sítě.`, en: `Total computational power of the entire ZION network.` },
  templateFees: { cs: `Template fees`, en: `Template Fees` },
  sumOfFeesFromTransactionsInThe: { cs: `Součet fee z transakcí v aktuálním block template.`, en: `Sum of fees from transactions in the current block template.` },
  poolDataUnavailableServersMayB: { cs: `Data poolu nejsou dostupná. Servery mohou být offline.`, en: `Pool data unavailable. Servers may be offline.` },
  performance: { cs: `Výkon`, en: `Performance` },
  poolPerformance: { cs: `Výkon poolu`, en: `Pool Performance` },
  liveHashrateChartNetworkShareA: { cs: `Živý graf hashrate, podíl na síti a statistika štěstí poolu.`, en: `Live hashrate chart, network share, and pool luck statistics.` },
  poolHashrateLastHour: { cs: `Hashrate poolu (poslední hodina)`, en: `Pool Hashrate (last hour)` },
  k24hAverage: { cs: `24h průměr`, en: `24h average` },
  networkShare: { cs: `Podíl na síti`, en: `Network Share` },
  network: { cs: `Síť`, en: `Network` },
  poolLuck: { cs: `Štěstí poolu`, en: `Pool Luck` },
  found: { cs: `nalezeno`, en: `found` },
  expected: { cs: `očekáváno`, en: `expected` },
  pendingPayouts: { cs: `Čekající výplaty`, en: `Pending Payouts` },
  minersQueued: { cs: `minerů čeká`, en: `miners queued` },
  operations: { cs: `Provoz`, en: `Operations` },
  poolRuntimeOverview: { cs: `Přehled runtime poolu`, en: `Pool Runtime Overview` },
  submissionFlowPplnsEngineFillA: { cs: `Tok submitů, naplnění PPLNS enginu a payout throughput čerpané z živé telemetrie poolu v3.0.6.`, en: `Submission flow, PPLNS engine fill, and payout throughput sourced from live v3.0.6 pool telemetry.` },
  acceptedShares: { cs: `přijaté shares`, en: `accepted shares` },
  submits: { cs: `Submity`, en: `Submits` },
  acceptRate_2: { cs: `Míra přijetí`, en: `Accept rate` },
  windowUtilization: { cs: `Využití okna`, en: `Window utilization` },
  registeredMiners: { cs: `Registrovaní mineři`, en: `Registered miners` },
  payoutRounds: { cs: `Payout kola`, en: `Payout rounds` },
  totalPaid_2: { cs: `Celkem vyplaceno`, en: `Total paid` },
  poolUptime: { cs: `Uptime poolu`, en: `Pool uptime` },
  telemetryStatus: { cs: `Stav telemetrie`, en: `Telemetry status` },
  poolHashrateIsStillUnavailable: { cs: `Hashrate poolu zatím není v živém backend exporteru dostupný, proto stránka upřednostňuje routing, PPLNS a zdraví chain runtime v3.0.6.`, en: `Pool hashrate is still unavailable on the live backend exporter, so the page prioritizes routing, PPLNS, and v3.0.6 chain runtime health.` },
  profitRouter: { cs: `Profit Router`, en: `Profit Router` },
  profitSwitcher: { cs: `Přepínač profitability`, en: `Profit Switcher` },
  bestGpuCoin: { cs: `Nejlepší GPU coin`, en: `Best GPU Coin` },
  bestCpuCoin: { cs: `Nejlepší CPU coin`, en: `Best CPU Coin` },
  lastCheck: { cs: `Poslední kontrola: `, en: `Last check: ` },
  in5Min: { cs: `proběhne za ~5 min`, en: `in ~5 min` },
  coin: { cs: `Coin`, en: `Coin` },
  algorithm: { cs: `Algoritmus`, en: `Algorithm` },
  revenueUsdDay: { cs: `Příjem USD/den`, en: `Revenue USD/day` },
  profitUsdDay: { cs: `Zisk USD/den`, en: `Profit USD/day` },
  type: { cs: `Typ`, en: `Type` },
  infrastructure: { cs: `Infrastruktura`, en: `Infrastructure` },
  poolServers: { cs: `Pool servery`, en: `Pool Servers` },
  currentPublicPoolHostAndStratu: { cs: `Aktuální veřejný pool host a stratum endpoint vystavený na primárním serveru.`, en: `Current public pool host and stratum endpoint exposed on the primary server.` },
  mining: { cs: `Těží`, en: `Mining` },
  idle: { cs: `Nečinný`, en: `Idle` },
  disconnected: { cs: `Odpojen`, en: `Disconnected` },
  activeTotal: { cs: `Aktivní / Celkem`, en: `Active / Total` },
  validShares: { cs: `Validní shares`, en: `Valid Shares` },
  invalid: { cs: `Neplatné`, en: `Invalid` },
  height: { cs: `Výška`, en: `Height` },
  noDataAvailable: { cs: `Data nejsou dostupná`, en: `No data available` },
  directory: { cs: `Adresář`, en: `Directory` },
  recentMinerDirectoryFromTheLiv: { cs: `Aktuální adresář minerů z živého pool backendu. Pro detail konkrétní adresy použijte vyhledávání výše.`, en: `Recent miner directory from the live pool backend. Use miner search for full address-level detail.` },
  activeOnly: { cs: `Jen aktivní`, en: `Active only` },
  allMiners: { cs: `Všichni mineři`, en: `All miners` },
  minerWorker: { cs: `Miner / Worker`, en: `Miner / Worker` },
  payoutAddress: { cs: `Payout adresa`, en: `Payout Address` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  shares: { cs: `Shares`, en: `Shares` },
  server: { cs: `Server`, en: `Server` },
  lastShare: { cs: `Poslední share`, en: `Last Share` },
  status: { cs: `Stav`, en: `Status` },
  active: { cs: `Aktivní`, en: `Active` },
  inactive: { cs: `Neaktivní`, en: `Inactive` },
  liveBackendIsNotExposingRecent: { cs: `Živý backend zatím nezveřejňuje poslední řádky minerů. Pro individuální statistiky vyhledejte adresu výše.`, en: `Live backend is not exposing recent miner rows yet. Search by address above for individual stats.` },
  ledger: { cs: `Ledger`, en: `Ledger` },
  recentNetworkBlocks: { cs: `Poslední síťové bloky`, en: `Recent Network Blocks` },
  latestConfirmedChainBlocksFrom: { cs: `Nejnovější potvrzené chain bloky z aktuálního v3.0.6 runtime. Veřejná atribuce vítěze poolu zatím není vystavena samostatně.`, en: `Latest confirmed chain blocks from the current v3.0.6 runtime. Public pool winner attribution is not exposed separately yet.` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  reward: { cs: `Odměna`, en: `Reward` },
  time: { cs: `Čas`, en: `Time` },
  noRecentChainBlocksAvailable: { cs: `Nejsou dostupné žádné poslední chain bloky`, en: `No recent chain blocks available` },
  gettingStarted: { cs: `Začínáme`, en: `Getting Started` },
  startMiningZion: { cs: `Začněte těžit ZION`, en: `Start Mining ZION` },
  followTheseStepsToBeginMiningI: { cs: `Postupujte podle těchto kroků a začněte těžit během několika minut. ZION používá zion-miner (Rust binárka z V3).`, en: `Follow these steps to begin mining in minutes. ZION uses zion-miner (the Rust binary from V3).` },
  k1GetAZionWallet: { cs: `1. Získejte ZION peněženku`, en: `1. Get a ZION Wallet` },
  valid44CharZion1AddressRequire: { cs: `Vyžadována platná 44-znaková zion1... adresa`, en: `Valid 44-char zion1... address required` },
  downloadTheZionDesktopWalletOr: { cs: `Stáhněte desktop peněženku ZION nebo použijte webovou peněženku pro vytvoření těžební adresy. Pool odmítne připojení bez platné payout adresy.`, en: `Download the ZION desktop wallet or use the web wallet to generate your mining address. The pool rejects connections without a valid payout address.` },
  criticalZionPayoutAddressMustB: { cs: `Kritické: ZION_PAYOUT_ADDRESS musí být platná 44-znaková zion1... adresa. Pool odmítne spojení ("pool closed the connection") bez ní.`, en: `Critical: ZION_PAYOUT_ADDRESS must be a valid 44-char zion1... address. The pool rejects the connection ("pool closed the connection") without it.` },
  downloadWallet: { cs: `Stáhnout peněženku`, en: `Download Wallet` },
  k2BuildTheMiner: { cs: `2. Sestavte miner`, en: `2. Build the Miner` },
  rustToolchainV3Source: { cs: `Rust toolchain + V3 zdroj`, en: `Rust toolchain + V3 source` },
  zionMinerIsTheRustBinaryFromTh: { cs: `zion-miner je Rust binárka z V3 workspace. Sestavte ji přes cargo. Pro GPU přidejte --features gpu-opencl (nebo gpu-cuda, gpu-metal).`, en: `zion-miner is the Rust binary from the V3 workspace. Build it with cargo. For GPU add --features gpu-opencl (or gpu-cuda, gpu-metal).` },
  cpuBuild: { cs: `CPU sestavení`, en: `CPU build` },
  gpuBuildOpencl: { cs: `GPU sestavení (OpenCL)`, en: `GPU build (OpenCL)` },
  nodeSetupGuide: { cs: `Průvodce nastavením`, en: `Node setup guide` },
  moreGuides: { cs: `Více průvodců`, en: `More guides` },
  k3ChooseAlgorithm: { cs: `3. Vyberte algoritmus`, en: `3. Choose Algorithm` },
  k3DeekshaPowVariants: { cs: `3 varianty Deeksha PoW`, en: `3 Deeksha PoW variants` },
  defaultCpuGpuBalanced: { cs: `Výchozí · CPU + GPU · Vyvážený`, en: `Default · CPU + GPU · Balanced` },
  standardDeekshaLiteRecommended: { cs: `Standardní Deeksha Lite — doporučeno pro začátek.`, en: `Standard Deeksha Lite — recommended starting point.` },
  advancedCpuGpu: { cs: `Pokročilý · CPU + GPU`, en: `Advanced · CPU + GPU` },
  ekamV2AdvancedDeekshaVariant: { cs: `Ekam v2 — pokročilejší varianta Deeksha.`, en: `Ekam v2 — advanced Deeksha variant.` },
  thermalIntensive512KibScratchp: { cs: `Teplotně náročný · 512 KiB scratchpad · Vyšší příkon`, en: `Thermal-intensive · 512 KiB scratchpad · Higher power draw` },
  fireHigherHashrateHigherPowerR: { cs: `Fire — vyšší hashrate, vyšší spotřeba. RX 5700 XT: 18.16 KH/s.`, en: `Fire — higher hashrate, higher power. RX 5700 XT: 18.16 KH/s.` },
  k4ConfigureConnect: { cs: `4. Nakonfigurujte a připojte`, en: `4. Configure & Connect` },
  runZionMinerWithTheRightEnvVar: { cs: `Spusťte zion-miner se správnými env vars`, en: `Run zion-miner with the right env vars` },
  cpuMining: { cs: `CPU těžba`, en: `CPU Mining` },
  gpuMining: { cs: `GPU těžba`, en: `GPU Mining` },
  linuxMacosBash: { cs: `Linux / macOS (bash)`, en: `Linux / macOS (bash)` },
  gpuZionGpuBackendOpenclOrCudaM: { cs: `GPU: ZION_GPU_BACKEND=opencl (nebo cuda, metal). ZION_NONCE_COUNT_GPU=262144 je kritické pro GPU hashrate. ZION_LOOP_COUNT=1000000 zabraňuje reconnectům.`, en: `GPU: ZION_GPU_BACKEND=opencl (or cuda, metal). ZION_NONCE_COUNT_GPU=262144 is critical for GPU hashrate. ZION_LOOP_COUNT=1000000 prevents reconnects.` },
  poolAndMinerBinariesMustBeComp: { cs: `Pool a miner binárky musí být zkompilovány ze stejné zdrojové verze — protokol není zpětně kompatibilní.`, en: `Pool and miner binaries must be compiled from the same source version — protocol is not backward compatible.` },
  k5MonitorEarn: { cs: `5. Sledujte a vydělávejte`, en: `5. Monitor & Earn` },
  trackYourRewardsInRealTime: { cs: `Sledujte své odměny v reálném čase`, en: `Track your rewards in real-time` },
  onceConnectedMonitorYourMining: { cs: `Po připojení sledujte své těžební statistiky přímo zde. Výplaty probíhají automaticky po dosažení minimálního prahu.`, en: `Once connected, monitor your mining stats right here. Payouts are automatic when you reach the minimum threshold.` },
  minPayout: { cs: `Min. payout`, en: `Min Payout` },
  rewardMethod: { cs: `Metoda odměn`, en: `Reward Method` },
  poolFee: { cs: `Pool fee`, en: `Pool Fee` },
  coinbaseSplit89Miner5Humanitar: { cs: `Rozdělení coinbase: 89 % miner · 5 % humanitární tithe · 5 % fond Issobella · 1 % pool fee. PPLNS — férová distribuce podle odevzdaných shares.`, en: `Coinbase split: 89% miner · 5% humanitarian tithe · 5% Issobella fund · 1% pool fee. PPLNS — fair distribution based on contributed shares.` },
  openMinerDashboard: { cs: `Otevřít dashboard minera`, en: `Open miner dashboard` },
  features: { cs: `Funkce`, en: `Features` },
  whyMineWithUs: { cs: `Proč těžit s námi`, en: `Why Mine With Us` },
  fairTransparentAndHumanitarian: { cs: `Férový, transparentní a humanitárně zaměřený těžební pool.`, en: `Fair, transparent, and humanitarian-focused mining pool.` },
  deekshaPowAlgorithm: { cs: `Deeksha PoW algoritmus`, en: `Deeksha PoW Algorithm` },
  nativeZionPowCpuGpuAsicResista: { cs: `Nativní ZION PoW, CPU + GPU, odolný vůči ASIC. 3 varianty: Lite v1, Ekam v2, Fire.`, en: `Native ZION PoW, CPU + GPU, ASIC-resistant. 3 variants: Lite v1, Ekam v2, Fire.` },
  humanitarianMission: { cs: `Humanitární mise`, en: `Humanitarian Mission` },
  k5Humanitarian5IssobellaFundMin: { cs: `5 % humanitární tithe + 5 % fond Issobella. Těžba pro vědomí.`, en: `5% humanitarian + 5% Issobella fund. Mining for consciousness.` },
  v306PoolInfrastructure: { cs: `v3.0.6 pool infrastruktura`, en: `v3.0.6 Pool Infrastructure` },
  edgeNode1PoolRealStratumPplns2: { cs: `Edge Node 1 pool, skutečný stratum, PPLNS, 2-uzlový mesh, RPC audit log.`, en: `Edge Node 1 pool, real stratum, PPLNS, 2-node mesh, RPC audit log.` },
  pplnsRewards: { cs: `PPLNS odměny`, en: `PPLNS Rewards` },
  fairRewardDistributionBasedOnY: { cs: `Férová distribuce odměn podle vašich odevzdaných shares. Bez luck variance.`, en: `Fair reward distribution based on your contributed shares. No luck variance.` },
  gpuAcceleration: { cs: `GPU akcelerace`, en: `GPU Acceleration` },
  openclCudaMetalSupportRx5700Xt: { cs: `Podpora OpenCL/CUDA/Metal. RX 5700 XT: 18 KH/s na Fire.`, en: `OpenCL/CUDA/Metal support. RX 5700 XT: 18 KH/s on Fire.` },
  realTimeMonitoring: { cs: `Monitoring v reálném čase`, en: `Real-Time Monitoring` },
  liveHashrateSharesAndEarningsV: { cs: `Živý přehled hashratu, shares a výdělků přes webový dashboard a API.`, en: `Live hashrate, shares, and earnings via web dashboard + API.` },
  proTools: { cs: `Pro nástroje`, en: `Pro Tools` },
  operatorToolkit: { cs: `Nástroje operátora`, en: `Operator Toolkit` },
  failoverTemplatesProfitEstimat: { cs: `Failover šablony, odhad výnosu a automatizační endpointy pro řízený provoz těžby.`, en: `Failover templates, profit estimate, and automation endpoints for managed mining operations.` },
  profitEstimator: { cs: `Odhad výnosu`, en: `Profit Estimator` },
  yourHashrateSupportsKMGT: { cs: `Váš hashrate (podporuje K/M/G/T)`, en: `Your hashrate (supports K/M/G/T)` },
  eG250m: { cs: `např. 250M`, en: `e.g. 250M` },
  parsedHashrate: { cs: `Parsovaný hashrate`, en: `Parsed hashrate` },
  poolShare: { cs: `Podíl v poolu`, en: `Pool share` },
  observedBlocksDay: { cs: `Pozorované bloky/den`, en: `Observed blocks/day` },
  rewardBlock: { cs: `Odměna / blok`, en: `Reward / block` },
  estimatedDailyReward: { cs: `Odhad denní odměny`, en: `Estimated daily reward` },
  failoverConfig: { cs: `Failover konfigurace`, en: `Failover Config` },
  zionMinerPrimaryBackup: { cs: `zion-miner (primární + záložní)`, en: `zion-miner (primary + backup)` },
  forFailoverSwitchZionPoolAddrT: { cs: `Pro failover přepněte ZION_POOL_ADDR na záložní endpoint a restartujte zion-miner. Pool a miner musí být ze stejné zdrojové verze.`, en: `For failover, switch ZION_POOL_ADDR to the backup endpoint and restart zion-miner. Pool and miner must be from the same source version.` },
  automationExport: { cs: `Automatizace a export`, en: `Automation & Export` },
  setAlertIfLastShareExceeds10Mi: { cs: `Nastavte alert: pokud poslední share přesáhne 10 minut nebo míra přijetí klesne pod 95 %, přepněte na záložní endpoint.`, en: `Set alert: if last share exceeds 10 minutes or accept rate drops below 95%, rotate to the backup endpoint.` },
  frequentlyAskedQuestions: { cs: `Časté dotazy`, en: `Frequently Asked Questions` },
  answersToTheMostCommonMinerQue: { cs: `Odpovědi na nejčastější otázky minerů.`, en: `Answers to the most common miner questions.` },
  whatAlgorithmDoesZionUse: { cs: `Jaký algoritmus ZION používá?`, en: `What algorithm does ZION use?` },
  zionUsesDeekshaACustomAsicResi: { cs: `ZION používá Deeksha — vlastní proof-of-work algoritmus odolný vůči ASIC. 3 varianty: Deeksha Lite v1 (výchozí), Ekam v2 (pokročilý), Fire (teplotně náročný, 512 KiB scratchpad). Podporuje CPU i GPU těžbu.`, en: `ZION uses Deeksha — a custom ASIC-resistant proof-of-work algorithm. 3 variants: Deeksha Lite v1 (default), Ekam v2 (advanced), Fire (thermal-intensive, 512 KiB scratchpad). It supports both CPU and GPU mining.` },
  howDoesPplnsWork: { cs: `Jak funguje PPLNS?`, en: `How does PPLNS work?` },
  pplnsPayPerLastNSharesRewardsM: { cs: `PPLNS (Pay Per Last N Shares) odměňuje minery podle jejich příspěvku v posledních N share. Je férovější než proporcionální odměny a penalizuje pool-hopping.`, en: `PPLNS (Pay Per Last N Shares) rewards miners based on their contribution in the last N shares. It is fairer than proportional rewards and penalizes pool-hopping.` },
  whatIsTheMinimumPayout: { cs: `Jaký je minimální payout?`, en: `What is the minimum payout?` },
  whereDoTitheAndFundsGo: { cs: `Kam jdou tithe a fondy?`, en: `Where do tithe and funds go?` },
  coinbaseDistribution89Miner5Hu: { cs: `Distribuce coinbase: 89 % miner, 5 % humanitární tithe, 5 % fond Issobella, 1 % pool fee. Tithe a fondy jsou kódovány přímo v coinbase transakci na chain úrovni.`, en: `Coinbase distribution: 89% miner, 5% humanitarian tithe, 5% Issobella fund, 1% pool fee. Tithe and funds are encoded directly in the coinbase transaction at the chain level.` },
  canIUseXmrig: { cs: `Mohu používat XMRig?`, en: `Can I use XMRig?` },
  noZionUsesDeekshaPowWhichIsNot: { cs: `NE. ZION používá Deeksha PoW, který XMRig nepodporuje. Musíte použít oficiální zion-miner (Rust binárka z V3).`, en: `NO. ZION uses Deeksha PoW, which is not supported by XMRig. You must use the official zion-miner (the Rust binary from V3).` },
  whatDoesPoolLuckMean: { cs: `Co znamená Pool Luck?`, en: `What does Pool Luck mean?` },
  poolLuckShowsTheRatioOfBlocksF: { cs: `Pool Luck ukazuje poměr nalezených bloků vs. statisticky očekávaných na základě hashrate poolu a obtížnosti sítě. 100 % = přesně dle očekávání, nad 100 % = lepší než průměr.`, en: `Pool Luck shows the ratio of blocks found vs. statistically expected based on pool hashrate and network difficulty. 100% = exactly as expected, above 100% = better than average.` },
  howDoISetUpFailover: { cs: `Jak nastavím failover?`, en: `How do I set up failover?` },
  forFailoverSwitchZionPoolAddrT_2: { cs: `Pro failover přepněte ZION_POOL_ADDR na záložní endpoint a restartujte zion-miner. Pool a miner musí být zkompilovány ze stejné zdrojové verze — protokol není zpětně kompatibilní.`, en: `For failover, switch ZION_POOL_ADDR to the backup endpoint and restart zion-miner. Pool and miner must be compiled from the same source version — protocol is not backward compatible.` },
  howOftenArePayoutsProcessed: { cs: `Jak často probíhají výplaty?`, en: `How often are payouts processed?` },
  payoutsAreProcessedAfterEveryB: { cs: `Výplaty se zpracovávají po každém nalezeném bloku. Pool spočítá PPLNS podíly, vytvoří transakci a odešle ji do sítě. Potvrzení trvá obvykle 10 bloků.`, en: `Payouts are processed after every block found. The pool calculates PPLNS shares, creates a transaction, and broadcasts it. Confirmation takes around 10 blocks.` },
  doINeedAGpu: { cs: `Potřebuji GPU?`, en: `Do I need a GPU?` },
  noCpuMiningWorksButGpuOpenclCu: { cs: `Ne, CPU těžba funguje. Ale GPU (OpenCL/CUDA/Metal) dává 10-100x vyšší hashrate. RX 5700 XT dosahuje 18.16 KH/s na Fire.`, en: `No, CPU mining works. But GPU (OpenCL/CUDA/Metal) gives 10-100x more hashrate. RX 5700 XT reaches 18.16 KH/s on Fire.` },
  whatIsZionPayoutAddress: { cs: `Co je ZION_PAYOUT_ADDRESS?`, en: `What is ZION_PAYOUT_ADDRESS?` },
  criticalMustBeAValid44CharZion: { cs: `Kritické: musí být platná 44-znaková zion1... adresa. Pool odmítne spojení ("pool closed the connection") bez ní — fallback na miner_id není povolen.`, en: `Critical: must be a valid 44-char zion1... address. The pool rejects the connection ("pool closed the connection") without it — fallback to miner_id is not allowed.` },
  zionMiningPool: { cs: `ZION těžební pool`, en: `ZION Mining Pool` },
  mineZionWithDeekshaPowAFairTra: { cs: `Těžte ZION s Deeksha PoW — férový a transparentní PoW pool s humanitárním přesahem zabudovaným do každého bloku.`, en: `Mine ZION with Deeksha PoW — a fair, transparent PoW pool with humanitarian impact built into every block.` },
  k89Miner5Humanitarian5Issobella: { cs: `89 % miner · 5 % humanitarian · 5 % Issobella fund · 1 % pool fee · PPLNS · v3.0.6 Trinity · Public launch 31. prosince 2026`, en: `89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · PPLNS · v3.0.6 Trinity · Public launch 31 December 2026` },
  startMining: { cs: `Začít těžit`, en: `Start Mining` },
  lastUpdate: { cs: `Poslední aktualizace`, en: `Last update` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
};

/* ═══════════════════════════════════════════════════════════
   ZION MINING POOL DASHBOARD
   Redesigned to match Explorer visual language
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════ TYPES ═══════════════════════ */
interface PoolServer {
  id: string;
  name: string;
  flag: string;
  host: string;
  stratum: number;
  region: string;
  online: boolean;
  stats: {
    blockchain?: { connected: boolean; height: number; difficulty: number };
    hashrate?: { pool: number; pool_1h: number; pool_24h: number };
    miners?: { active: number; total: number };
    shares?: { valid: number; invalid: number };
    blocks?: { found: number; pending: number };
    pool?: { fee: number; humanitarian_tithe: number; issobella_fund?: number; miner_share: number; version: string; uptime_secs: number };
    pplns_window_size?: number;
    payouts?: { pending_miners: number; pending_total_atomic: number };
  } | null;
}

interface Miner {
  address: string;
  worker_name?: string;
  algorithm?: string;
  backend?: string;
  payout_address?: string;
  last_share: number;
  last_seen?: number;
  hashrate?: number;
  hashrate_1h?: number;
  hashrate_24h?: number;
  blocks_found?: number;
  valid_shares?: number;
  invalid_shares?: number;
  pending_balance?: number;
  server: string;
}

interface Block {
  height: number;
  hash: string;
  difficulty: number;
  reward: number;
  timestamp: number;
  miner_address: string;
  server: string;
}

interface PoolData {
  ok: boolean;
  timestamp: number;
  aggregate: {
    hashrate: number;
    hashrate_24h: number;
    active_miners: number;
    total_miners: number;
    blocks_found: number;
    valid_shares: number;
    invalid_shares: number;
    share_efficiency: string;
    submits_total: number;
    accepted_total: number;
    rejected_total: number;
    accept_rate_pct: number;
  };
  fee: {
    pool_fee: number;
    humanitarian_tithe: number;
    issobella_fund?: number;
    miner_share: number;
    min_payout: number;
    humanitarian_wallet?: string;
    issobella_wallet?: string;
    pool_fee_wallet?: string;
  };
  routing: {
    submits_total: number;
    accepted_total: number;
    rejected_total: number;
    accept_rate_pct: number;
    groups: Record<string, { submits: number; accepted: number }>;
  };
  pplns: {
    registered_miners: number;
    window_size: number;
    window_used: number;
    window_pct: number | null;
    total_paid_flowers: number;
    total_paid_zion: number;
    payout_rounds: number;
  };
  runtime: {
    chain_height: number;
    difficulty: number;
    network_hashrate?: number;
    pool_uptime_seconds: number;
    template_fees_zion: number;
    last_scrape_ts: number;
    data_sources: {
      pool_tcp: boolean;
      core_rpc: boolean;
      prometheus: boolean;
    };
  };
  servers: PoolServer[];
  miners: Miner[];
  recent_blocks: Block[];
  profit_switcher?: {
    enabled: boolean;
    interval_secs: number;
    hysteresis_pct: number;
    best_gpu_coin: string | null;
    best_cpu_coin: string | null;
    best_gpu_profit_usd: number;
    best_cpu_profit_usd: number;
    last_check_unix: number;
    estimates: Array<{
      coin: string;
      algorithm: string;
      revenue_usd_per_day: number;
      power_cost_usd: number;
      profit_usd_per_day: number;
      is_cpu: boolean;
      is_nicehash: boolean;
    }>;
    nicehash_rates: Array<{
      coin: string;
      algorithm: string;
      paying: number;
    }>;
  } | null;
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmtHash(h?: number): string {
  if (!h || h <= 0) return "0 H/s";
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function fmtHashOrPending(h?: number, fallback = 'Pending'): string {
  if (!h || h <= 0) return fallback;
  return fmtHash(h);
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

function fmtDifficulty(d?: number): string {
  if (!d) return "—";
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)} M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(2)} K`;
  return String(d);
}

function timeAgo(ts: number, cs = false): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return cs ? `před ${diff} s` : `${diff}s ago`;
  if (diff < 3600) return cs ? `před ${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return cs ? `před ${Math.floor(diff / 3600)} h` : `${Math.floor(diff / 3600)}h ago`;
  return cs ? `před ${Math.floor(diff / 86400)} d` : `${Math.floor(diff / 86400)}d ago`;
}

function fmtUptime(secs?: number): string {
  if (!secs) return "—";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtPct(value?: number | string | null, digits = 2): string {
  if (value === undefined || value === null) return '—';
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toFixed(digits)}%`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

function formatHashrate(h: number): string {
  if (!h || h <= 0) return '0 H/s';
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
  let i = 0;
  let v = h;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function atomicToZion(atomic: number): string {
  return (atomic / 1e6).toFixed(4);
}

function parseHashrateInput(value: string): number {
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned) return 0;
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([kKmMgGtTpP])?$/);
  if (!match) return Number(cleaned) || 0;
  const base = Number(match[1]) || 0;
  const unit = (match[2] || '').toUpperCase();
  const mult: Record<string, number> = {
    '': 1,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
  };
  return base * (mult[unit] ?? 1);
}

function estimateBlocksPerDay(blocks: Block[]): number {
  if (blocks.length < 2) return 1440;
  const sorted = [...blocks].sort((a, b) => b.timestamp - a.timestamp);
  const newest = sorted[0].timestamp;
  const oldest = sorted[sorted.length - 1].timestamp;
  const span = Math.max(1, newest - oldest);
  const intervals = Math.max(1, sorted.length - 1);
  const avgInterval = span / intervals;
  return Math.max(1, Math.min(10000, 86400 / avgInterval));
}

/* ═══════════════════════ COPY BUTTON ═══════════════════════ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 text-gray-500 hover:text-white transition-colors" title="Copy">
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function PoolDashboard() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [minerSearch, setMinerSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [myHashrateInput, setMyHashrateInput] = useState('100M');
  const [activeOnly, setActiveOnly] = useState(true);
  const [miningMode, setMiningMode] = useState<'cpu' | 'gpu'>('cpu');
  const [minerOS, setMinerOS] = useState<'linux' | 'windows'>('linux');
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'miners' | 'calculator' | 'benchmarks'>('overview');
  const hashrateHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const acceptRateHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const activeMinersHistoryRef = useRef<{ts: number; value: number}[]>([]);
  const [blockHeight, setBlockHeight] = useState(0);
  const router = useRouter();

  const onlineServers = (data?.servers ?? []).filter((s) => s.online);
  const primaryServer = onlineServers[0] ?? data?.servers?.[0];
  const backupServer = onlineServers[1] ?? data?.servers?.[1] ?? onlineServers[0] ?? data?.servers?.[0];
  const myHashrate = parseHashrateInput(myHashrateInput);
  const poolHashrate = data?.aggregate.hashrate ?? 0;
  const rewardPerBlock = data?.recent_blocks?.[0]?.reward ? data.recent_blocks[0].reward / 1e6 : 5400;
  const blocksPerDay = estimateBlocksPerDay(data?.recent_blocks ?? []);
  const mySharePct = poolHashrate > 0 ? (myHashrate / poolHashrate) * 100 : 0;
  const myDailyZion = poolHashrate > 0
    ? (myHashrate / poolHashrate) * blocksPerDay * rewardPerBlock * ((data?.fee.miner_share ?? 89) / 100)
    : 0;

  const miners = data?.miners ?? [];
  const visibleMiners = miners.filter((m) => !activeOnly || now - m.last_share < 600);

  const primaryEndpoint = primaryServer ? `${primaryServer.host}:${primaryServer.stratum}` : SITE_POOL_PRIMARY;
  const backupEndpoint = backupServer ? `${backupServer.host}:${backupServer.stratum}` : primaryEndpoint;
  const zionMinerFailoverCmd = `# Primary pool\nZION_POOL_ADDR=${primaryEndpoint} \\\nZION_WORKER_NAME=my-rig \\\nZION_MINER_ID=worker-01 \\\nZION_PAYOUT_ADDRESS=zion1...your44charaddress \\\nZION_MINER_ALGORITHM=deeksha_lite_v1 \\\nZION_LOOP_COUNT=1000000 \\\ncargo run --release --manifest-path V3/Cargo.toml -p zion-miner\n\n# Failover: switch ZION_POOL_ADDR to backup\nZION_POOL_ADDR=${backupEndpoint} cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`;
  const routingGroups = data?.routing?.groups ? Object.entries(data.routing.groups).filter(([, group]) => group.submits > 0 || group.accepted > 0) : [];

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pool/stats", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json);
        setLastUpdate(new Date());
        const hr = json.aggregate?.hashrate ?? 0;
        const ar = json.aggregate?.accept_rate_pct ?? 0;
        const am = json.aggregate?.active_miners ?? 0;
        const snapTs = Math.floor(Date.now() / 1000);
        hashrateHistoryRef.current = [
          ...hashrateHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: hr }
        ].slice(-60);
        acceptRateHistoryRef.current = [
          ...acceptRateHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: ar }
        ].slice(-60);
        activeMinersHistoryRef.current = [
          ...activeMinersHistoryRef.current.filter((p: {ts: number}) => snapTs - p.ts < 3600),
          { ts: snapTs, value: am }
        ].slice(-60);
        if (json.runtime?.chain_height) {
          setBlockHeight((prev: number) => Math.max(prev, json.runtime.chain_height));
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 15_000);
  usePolling(() => {
    setNow(Math.floor(Date.now() / 1000));
  }, 30_000, { immediate: false });

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows (same as Explorer) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <Pickaxe className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {PoolDashboardCopy.miningPool[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Deeksha PoW</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {PoolDashboardCopy.mineZion[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {PoolDashboardCopy.pplnsRewards89Miner5Humanitari[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {PoolDashboardCopy.liveData[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Activity className="h-3 w-3 text-emerald-400" /> {PoolDashboardCopy.autoRefresh15s[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Globe className="h-3 w-3 text-zion-cyan" /> {PoolDashboardCopy.edgeNode1[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-200">
                  {PoolDashboardCopy.trinity1111Services[cs ? 'cs' : 'en']}
                </span>
              </div>
            </div>
            {/* Stratum quick connect */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{PoolDashboardCopy.quickConnect[cs ? 'cs' : 'en']}</p>
                <div className="space-y-2">
                  {(data?.servers ?? []).filter(s => s.online).map(s => (
                    <div key={s.id} className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                      <div className="flex items-center gap-2">
                        <span>{s.flag}</span>
                        <code className="text-sm text-zion-cyan font-mono">{s.host}:{s.stratum}</code>
                      </div>
                      <CopyButton text={`stratum+tcp://${s.host}:${s.stratum}`} />
                    </div>
                  ))}
                </div>
                <a href="#start-mining" className="mt-3 inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  {PoolDashboardCopy.gettingStartedGuide[cs ? 'cs' : 'en']} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ POOL TABS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                {PoolDashboardCopy.poolSections[cs ? 'cs' : 'en']}
              </span>
              {[
                { id: 'overview', label: PoolDashboardCopy.overview[cs ? 'cs' : 'en'], icon: Activity },
                { id: 'blocks', label: PoolDashboardCopy.blocks[cs ? 'cs' : 'en'], icon: Box },
                { id: 'miners', label: PoolDashboardCopy.miners[cs ? 'cs' : 'en'], icon: Users },
                { id: 'calculator', label: PoolDashboardCopy.calculator[cs ? 'cs' : 'en'], icon: TrendingUp },
                { id: 'benchmarks', label: PoolDashboardCopy.benchmarks[cs ? 'cs' : 'en'], icon: Cpu },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'zion-rainbow-sub text-white'
                        : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white'
                    }`}
                    style={isActive ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
        </motion.section>

        {activeTab === 'overview' && (
        <>
        {/* ═══════ MINER SEARCH ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const addr = minerSearch.trim().toLowerCase();
              if (!addr) return;
              if (!addr.startsWith("zion1") || addr.length < 20) {
                setSearchError(PoolDashboardCopy.invalidZionAddressMustStartWit[cs ? 'cs' : 'en']);
                return;
              }
              setSearchError("");
              router.push(`/pool/miner/${addr}`);
            }}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={minerSearch}
                  onChange={(e) => { setMinerSearch(e.target.value); setSearchError(""); }}
                  placeholder={PoolDashboardCopy.enterYourZionAddressToViewMine[cs ? 'cs' : 'en']}
                  className={`w-full rounded-xl border ${searchError ? 'border-red-500/60' : 'border-white/10'} bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-zion-cyan/50 focus:ring-1 focus:ring-zion-cyan/30 transition-colors font-mono`}
                />
                {searchError && (
                  <p className="absolute -bottom-5 left-0 text-xs text-red-400">{searchError}</p>
                )}
              </div>
              <button
                type="submit"
                className="zion-button-primary text-sm whitespace-nowrap"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                {PoolDashboardCopy.searchMiner[cs ? 'cs' : 'en']}
              </button>
            </div>
          </form>
        </motion.section>

        {/* ═══════ POOL STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.telemetry[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {PoolDashboardCopy.poolStatistics[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.realTimeMetricsAggregatedFromT[cs ? 'cs' : 'en']}</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-6 w-20 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatCard icon={<Activity className="h-5 w-5" />} color="text-emerald-400" bg="bg-emerald-400/10" label={PoolDashboardCopy.poolHashrate[cs ? 'cs' : 'en']} value={fmtHashOrPending(data.aggregate.hashrate)} sub={data.aggregate.hashrate > 0 ? `${PoolDashboardCopy.k24hAvg[cs ? 'cs' : 'en']}: ${fmtHash(data.aggregate.hashrate_24h)}` : (PoolDashboardCopy.liveBackendIsNotExportingHashr[cs ? 'cs' : 'en'])} tip={PoolDashboardCopy.totalComputationalPowerOfAllMi[cs ? 'cs' : 'en']} />
              <StatCard icon={<Users className="h-5 w-5" />} color="text-purple-400" bg="bg-purple-400/10" label={PoolDashboardCopy.activeMiners[cs ? 'cs' : 'en']} value={String(data.aggregate.active_miners)} sub={cs ? `${data.aggregate.total_miners} celkem registrovaných` : `${data.aggregate.total_miners} total registered`} tip={PoolDashboardCopy.numberOfMinersWhoSubmittedASha[cs ? 'cs' : 'en']} />
              <StatCard icon={<Layers className="h-5 w-5" />} color="text-zion-gold" bg="bg-zion-gold/10" label={PoolDashboardCopy.blocksFound[cs ? 'cs' : 'en']} value={fmtNum(data.aggregate.blocks_found)} tip={PoolDashboardCopy.totalNumberOfBlocksFoundByThis[cs ? 'cs' : 'en']} />
              <StatCard icon={<Shield className="h-5 w-5" />} color="text-emerald-400" bg="bg-emerald-400/10" label={PoolDashboardCopy.shareEfficiency[cs ? 'cs' : 'en']} value={`${data.aggregate.share_efficiency}%`} sub={cs ? `${fmtNum(data.aggregate.valid_shares)} validních` : `${fmtNum(data.aggregate.valid_shares)} valid`} tip={PoolDashboardCopy.ratioOfValidSharesToTotalSubmi[cs ? 'cs' : 'en']} />
              <StatCard icon={<Check className="h-5 w-5" />} color="text-teal-400" bg="bg-teal-400/10" label={PoolDashboardCopy.acceptRate[cs ? 'cs' : 'en']} value={fmtPct(data.aggregate.accept_rate_pct)} sub={cs ? `${fmtNum(data.aggregate.accepted_total)} přijatých` : `${fmtNum(data.aggregate.accepted_total)} accepted`} tip={PoolDashboardCopy.percentageOfSharesAcceptedByTh[cs ? 'cs' : 'en']} />
              <StatCard icon={<XCircle className="h-5 w-5" />} color="text-orange-400" bg="bg-orange-400/10" label={PoolDashboardCopy.rejectedShares[cs ? 'cs' : 'en']} value={fmtNum(data.aggregate.rejected_total)} sub={cs ? `${fmtNum(data.aggregate.submits_total)} submitů celkem` : `${fmtNum(data.aggregate.submits_total)} total submits`} tip={PoolDashboardCopy.numberOfRejectedSharesOftenCau[cs ? 'cs' : 'en']} />
              <StatCard icon={<Globe className="h-5 w-5" />} color="text-blue-400" bg="bg-blue-400/10" label={PoolDashboardCopy.serversOnline[cs ? 'cs' : 'en']} value={`${data.servers.filter(s => s.online).length} / ${data.servers.length}`} tip={PoolDashboardCopy.numberOfAvailablePoolServers[cs ? 'cs' : 'en']} />
              <StatCard icon={<Heart className="h-5 w-5" />} color="text-pink-400" bg="bg-pink-400/10" label={PoolDashboardCopy.minerShare[cs ? 'cs' : 'en']} value={`${data.fee.miner_share}%`} sub={cs ? `${data.fee.pool_fee}% fee` : `${data.fee.pool_fee}% fee`} tip={PoolDashboardCopy.percentageOfRewardGoingToTheMi[cs ? 'cs' : 'en']} />
              <StatCard icon={<HardHat className="h-5 w-5" />} color="text-purple-400" bg="bg-purple-400/10" label="PPLNS Fill" value={fmtPct(data.pplns.window_pct)} sub={cs ? `${fmtNum(data.pplns.window_used)} / ${fmtNum(data.pplns.window_size)} share` : `${fmtNum(data.pplns.window_used)} / ${fmtNum(data.pplns.window_size)} shares`} tip={PoolDashboardCopy.pplnsWindowFillDeterminesHowMa[cs ? 'cs' : 'en']} />
              <StatCard icon={<Wallet className="h-5 w-5" />} color="text-zion-gold" bg="bg-zion-gold/10" label={PoolDashboardCopy.totalPaid[cs ? 'cs' : 'en']} value={`${data.pplns.total_paid_zion.toFixed(2)} ZION`} sub={cs ? `${fmtNum(data.pplns.payout_rounds)} payout kol` : `${fmtNum(data.pplns.payout_rounds)} payout rounds`} tip={PoolDashboardCopy.totalZionPaidOutToMinersInPool[cs ? 'cs' : 'en']} />
              <StatCard icon={<Cpu className="h-5 w-5" />} color="text-zion-cyan" bg="bg-zion-cyan/10" label={PoolDashboardCopy.networkHashrate[cs ? 'cs' : 'en']} value={fmtHashOrPending(data.runtime.network_hashrate, PoolDashboardCopy.offline[cs ? 'cs' : 'en'])} sub={cs ? `Výška ${fmtNum(data.runtime.chain_height)}` : `Height ${fmtNum(data.runtime.chain_height)}`} tip={PoolDashboardCopy.totalComputationalPowerOfTheEn[cs ? 'cs' : 'en']} />
              <StatCard icon={<Bell className="h-5 w-5" />} color="text-blue-400" bg="bg-blue-400/10" label={PoolDashboardCopy.templateFees[cs ? 'cs' : 'en']} value={`${data.runtime.template_fees_zion.toFixed(4)} ZION`} sub={cs ? `Obtížnost ${fmtDifficulty(data.runtime.difficulty)}` : `Difficulty ${fmtDifficulty(data.runtime.difficulty)}`} tip={PoolDashboardCopy.sumOfFeesFromTransactionsInThe[cs ? 'cs' : 'en']} />
              {data.servers.filter(s => s.stats?.blockchain?.connected).map(srv => (
                <StatCard
                  key={srv.id}
                  icon={<Signal className="h-5 w-5" />}
                  color="text-zion-cyan"
                  bg="bg-zion-cyan/10"
                  label={`${srv.flag} Height`}
                  value={fmtNum(srv.stats?.blockchain?.height)}
                  sub={`Diff: ${fmtDifficulty(srv.stats?.blockchain?.difficulty)}`}
                />
              ))}
              {data.servers.filter(s => s.stats?.pool?.uptime_secs).map(srv => (
                <StatCard
                  key={`uptime-${srv.id}`}
                  icon={<RefreshCw className="h-5 w-5" />}
                  color="text-teal-400"
                  bg="bg-teal-400/10"
                  label={`${srv.flag} Uptime`}
                  value={fmtUptime(srv.stats?.pool?.uptime_secs)}
                />
              ))}
            </div>
          ) : (
            <div className="zion-rainbow-sub p-6 text-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <p className="text-gray-400">{PoolDashboardCopy.poolDataUnavailableServersMayB[cs ? 'cs' : 'en']}</p>
            </div>
          )}
        </motion.section>

        {/* ═══════ POOL PERFORMANCE ═══════ */}
        {data && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.performance[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
              {PoolDashboardCopy.poolPerformance[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.liveHashrateChartNetworkShareA[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            {/* Hashrate Chart */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{PoolDashboardCopy.poolHashrateLastHour[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{fmtHash(data.aggregate.hashrate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{PoolDashboardCopy.k24hAverage[cs ? 'cs' : 'en']}</p>
                  <p className="text-sm font-mono text-gray-300">{fmtHash(data.aggregate.hashrate_24h)}</p>
                </div>
              </div>
              <HashrateSpark data={hashrateHistoryRef.current} height={120} />
            </div>

            {/* Right column: Network share + Luck + Pending */}
            <div className="space-y-4">
              {/* Network Share */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{PoolDashboardCopy.networkShare[cs ? 'cs' : 'en']}</p>
                {(() => {
                  const netHash = data.runtime.network_hashrate ?? 0;
                  const poolHash = data.aggregate.hashrate ?? 0;
                  const sharePct = netHash > 0 ? (poolHash / netHash) * 100 : 0;
                  return (
                    <>
                      <p className="text-2xl font-bold text-zion-cyan font-mono">{sharePct.toFixed(2)}%</p>
                      <div className="mt-3 h-2.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-zion-cyan to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, sharePct)}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                        <span>Pool: {fmtHash(poolHash)}</span>
                        <span>{PoolDashboardCopy.network[cs ? 'cs' : 'en']}: {fmtHash(netHash)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Pool Luck */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{PoolDashboardCopy.poolLuck[cs ? 'cs' : 'en']}</p>
                {(() => {
                  const netHash = data.runtime.network_hashrate ?? 0;
                  const poolHash = data.aggregate.hashrate ?? 0;
                  const uptime = data.runtime.pool_uptime_seconds ?? 0;
                  const blocksFound = data.aggregate.blocks_found ?? 0;
                  const expectedBlocks = netHash > 0 && uptime > 0 ? (poolHash / netHash) * (uptime / 60) : 0;
                  const luck = expectedBlocks > 0 ? (blocksFound / expectedBlocks) * 100 : 0;
                  const luckColor = luck >= 100 ? 'text-emerald-400' : luck >= 80 ? 'text-zion-gold' : luck >= 50 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <>
                      <p className={`text-2xl font-bold font-mono ${luckColor}`}>{luck > 0 ? `${luck.toFixed(0)}%` : '—'}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {blocksFound} {PoolDashboardCopy.found[cs ? 'cs' : 'en']} / {expectedBlocks.toFixed(1)} {PoolDashboardCopy.expected[cs ? 'cs' : 'en']}
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Pending Payouts */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{PoolDashboardCopy.pendingPayouts[cs ? 'cs' : 'en']}</p>
                {(() => {
                  const srv = data.servers.find(s => s.stats?.payouts);
                  const pending = srv?.stats?.payouts;
                  const pendingZion = pending?.pending_total_atomic ? (pending.pending_total_atomic / 1e6).toFixed(4) : '0';
                  const pendingMiners = pending?.pending_miners ?? 0;
                  return (
                    <>
                      <p className="text-2xl font-bold text-amber-400 font-mono">{pendingZion} ZION</p>
                      <p className="text-[11px] text-gray-500 mt-1">{pendingMiners} {PoolDashboardCopy.minersQueued[cs ? 'cs' : 'en']}</p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.section>
        )}

        {/* ═══════ 24-HOUR POOL TRENDS ═══════ */}
        <Pool24hCharts
          cs={cs}
          hashrateData={hashrateHistoryRef.current.map((p) => p.value)}
          acceptRateData={acceptRateHistoryRef.current.map((p) => p.value)}
          activeMinersData={activeMinersHistoryRef.current.map((p) => p.value)}
        />

        {/* ═══════ POOL OPERATIONS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.operations[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {PoolDashboardCopy.poolRuntimeOverview[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.submissionFlowPplnsEngineFillA[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Routing Flow</p>
                  <h3 className="text-xl font-semibold text-white mt-1">Submission Channels</h3>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  <Signal className="h-3.5 w-3.5 text-zion-cyan" /> {fmtPct(data?.routing?.accept_rate_pct)} accepted
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(routingGroups.length > 0 ? routingGroups : Object.entries(data?.routing?.groups ?? {})).map(([name, group]) => {
                  const groupRate = group.submits > 0 ? (group.accepted / group.submits) * 100 : 0;
                  return (
                    <div key={name} className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-gray-500">{name}</p>
                      <p className="mt-2 text-2xl font-semibold text-white font-mono">{fmtNum(group.accepted)}</p>
                      <p className="text-xs text-gray-500">{PoolDashboardCopy.acceptedShares[cs ? 'cs' : 'en']}</p>
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-gray-400"><span>{PoolDashboardCopy.submits[cs ? 'cs' : 'en']}</span><span className="font-mono text-gray-200">{fmtNum(group.submits)}</span></div>
                        <div className="flex items-center justify-between text-gray-400"><span>{PoolDashboardCopy.acceptRate_2[cs ? 'cs' : 'en']}</span><span className="font-mono text-zion-cyan">{fmtPct(groupRate)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">PPLNS Engine</p>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-400">{PoolDashboardCopy.windowUtilization[cs ? 'cs' : 'en']}</span>
                    <span className="text-white font-mono">{fmtPct(data?.pplns?.window_pct)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-zion-cyan via-zion-gold to-emerald-400"
                      style={{ width: `${Math.max(0, Math.min(100, data?.pplns?.window_pct ?? 0))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{PoolDashboardCopy.registeredMiners[cs ? 'cs' : 'en']}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtNum(data?.pplns?.registered_miners)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{PoolDashboardCopy.payoutRounds[cs ? 'cs' : 'en']}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtNum(data?.pplns?.payout_rounds)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{PoolDashboardCopy.totalPaid_2[cs ? 'cs' : 'en']}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{(data?.pplns?.total_paid_zion ?? 0).toFixed(4)}</p>
                    <p className="text-xs text-gray-500">ZION</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <p className="text-xs text-gray-500">{PoolDashboardCopy.poolUptime[cs ? 'cs' : 'en']}</p>
                    <p className="mt-1 text-xl font-semibold text-white font-mono">{fmtUptime(data?.runtime?.pool_uptime_seconds)}</p>
                  </div>
                </div>

                <div className="zion-rainbow-sub p-4 text-sm text-zion-cyan" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                  <div className="flex items-center justify-between gap-3">
                    <span>{PoolDashboardCopy.telemetryStatus[cs ? 'cs' : 'en']}</span>
                    <span className="font-mono text-xs text-white">
                      pool {data?.runtime?.data_sources?.pool_tcp ? 'on' : 'off'} · rpc {data?.runtime?.data_sources?.core_rpc ? 'on' : 'off'} · prom {data?.runtime?.data_sources?.prometheus ? 'on' : 'off'}
                    </span>
                  </div>
                  {data?.aggregate?.hashrate !== undefined && data.aggregate.hashrate <= 0 && (
                    <p className="mt-2 text-xs text-zion-cyan/80">
                      {PoolDashboardCopy.poolHashrateIsStillUnavailable[cs ? 'cs' : 'en']}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ PROFIT SWITCHER ═══════ */}
        {data?.profit_switcher?.enabled && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.profitRouter[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {PoolDashboardCopy.profitSwitcher[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? `Pool automaticky vybírá nejprofitabilnější GPU a CPU coiny z dostupných bridge. Kontrola každých ${data.profit_switcher.interval_secs}s, hysteresis ${data.profit_switcher.hysteresis_pct}%. Zdroj: WhatToMine (USD) + NiceHash (monitoring).`
                : `Pool automatically selects the most profitable GPU and CPU coins from available bridges. Check every ${data.profit_switcher.interval_secs}s, hysteresis ${data.profit_switcher.hysteresis_pct}%. Source: WhatToMine (USD) + NiceHash (monitoring).`}
            </p>
          </div>

          {/* ── Best coins ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* GPU */}
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-emerald-400" />
                <span className="text-xs uppercase tracking-wider text-gray-400">{PoolDashboardCopy.bestGpuCoin[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {data.profit_switcher.best_gpu_coin ?? '—'}
              </div>
              <div className="text-sm text-emerald-400 mt-1">
                ${data.profit_switcher.best_gpu_profit_usd.toFixed(4)}/day
              </div>
            </div>
            {/* CPU */}
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-5 w-5 text-purple-400" />
                <span className="text-xs uppercase tracking-wider text-gray-400">{PoolDashboardCopy.bestCpuCoin[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {data.profit_switcher.best_cpu_coin ?? '—'}
              </div>
              <div className="text-sm text-purple-400 mt-1">
                ${data.profit_switcher.best_cpu_profit_usd.toFixed(4)}/day
              </div>
            </div>
          </div>

          {/* ── Last check ── */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <RefreshCw className="h-3 w-3" />
            {PoolDashboardCopy.lastCheck[cs ? 'cs' : 'en']}
            {data.profit_switcher.last_check_unix > 0
              ? new Date(data.profit_switcher.last_check_unix * 1000).toLocaleTimeString()
              : (PoolDashboardCopy.in5Min[cs ? 'cs' : 'en'])}
          </div>

          {/* ── Profit estimates table ── */}
          {data.profit_switcher.estimates?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                    <th className="text-left py-2 px-3">{PoolDashboardCopy.coin[cs ? 'cs' : 'en']}</th>
                    <th className="text-left py-2 px-3">{PoolDashboardCopy.algorithm[cs ? 'cs' : 'en']}</th>
                    <th className="text-right py-2 px-3">{PoolDashboardCopy.revenueUsdDay[cs ? 'cs' : 'en']}</th>
                    <th className="text-right py-2 px-3">{PoolDashboardCopy.profitUsdDay[cs ? 'cs' : 'en']}</th>
                    <th className="text-center py-2 px-3">{PoolDashboardCopy.type[cs ? 'cs' : 'en']}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.profit_switcher.estimates
                    .sort((a, b) => b.profit_usd_per_day - a.profit_usd_per_day)
                    .map((est) => (
                      <tr key={est.coin} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-2 px-3 font-semibold text-white">{est.coin}</td>
                        <td className="py-2 px-3 text-gray-400 font-mono text-xs">{est.algorithm}</td>
                        <td className="py-2 px-3 text-right text-gray-300">${est.revenue_usd_per_day.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-emerald-400">${est.profit_usd_per_day.toFixed(4)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                            est.is_cpu
                              ? 'bg-purple-400/10 text-purple-400'
                              : 'bg-emerald-400/10 text-emerald-400'
                          }`}>
                            {est.is_cpu ? <Cpu className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                            {est.is_cpu ? 'CPU' : 'GPU'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── NiceHash rates (collapsible) ── */}
          {data.profit_switcher.nicehash_rates?.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-gray-500 hover:text-gray-300 transition">
                {cs ? `NiceHash paying rates (${data.profit_switcher.nicehash_rates.length})` : `NiceHash paying rates (${data.profit_switcher.nicehash_rates.length})`}
              </summary>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {data.profit_switcher.nicehash_rates.map((nh) => (
                  <div key={nh.coin} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs">
                    <span className="font-semibold text-white">{nh.coin}</span>
                    <span className="font-mono text-gray-400">{nh.paying.toExponential(3)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </motion.section>
        )}

        {/* ═══════ POOL SERVERS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.infrastructure[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Server className="h-7 w-7 text-zion-gold" />
              {PoolDashboardCopy.poolServers[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.currentPublicPoolHostAndStratu[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {(data?.servers ?? []).map((srv) => {
              const connected = srv.stats?.blockchain?.connected;
              const active = (srv.stats?.miners?.active ?? 0) > 0;
              return (
                <div key={srv.id} className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{srv.flag}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{srv.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{srv.host}:{srv.stratum}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest border ${
                        !srv.online
                          ? "border-red-400/30 bg-red-400/10 text-red-300"
                          : connected && active
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : connected
                              ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                              : "border-red-400/30 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {!srv.online ? (
                        <><XCircle className="h-3 w-3" /> {PoolDashboardCopy.offline[cs ? 'cs' : 'en']}</>
                      ) : connected && active ? (
                        <><CircleDot className="h-3 w-3" /> {PoolDashboardCopy.mining[cs ? 'cs' : 'en']}</>
                      ) : connected ? (
                        <><CircleDot className="h-3 w-3" /> {PoolDashboardCopy.idle[cs ? 'cs' : 'en']}</>
                      ) : (
                        <><XCircle className="h-3 w-3" /> {PoolDashboardCopy.disconnected[cs ? 'cs' : 'en']}</>
                      )}
                    </span>
                  </div>
                  {srv.stats ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <MiniStat label="Hashrate" value={fmtHash(srv.stats.hashrate?.pool)} highlight />
                      <MiniStat label={PoolDashboardCopy.activeTotal[cs ? 'cs' : 'en']} value={`${srv.stats.miners?.active ?? 0} / ${srv.stats.miners?.total ?? 0}`} />
                      <MiniStat label={PoolDashboardCopy.validShares[cs ? 'cs' : 'en']} value={fmtNum(srv.stats.shares?.valid)} />
                      <MiniStat label={PoolDashboardCopy.invalid[cs ? 'cs' : 'en']} value={String(srv.stats.shares?.invalid ?? 0)} />
                      <MiniStat label={PoolDashboardCopy.blocksFound[cs ? 'cs' : 'en']} value={fmtNum(srv.stats.blocks?.found)} />
                      <MiniStat label="PPLNS Window" value={fmtNum(srv.stats.pplns_window_size)} />
                      <MiniStat label={PoolDashboardCopy.height[cs ? 'cs' : 'en']} value={fmtNum(srv.stats.blockchain?.height)} />
                      <MiniStat label="Uptime" value={fmtUptime(srv.stats.pool?.uptime_secs)} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{PoolDashboardCopy.noDataAvailable[cs ? 'cs' : 'en']}</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-gray-500" />
                    <code className="text-xs text-zion-cyan font-mono">stratum+tcp://{srv.host}:{srv.stratum}</code>
                    <CopyButton text={`stratum+tcp://${srv.host}:${srv.stratum}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ REWARD DISTRIBUTION ═══════ */}
        <PoolRewardDonut
          cs={cs}
          minerShare={data?.fee.miner_share ?? 89}
          humanitarianTithe={data?.fee.humanitarian_tithe ?? 5}
          issobellaFund={data?.fee.issobella_fund ?? 5}
          poolFee={data?.fee.pool_fee ?? 1}
        />

        {/* ═══════ MINERS TABLE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          id="miners"
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.directory[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Users className="h-7 w-7 text-zion-cyan" />
              {PoolDashboardCopy.activeMiners[cs ? 'cs' : 'en']} ({visibleMiners.length})
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.recentMinerDirectoryFromTheLiv[cs ? 'cs' : 'en']}</p>
            <div className="mt-1 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setActiveOnly(true)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${activeOnly ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                style={activeOnly ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
              >
                {PoolDashboardCopy.activeOnly[cs ? 'cs' : 'en']}
              </button>
              <button
                onClick={() => setActiveOnly(false)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${!activeOnly ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                style={!activeOnly ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
              >
                {PoolDashboardCopy.allMiners[cs ? 'cs' : 'en']}
              </button>
            </div>
          </div>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">#</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.minerWorker[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.payoutAddress[cs ? 'cs' : 'en']}</th>
                    <th className="text-right px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.hashrate[cs ? 'cs' : 'en']}</th>
                    <th className="text-right px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.shares[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.server[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.lastShare[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.status[cs ? 'cs' : 'en']}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMiners.map((m, i) => {
                    const isActive = now - m.last_share < 600;
                    const serverObj = data?.servers.find(s => s.id === m.server);
                    const rowKey = `${m.address}/${m.worker_name || ''}`;
                    return (
                      <tr key={rowKey} className="border-b border-white/[0.04] transition-colors">
                        <td className="px-5 py-3.5 text-gray-500 font-mono">{i + 1}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <code className="text-sm text-white font-mono">{shortAddr(m.address)}</code>
                              <CopyButton text={m.address} />
                            </div>
                            {m.worker_name && (
                              <span className="text-[11px] text-gray-500 font-mono">{m.worker_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {m.payout_address ? (
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-gray-400 font-mono">{shortAddr(m.payout_address)}</code>
                              <CopyButton text={m.payout_address} />
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-300 font-mono text-xs">{formatHashrate(m.hashrate ?? 0)}</td>
                        <td className="px-5 py-3.5 text-right text-gray-400 font-mono text-xs">{m.valid_shares ?? 0}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-sm">{serverObj?.flag} {serverObj?.name ?? m.server}</td>
                        <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{timeAgo(m.last_share, cs)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            isActive
                              ? "text-emerald-300 bg-emerald-400/10 border border-emerald-400/20"
                              : "text-gray-500 bg-white/5 border border-white/[0.06]"
                          }`}>
                            <CircleDot className="h-3 w-3" />
                            {isActive ? (PoolDashboardCopy.active[cs ? 'cs' : 'en']) : (PoolDashboardCopy.inactive[cs ? 'cs' : 'en'])}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleMiners.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-500">{PoolDashboardCopy.liveBackendIsNotExposingRecent[cs ? 'cs' : 'en']}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ═══════ RECENT BLOCKS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          id="blocks"
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.ledger[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Box className="h-7 w-7 text-zion-gold" />
              {PoolDashboardCopy.recentNetworkBlocks[cs ? 'cs' : 'en']} ({data?.recent_blocks.length ?? 0})
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.latestConfirmedChainBlocksFrom[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.height[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Hash</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.difficulty[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.reward[cs ? 'cs' : 'en']}</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Miner</th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">{PoolDashboardCopy.time[cs ? 'cs' : 'en']}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent_blocks ?? []).map((b, i) => (
                    <tr key={`${b.height}-${i}`} className="border-b border-white/[0.04] transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/explorer/block?height=${b.height}`} className="text-zion-cyan hover:text-white font-mono font-semibold transition-colors">
                          #{fmtNum(b.height)}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs text-gray-400 font-mono">{b.hash?.slice(0, 16)}…</code>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{fmtDifficulty(b.difficulty)}</td>
                      <td className="px-5 py-3.5 text-emerald-400 font-mono text-xs">{atomicToZion(b.reward)} ZION</td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs text-gray-400 font-mono">{shortAddr(b.miner_address)}</code>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{timeAgo(b.timestamp, cs)}</td>
                    </tr>
                  ))}
                  {(!data?.recent_blocks || data.recent_blocks.length === 0) && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">{PoolDashboardCopy.noRecentChainBlocksAvailable[cs ? 'cs' : 'en']}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ═══════ LIVE POOL FEED ═══════ */}
        <PoolEventsFeed cs={cs} />

        {/* ═══════ START MINING GUIDE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          id="start-mining"
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.gettingStarted[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-gold" />
              {PoolDashboardCopy.startMiningZion[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.followTheseStepsToBeginMiningI[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Step 1 — Get a ZION Wallet */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-purple-500/80 to-indigo-600/80">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{PoolDashboardCopy.k1GetAZionWallet[cs ? 'cs' : 'en']}</h3>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.valid44CharZion1AddressRequire[cs ? 'cs' : 'en']}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{PoolDashboardCopy.downloadTheZionDesktopWalletOr[cs ? 'cs' : 'en']}</p>
              <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2 mb-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <Bell className="h-3.5 w-3.5 mt-0.5" />
                <span>{PoolDashboardCopy.criticalZionPayoutAddressMustB[cs ? 'cs' : 'en']}</span>
              </div>
              <Link href="/download" className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                {PoolDashboardCopy.downloadWallet[cs ? 'cs' : 'en']} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Step 2 — Build the Miner */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-zion-cyan/80 to-blue-600/80">
                  <Cpu className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{PoolDashboardCopy.k2BuildTheMiner[cs ? 'cs' : 'en']}</h3>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.rustToolchainV3Source[cs ? 'cs' : 'en']}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{PoolDashboardCopy.zionMinerIsTheRustBinaryFromTh[cs ? 'cs' : 'en']}</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{PoolDashboardCopy.cpuBuild[cs ? 'cs' : 'en']}</p>
                  <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`cargo build --release --manifest-path V3/Cargo.toml -p zion-miner`}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{PoolDashboardCopy.gpuBuildOpencl[cs ? 'cs' : 'en']}</p>
                  <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl`}
                  </pre>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href="/mining/node-setup" className="inline-flex items-center gap-2 text-zion-cyan hover:text-white transition-colors">
                  {PoolDashboardCopy.nodeSetupGuide[cs ? 'cs' : 'en']} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Link href="/mining/guides" className="inline-flex items-center gap-2 text-zion-cyan hover:text-white transition-colors">
                  {PoolDashboardCopy.moreGuides[cs ? 'cs' : 'en']} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Step 3 — Choose Algorithm */}
            <div className="zion-rainbow-sub p-6 md:col-span-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-purple-500/80 to-fuchsia-600/80">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{PoolDashboardCopy.k3ChooseAlgorithm[cs ? 'cs' : 'en']}</h3>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.k3DeekshaPowVariants[cs ? 'cs' : 'en']}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { algo: 'deeksha_lite_v1', tag: PoolDashboardCopy.defaultCpuGpuBalanced[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.standardDeekshaLiteRecommended[cs ? 'cs' : 'en'] },
                  { algo: 'cosmic_harmony_ekam_deeksha_v2', tag: PoolDashboardCopy.advancedCpuGpu[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.ekamV2AdvancedDeekshaVariant[cs ? 'cs' : 'en'] },
                  { algo: 'deeksha_lite_fire', tag: PoolDashboardCopy.thermalIntensive512KibScratchp[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.fireHigherHashrateHigherPowerR[cs ? 'cs' : 'en'] },
                ].map((a) => (
                  <div key={a.algo} className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-sm text-zion-cyan font-mono">{a.algo}</code>
                      <CopyButton text={`ZION_MINER_ALGORITHM=${a.algo}`} />
                    </div>
                    <p className="text-[11px] text-gray-400 mb-1">{a.tag}</p>
                    <p className="text-xs text-gray-500">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 — Configure & Connect */}
            <div className="zion-rainbow-sub p-6 md:col-span-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500/80 to-teal-600/80">
                  <Terminal className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{PoolDashboardCopy.k4ConfigureConnect[cs ? 'cs' : 'en']}</h3>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.runZionMinerWithTheRightEnvVar[cs ? 'cs' : 'en']}</p>
                </div>
              </div>

              {/* Mode + OS toggles */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setMiningMode('cpu')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${miningMode === 'cpu' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={miningMode === 'cpu' ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
                  >
                    <Cpu className="h-3.5 w-3.5 inline mr-1.5" /> {PoolDashboardCopy.cpuMining[cs ? 'cs' : 'en']}
                  </button>
                  <button
                    onClick={() => setMiningMode('gpu')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${miningMode === 'gpu' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={miningMode === 'gpu' ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
                  >
                    <Zap className="h-3.5 w-3.5 inline mr-1.5" /> {PoolDashboardCopy.gpuMining[cs ? 'cs' : 'en']}
                  </button>
                </div>
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setMinerOS('linux')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${minerOS === 'linux' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={minerOS === 'linux' ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
                  >
                    Linux/macOS
                  </button>
                  <button
                    onClick={() => setMinerOS('windows')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${minerOS === 'windows' ? 'zion-rainbow-sub text-white' : 'text-gray-400 hover:text-white'}`}
                    style={minerOS === 'windows' ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
                  >
                    Windows
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {minerOS === 'linux' ? (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
                      {PoolDashboardCopy.linuxMacosBash[cs ? 'cs' : 'en']}
                      <CopyButton text={`ZION_POOL_ADDR=${SITE_POOL_PRIMARY} \\\nZION_WORKER_NAME=my-rig \\\nZION_MINER_ID=worker-01 \\\nZION_PAYOUT_ADDRESS=zion1...your44charaddress \\\nZION_MINER_ALGORITHM=deeksha_lite_v1 \\\nZION_LOOP_COUNT=1000000${miningMode === 'gpu' ? ' \\\nZION_GPU_BACKEND=opencl \\\nZION_NONCE_COUNT_GPU=262144' : ''} \\\ncargo run --release --manifest-path V3/Cargo.toml -p zion-miner`} />
                    </p>
                    <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`ZION_POOL_ADDR=${SITE_POOL_PRIMARY} \\
ZION_WORKER_NAME=my-rig \\
ZION_MINER_ID=worker-01 \\
ZION_PAYOUT_ADDRESS=zion1...your44charaddress \\
ZION_MINER_ALGORITHM=deeksha_lite_v1 \\
ZION_LOOP_COUNT=1000000${miningMode === 'gpu' ? ` \\
ZION_GPU_BACKEND=opencl \\
ZION_NONCE_COUNT_GPU=262144` : ''} \\
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center">
                      Windows PowerShell
                      <CopyButton text={`$env:ZION_POOL_ADDR='${SITE_POOL_PRIMARY}'\n$env:ZION_WORKER_NAME='my-rig'\n$env:ZION_MINER_ID='worker-01'\n$env:ZION_PAYOUT_ADDRESS='zion1...your44charaddress'\n$env:ZION_MINER_ALGORITHM='deeksha_lite_v1'\n$env:ZION_LOOP_COUNT='1000000'${miningMode === 'gpu' ? `\n$env:ZION_GPU_BACKEND='opencl'\n$env:ZION_NONCE_COUNT_GPU='262144'` : ''}\ncargo run --release --manifest-path V3/Cargo.toml -p zion-miner`} />
                    </p>
                    <pre className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-200 overflow-x-auto font-mono">
{`$env:ZION_POOL_ADDR='${SITE_POOL_PRIMARY}'
$env:ZION_WORKER_NAME='my-rig'
$env:ZION_MINER_ID='worker-01'
$env:ZION_PAYOUT_ADDRESS='zion1...your44charaddress'
$env:ZION_MINER_ALGORITHM='deeksha_lite_v1'
$env:ZION_LOOP_COUNT='1000000'${miningMode === 'gpu' ? `
$env:ZION_GPU_BACKEND='opencl'
$env:ZION_NONCE_COUNT_GPU='262144'` : ''}
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`}
                    </pre>
                  </div>
                )}
                {miningMode === 'gpu' && (
                  <div className="zion-rainbow-sub p-3 text-xs text-zion-cyan/90 flex items-start gap-2" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                    <Zap className="h-3.5 w-3.5 mt-0.5" />
                    <span>{PoolDashboardCopy.gpuZionGpuBackendOpenclOrCudaM[cs ? 'cs' : 'en']}</span>
                  </div>
                )}
                <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <Shield className="h-3.5 w-3.5 mt-0.5" />
                  <span>{PoolDashboardCopy.poolAndMinerBinariesMustBeComp[cs ? 'cs' : 'en']}</span>
                </div>
              </div>
            </div>

            {/* Step 5 — Monitor & Earn */}
            <div className="zion-rainbow-sub p-6 md:col-span-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br from-zion-gold/80 to-amber-600/80">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{PoolDashboardCopy.k5MonitorEarn[cs ? 'cs' : 'en']}</h3>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.trackYourRewardsInRealTime[cs ? 'cs' : 'en']}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">{PoolDashboardCopy.onceConnectedMonitorYourMining[cs ? 'cs' : 'en']}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.minPayout[cs ? 'cs' : 'en']}</p>
                  <p className="text-lg font-bold text-white font-mono">{(data?.fee?.min_payout ?? 0.1)} ZION</p>
                </div>
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.minerShare[cs ? 'cs' : 'en']}</p>
                  <p className="text-lg font-bold text-white font-mono">{(data?.fee?.miner_share ?? 89)}%</p>
                </div>
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.rewardMethod[cs ? 'cs' : 'en']}</p>
                  <p className="text-lg font-bold text-white">PPLNS</p>
                </div>
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500">{PoolDashboardCopy.poolFee[cs ? 'cs' : 'en']}</p>
                  <p className="text-lg font-bold text-white font-mono">{(data?.fee?.pool_fee ?? 1)}%</p>
                </div>
              </div>
              <div className="zion-rainbow-sub p-3 text-xs text-gray-300 mb-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                {PoolDashboardCopy.coinbaseSplit89Miner5Humanitar[cs ? 'cs' : 'en']}
              </div>
              <Link href="/pool/miner/YOUR_ADDRESS" className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                {PoolDashboardCopy.openMinerDashboard[cs ? 'cs' : 'en']} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ═══════ WHY MINE WITH US ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.features[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-400" />
              {PoolDashboardCopy.whyMineWithUs[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.fairTransparentAndHumanitarian[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Zap className="h-5 w-5 text-white" />, color: "from-purple-500/80 to-indigo-600/80", title: PoolDashboardCopy.deekshaPowAlgorithm[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.nativeZionPowCpuGpuAsicResista[cs ? 'cs' : 'en'] },
              { icon: <Heart className="h-5 w-5 text-white" />, color: "from-pink-500/80 to-rose-600/80", title: PoolDashboardCopy.humanitarianMission[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.k5Humanitarian5IssobellaFundMin[cs ? 'cs' : 'en'] },
              { icon: <Server className="h-5 w-5 text-white" />, color: "from-blue-500/80 to-cyan-600/80", title: PoolDashboardCopy.v306PoolInfrastructure[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.edgeNode1PoolRealStratumPplns2[cs ? 'cs' : 'en'] },
              { icon: <Shield className="h-5 w-5 text-white" />, color: "from-emerald-500/80 to-teal-600/80", title: PoolDashboardCopy.pplnsRewards[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.fairRewardDistributionBasedOnY[cs ? 'cs' : 'en'] },
              { icon: <Zap className="h-5 w-5 text-white" />, color: "from-orange-500/80 to-amber-600/80", title: PoolDashboardCopy.gpuAcceleration[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.openclCudaMetalSupportRx5700Xt[cs ? 'cs' : 'en'] },
              { icon: <Signal className="h-5 w-5 text-white" />, color: "from-zion-cyan/80 to-blue-600/80", title: PoolDashboardCopy.realTimeMonitoring[cs ? 'cs' : 'en'], desc: PoolDashboardCopy.liveHashrateSharesAndEarningsV[cs ? 'cs' : 'en'] },
            ].map((f) => (
              <div key={f.title} className="group zion-rainbow-sub p-5 transition-all duration-200" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className={`flex items-center justify-center h-10 w-10 rounded-xl bg-linear-to-br ${f.color} opacity-80 group-hover:opacity-100 transition mb-4`}>
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ PRO TOOLS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{PoolDashboardCopy.proTools[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {PoolDashboardCopy.operatorToolkit[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.failoverTemplatesProfitEstimat[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{PoolDashboardCopy.profitEstimator[cs ? 'cs' : 'en']}</p>
              <label className="text-xs text-gray-400">{PoolDashboardCopy.yourHashrateSupportsKMGT[cs ? 'cs' : 'en']}</label>
              <input
                value={myHashrateInput}
                onChange={(e) => setMyHashrateInput(e.target.value)}
                placeholder={PoolDashboardCopy.eG250m[cs ? 'cs' : 'en']}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 font-mono outline-none focus:border-zion-cyan/50"
              />
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-500">{PoolDashboardCopy.parsedHashrate[cs ? 'cs' : 'en']}</span><span className="text-white font-mono">{fmtHash(myHashrate)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{PoolDashboardCopy.poolShare[cs ? 'cs' : 'en']}</span><span className="text-zion-cyan font-mono">{mySharePct.toFixed(6)}%</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{PoolDashboardCopy.observedBlocksDay[cs ? 'cs' : 'en']}</span><span className="text-gray-200 font-mono">{blocksPerDay.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{PoolDashboardCopy.rewardBlock[cs ? 'cs' : 'en']}</span><span className="text-gray-200 font-mono">{rewardPerBlock.toFixed(4)} ZION</span></div>
                <div className="mt-3 zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <span className="text-emerald-200 text-xs uppercase tracking-wider">{PoolDashboardCopy.estimatedDailyReward[cs ? 'cs' : 'en']}</span>
                  <span className="text-emerald-300 font-bold font-mono">{myDailyZion.toFixed(4)} ZION</span>
                </div>
              </div>
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{PoolDashboardCopy.failoverConfig[cs ? 'cs' : 'en']}</p>
              <div className="space-y-3">
                <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{PoolDashboardCopy.zionMinerPrimaryBackup[cs ? 'cs' : 'en']}</p>
                  <pre className="block text-xs text-zion-cyan whitespace-pre-wrap break-all font-mono">{zionMinerFailoverCmd}</pre>
                  <div className="mt-2"><CopyButton text={zionMinerFailoverCmd} /></div>
                </div>
                <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <Shield className="h-3.5 w-3.5 mt-0.5" />
                  <span>{PoolDashboardCopy.forFailoverSwitchZionPoolAddrT[cs ? 'cs' : 'en']}</span>
                </div>
              </div>
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{PoolDashboardCopy.automationExport[cs ? 'cs' : 'en']}</p>
              <div className="space-y-2.5 text-sm">
                <a href="/api/pool/stats" target="_blank" rel="noreferrer" className="flex items-center justify-between zion-rainbow-sub px-3 py-2 transition" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <span className="text-gray-200 font-mono text-xs">/api/pool/stats</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/api/pool/miner/YOUR_ZION_ADDRESS" target="_blank" rel="noreferrer" className="flex items-center justify-between zion-rainbow-sub px-3 py-2 transition" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <span className="text-gray-200 font-mono text-xs">/api/pool/miner/&lt;address&gt;</span>
                  <Download className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <a href="/monitoring" className="flex items-center justify-between zion-rainbow-sub px-3 py-2 transition" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <span className="text-gray-200">Mission control</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
                </a>
                <div className="zion-rainbow-sub p-3 text-xs text-amber-200 flex items-start gap-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <Bell className="h-3.5 w-3.5 mt-0.5" />
                  <span>{PoolDashboardCopy.setAlertIfLastShareExceeds10Mi[cs ? 'cs' : 'en']}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ FAQ ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">FAQ</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full border border-blue-400/30 bg-blue-400/10 text-blue-400 text-sm font-bold">?</span>
              {PoolDashboardCopy.frequentlyAskedQuestions[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{PoolDashboardCopy.answersToTheMostCommonMinerQue[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="space-y-3">
            {[
              { q: PoolDashboardCopy.whatAlgorithmDoesZionUse[cs ? 'cs' : 'en'], a: PoolDashboardCopy.zionUsesDeekshaACustomAsicResi[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.howDoesPplnsWork[cs ? 'cs' : 'en'], a: PoolDashboardCopy.pplnsPayPerLastNSharesRewardsM[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.whatIsTheMinimumPayout[cs ? 'cs' : 'en'], a: cs ? `Minimální výplata je ${data?.fee?.min_payout ?? 0.1} ZION. Výplaty probíhají automaticky po nalezení bloku, jakmile váš zůstatek dosáhne prahu.` : `The minimum payout is ${data?.fee?.min_payout ?? 0.1} ZION. Payouts happen automatically after a block is found once your balance reaches the threshold.` },
              { q: PoolDashboardCopy.whereDoTitheAndFundsGo[cs ? 'cs' : 'en'], a: PoolDashboardCopy.coinbaseDistribution89Miner5Hu[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.canIUseXmrig[cs ? 'cs' : 'en'], a: PoolDashboardCopy.noZionUsesDeekshaPowWhichIsNot[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.whatDoesPoolLuckMean[cs ? 'cs' : 'en'], a: PoolDashboardCopy.poolLuckShowsTheRatioOfBlocksF[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.howDoISetUpFailover[cs ? 'cs' : 'en'], a: PoolDashboardCopy.forFailoverSwitchZionPoolAddrT_2[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.howOftenArePayoutsProcessed[cs ? 'cs' : 'en'], a: PoolDashboardCopy.payoutsAreProcessedAfterEveryB[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.doINeedAGpu[cs ? 'cs' : 'en'], a: PoolDashboardCopy.noCpuMiningWorksButGpuOpenclCu[cs ? 'cs' : 'en'] },
              { q: PoolDashboardCopy.whatIsZionPayoutAddress[cs ? 'cs' : 'en'], a: PoolDashboardCopy.criticalMustBeAValid44CharZion[cs ? 'cs' : 'en'] },
            ].map((item) => (
              <FAQItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.36 }}
          className="zion-cta-banner"
        >
          <Pickaxe className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{PoolDashboardCopy.zionMiningPool[cs ? 'cs' : 'en']}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {PoolDashboardCopy.mineZionWithDeekshaPowAFairTra[cs ? 'cs' : 'en']}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {PoolDashboardCopy.k89Miner5Humanitarian5Issobella[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#start-mining" className="zion-button-primary group text-sm" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <Zap className="h-4 w-4" /> {PoolDashboardCopy.startMining[cs ? 'cs' : 'en']}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link href="/explorer" className="zion-button-secondary text-sm">
              <Layers className="h-4 w-4" /> Explorer
            </Link>
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary text-sm"
            >
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
          </div>
        </motion.section>
        </>
        )}

        {activeTab === 'blocks' && <PoolBlocksClient embedded />}
        {activeTab === 'miners' && <PoolMinersClient embedded />}
        {activeTab === 'calculator' && <PoolCalculatorClient embedded />}
        {activeTab === 'benchmarks' && <PoolBenchmarksClient embedded />}

        <p className="text-center text-xs text-gray-600">
          {cs ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Mining Pool Pro · Data v reálném čase z primárního stratum endpointu · Edge Node 1 · v3.0.6 E2E Trinity` : `ZION TerraNova ${SITE_RELEASE_LABEL} — Mining Pool Pro · Real-time data from the primary stratum endpoint · Edge Node 1 · v3.0.6 E2E Trinity`}
          {lastUpdate && <> · {PoolDashboardCopy.lastUpdate[cs ? 'cs' : 'en']}: {lastUpdate.toLocaleTimeString(PoolDashboardCopy.enUs[cs ? 'cs' : 'en'])}</>}
        </p>
      </div>

      <LiveToast currentHeight={blockHeight} />
    </div>
  );
}

/* ═══════════════════════ STAT CARD ═══════════════════════ */
function StatCard({ icon, color, bg, label, value, sub, tip }: { icon: React.ReactNode; color: string; bg: string; label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bg} mb-3 [&>svg]:h-4 [&>svg]:w-4 ${color}`}>
        {icon}
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════ MINI STAT ═══════════════════════ */
function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-mono ${highlight ? "text-zion-cyan font-bold" : "text-gray-300"}`}>{value}</p>
    </div>
  );
}

/* ═══════════════════════ HASHRATE SPARK ═══════════════════════ */
function HashrateSpark({ data, height = 100 }: { data: {ts: number; value: number}[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06]" style={{ height }}>
        <p className="text-xs text-gray-500">Collecting data…</p>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 600;
  const h = height;
  const pad = 4;
  const plotH = h - pad * 2;
  const plotW = w - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * plotW;
    const y = pad + plotH - ((v - min) / range) * plotH;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${pad + plotW},${pad + plotH} L${pad},${pad + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="poolSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#poolSparkGrad)" />
      <path d={linePath} fill="none" stroke="rgb(52, 211, 153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════ FAQ ITEM ═══════════════════════ */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-sm font-medium text-white">{question}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-white/[0.04] pt-3">{answer}</div>
      )}
    </div>
  );
}
