'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Coins,
  Cpu,
  ExternalLink,
  FileText,
  Globe,
  Globe2,
  Hash,
  HelpCircle,
  Layers,
  Lock,
  MapPin,
  Orbit,
  Radio,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  BLOCK_REWARD_ZION,
  BLOCKS_PER_DECADE,
  DECAY_FACTOR,
  TOTAL_SUPPLY_ZION,
  GENESIS_PREMINE_ZION,
  BLOCK_TIME_SECONDS,
  blockRewardAtHeight,
} from '@/lib/constants';
import {
  SITE_POOL_PRIMARY,
  SITE_PRIMARY_HOST,
  SITE_PRIMARY_RPC_URL,
  SITE_RELEASE_LABEL,
  SITE_RUNTIME_LABEL,
} from '@/lib/site';

const NetworkCopy = {
  publicNodes: { cs: `Veřejné nody`, en: `Public Nodes` },
  k2NodeP2pMeshEdge1Edge2LocalBac: { cs: `2-uzlový P2P mesh: Edge 1, Edge 2 (Local Backup offline)`, en: `2-node P2P mesh: Edge 1, Edge 2 (Local Backup offline)` },
  p2pMesh: { cs: `P2P mesh`, en: `P2P Mesh` },
  k2Nodes: { cs: `2 uzly`, en: `2 nodes` },
  edge1Edge2Within2BlockSyncLoca: { cs: `Edge 1 ↔ Edge 2 v syncu ≤2 bloků · Local Backup offline`, en: `Edge 1 ↔ Edge 2 within ≤2 block sync · Local Backup offline` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  autoRefreshInterval: { cs: `Interval auto-obnovení`, en: `Auto-refresh interval` },
  topology: { cs: `Topologie`, en: `Topology` },
  v306E2e: { cs: `v3.2.0 E2E`, en: `v3.2.0 E2E` },
  sshTunnelsApparmorUfwRpcAuditL: { cs: `SSH tunely, AppArmor, UFW, RPC audit log — vše aktivní`, en: `SSH tunnels, AppArmor, UFW, RPC audit log — all active` },
  network: { cs: `Síť`, en: `Network` },
  trinity: { cs: `Trinity`, en: `Trinity` },
  mainnetBeta1111ServicesProtoco: { cs: `Mainnet Stable · 11/11 služeb · protocol 3.2.0`, en: `Mainnet Stable · 11/11 services · protocol 3.2.0` },
  edgeNode1PrimaryPool: { cs: `Edge Node 1 (Primary / Pool)`, en: `Edge Node 1 (Primary / Pool)` },
  publicP2p8333Stratum8444Rpc844: { cs: `Veřejný P2P 8333, stratum 8444, RPC 8443, pool API 8455 — pool live`, en: `Public P2P 8333, stratum 8444, RPC 8443, pool API 8455 — pool live` },
  active: { cs: `Aktivní`, en: `Active` },
  edgeNode2Follower: { cs: `Edge Node 2 (Follower)`, en: `Edge Node 2 (Follower)` },
  p2pPeerOnPort8334Rpc8448FullyS: { cs: `P2P peer na portu 8334, RPC 8448 — plně synchronizovaný s primárním uzlem`, en: `P2P peer on port 8334, RPC 8448 — fully synchronized with primary` },
  localBackupNodePrague: { cs: `Local Backup Node (Prague)`, en: `Local Backup Node (Prague)` },
  backupNodeViaSshReverseForward: { cs: `Záložní uzel přes SSH reverzní forward 8446 — aktuálně offline`, en: `Backup node via SSH reverse forward 8446 — currently offline` },
  zionBackupTunnel: { cs: `ZION Backup (tunel)`, en: `ZION Backup (tunnel)` },
  offline: { cs: `Offline`, en: `Offline` },
  publicStratum: { cs: `Veřejný stratum`, en: `Public Stratum` },
  primaryMiningIngressPoolApi845: { cs: `Primární těžební vstup — pool API 8455`, en: `Primary mining ingress — pool API 8455` },
  nativeRustJsonRpcForExplorersA: { cs: `Nativní Rust JSON-RPC pro explorer a tooling (2-uzlový mesh)`, en: `Native Rust JSON-RPC for explorers and tooling (2-node mesh)` },
  k2NodeMesh83338334Backup8335Off: { cs: `2-uzlový mesh: 8333, 8334 · backup 8335 offline`, en: `2-node mesh: 8333, 8334 · backup 8335 offline` },
  releaseContext: { cs: `Kontext releasu`, en: `Release Context` },
  v306E2eStatus: { cs: `v3.2.0 E2E Status`, en: `v3.2.0 E2E Status` },
  trinity_2: { cs: `Trinity ✓`, en: `Trinity ✓` },
  k1111ServicesActiveF47F5ActiveM: { cs: `11/11 služeb aktivních · F4.7 + F5 aktivní · memory leak fix`, en: `11/11 services active · F4.7 + F5 active · memory leak fix` },
  mining: { cs: `Těžba`, en: `Mining` },
  connectAnyCosmicHarmonyCpuMine: { cs: `Připojte jakýkoli Cosmic Harmony / CPU miner k aktuálnímu veřejnému poolu na Edge Node 1.`, en: `Connect any Cosmic Harmony / CPU miner to the current public pool on Edge Node 1.` },
  currentPrimary: { cs: `(aktuální primární)`, en: `(current primary)` },
  nativeRustJsonRpcEndpointForEx: { cs: `Nativní Rust JSON-RPC endpoint pro explorer a tooling. Dostupný přes 2-uzlový mesh s auto-failover.`, en: `Native Rust JSON-RPC endpoint for explorers and tooling. Available across a 2-node mesh with auto-failover.` },
  publicRuntimeEndpoint: { cs: `veřejný runtime endpoint`, en: `public runtime endpoint` },
  nativeRustP2pNetwork2NodeMeshW: { cs: `Nativní Rust P2P síť — 2-uzlový mesh s výškou v syncu ≤2 bloků, všechny peery veřejně routované nebo přes tunel.`, en: `Native Rust P2P network — 2-node mesh with height sync within ≤2 blocks, all peers publicly routed or tunneled.` },
  publicPeerEdge1: { cs: `Veřejný peer (Edge 1)`, en: `Public peer (Edge 1)` },
  publicPeerEdge2: { cs: `Veřejný peer (Edge 2)`, en: `Public peer (Edge 2)` },
  backupPeerTunnel: { cs: `Backup peer (tunel)`, en: `Backup peer (tunnel)` },
  hardcodedSeedPeers: { cs: `Hardcoded seed peers`, en: `Hardcoded seed peers` },
  nativeRustP2p2NodeMesh: { cs: `Nativní Rust P2P — 2-uzlový mesh`, en: `Native Rust P2P — 2-node mesh` },
  v306TrinityMainnetBeta1111Serv: { cs: `v3.2.0 "One Love, Mainnet Stable" — 11/11 služeb aktivních`, en: `v3.2.0 "One Love, Mainnet Stable" — 11/11 services active` },
  jsonRpcEndpointsLive84438448Ba: { cs: `JSON-RPC endpointy live (8443, 8448; backup 8446 offline)`, en: `JSON-RPC endpoints live (8443, 8448; backup 8446 offline)` },
  e2eMemoTestsConfirmedInBlock75: { cs: `E2E memo testy potvrzené v bloku 752`, en: `E2E memo tests confirmed in block 752` },
  f47MaxTxAmountCapF5SenderBalan: { cs: `F4.7 max-tx-amount cap + F5 sender balance check aktivní`, en: `F4.7 max-tx-amount cap + F5 sender balance check active` },
  lwmaDaaTarget60sBlockTime: { cs: `LWMA DAA — cíl 60s block time`, en: `LWMA DAA — target 60s block time` },
  systemdServicesWithAutoRestart: { cs: `systemd služby s auto-restartem na Edge`, en: `systemd services with auto-restart on Edge` },
  prometheusGrafanaMonitoring: { cs: `Monitoring Prometheus + Grafana`, en: `Prometheus + Grafana monitoring` },
  ufwFirewallApparmorRpcAuditLog: { cs: `UFW firewall + AppArmor + RPC audit log na Edge`, en: `UFW firewall + AppArmor + RPC audit log on Edge` },
  sshTunnelsForBackupNodeReverse: { cs: `SSH tunely pro backup node (reverse forwards 8446-8447)`, en: `SSH tunnels for backup node (reverse forwards 8446-8447)` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
  liveStatus: { cs: `Živý stav`, en: `Live Status` },
  p2pNetwork: { cs: `P2P Síť`, en: `P2P Network` },
  realTimeTelemetryFromTheCurren: { cs: `Telemetrie v reálném čase z aktuálního veřejného runtime v3.2.0. Živá topologie je 2-uzlový P2P mesh — Edge 1 (primary + pool), Edge 2 (follower); Local Backup Node (Prague) je offline.`, en: `Real-time telemetry from the current public v3.2.0 runtime. The live topology is a 2-node P2P mesh — Edge 1 (primary + pool), Edge 2 (follower); Local Backup Node (Prague) is offline.` },
  nativeRust: { cs: `Nativní Rust`, en: `Native Rust` },
  k1PublicHost2InternalSeeds: { cs: `1 veřejný host · 2 interní seedy`, en: `1 Public Host · 2 Internal Seeds` },
  runtimeSnapshot: { cs: `Runtime přehled`, en: `Runtime Snapshot` },
  publicNetworkSurface: { cs: `Veřejný povrch sítě`, en: `Public Network Surface` },
  theCurrentLiveFootprintDistill: { cs: `Aktuální živý footprint zredukovaný na endpointy a role, které operátoři potřebují jako první.`, en: `The current live footprint distilled to the endpoints and roles operators actually need first.` },
  health: { cs: `Zdraví`, en: `Health` },
  networkHealthScore: { cs: `Skóre zdraví sítě`, en: `Network Health Score` },
  aggregateHealthIndicatorBasedO: { cs: `Agregátní indikátor stavu sítě na základě klíčových metrik.`, en: `Aggregate health indicator based on key network metrics.` },
  nodeOnline: { cs: `Node online`, en: `Node Online` },
  blocksMining: { cs: `Bloky se těží`, en: `Blocks Mining` },
  activeMiners: { cs: `Aktivní mineři`, en: `Active Miners` },
  normalBlockTime: { cs: `Normální block time`, en: `Normal Block Time` },
  databaseOk: { cs: `Databáze OK`, en: `Database OK` },
  poolOnline: { cs: `Pool online`, en: `Pool Online` },
  of100: { cs: `ze 100`, en: `of 100` },
  excellent: { cs: `Výborný`, en: `Excellent` },
  good: { cs: `Dobrý`, en: `Good` },
  fair: { cs: `Průměrný`, en: `Fair` },
  critical: { cs: `Kritický`, en: `Critical` },
  ok: { cs: `OK`, en: `OK` },
  fail: { cs: `FAIL`, en: `FAIL` },
  pts: { cs: `bodů`, en: `pts` },
  performance: { cs: `Výkon`, en: `Performance` },
  chainPerformance: { cs: `Výkon chainu`, en: `Chain Performance` },
  liveSparklinesForHashrateDiffi: { cs: `Živé grafy hashrate, obtížnosti a block time za poslední hodinu.`, en: `Live sparklines for hashrate, difficulty, and block time over the last hour.` },
  networkHashrate: { cs: `Hashrate sítě`, en: `Network Hashrate` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  avgBlockTime: { cs: `Průměrný block time`, en: `Avg Block Time` },
  target: { cs: `Cíl`, en: `Target` },
  statistics: { cs: `Statistika`, en: `Statistics` },
  chainStatistics: { cs: `Statistiky chainu`, en: `Chain Statistics` },
  detailedMetricsFromTheLiveBloc: { cs: `Detailní metriky z živého blockchainu.`, en: `Detailed metrics from the live blockchain.` },
  blockHeight: { cs: `Výška bloku`, en: `Block Height` },
  totalNumberOfMinedBlocksSinceG: { cs: `Celkový počet vytěžených bloků od genesis.`, en: `Total number of mined blocks since genesis.` },
  currentMiningDifficultySetByLw: { cs: `Aktuální těžební obtížnost nastavená LWMA DAA.`, en: `Current mining difficulty set by LWMA DAA.` },
  cumulativeDiff: { cs: `Kumulativní obtížnost`, en: `Cumulative Diff` },
  sumOfDifficultyAcrossAllBlocks: { cs: `Součet obtížnosti všech bloků — měří celkovou práci v síti.`, en: `Sum of difficulty across all blocks — measures total network work.` },
  circulatingSupply: { cs: `Oběžná zásoba`, en: `Circulating Supply` },
  totalZionInCirculationIncludin: { cs: `Celkové množství ZION v oběhu včetně genesis premine.`, en: `Total ZION in circulation including genesis premine.` },
  emission: { cs: `Emise`, en: `Emission` },
  percentageOfTotalSupplyMinedAc: { cs: `Procento vytěžené celkové zásoby podle Decade Decay plánu.`, en: `Percentage of total supply mined according to the Decade Decay schedule.` },
  totalTx: { cs: `Celkem TX`, en: `Total TX` },
  totalNumberOfTransactionsRecor: { cs: `Celkový počet transakcí zapsaných na blockchainu.`, en: `Total number of transactions recorded on the blockchain.` },
  transactionsWaitingForConfirma: { cs: `Transakce čekající na potvrzení v mempoolu.`, en: `Transactions waiting for confirmation in the mempool.` },
  totalPeers: { cs: `Peery celkem`, en: `Total Peers` },
  activeP2pConnectionsIncomingAn: { cs: `Aktivní P2P spojení — příchozí a odchozí.`, en: `Active P2P connections — incoming and outgoing.` },
  knownPeers: { cs: `Známé peery`, en: `Known Peers` },
  knownWhiteAndUnknownGreyPeerLi: { cs: `Známy (white) a neznámý (grey) peer seznam.`, en: `Known (white) and unknown (grey) peer lists.` },
  blockSizeLimit: { cs: `Limit bloku`, en: `Block Size Limit` },
  median: { cs: `Medián`, en: `Median` },
  maximumAndMedianBlockSizeInByt: { cs: `Maximální a mediánová velikost bloku v bytech.`, en: `Maximum and median block size in bytes.` },
  database: { cs: `Databáze`, en: `Database` },
  sizeOfTheLocalBlockchainDataba: { cs: `Velikost lokálního blockchain databázového souboru.`, en: `Size of the local blockchain database file.` },
  version: { cs: `Verze`, en: `Version` },
  nodeSoftwareVersion: { cs: `Verze softwaru uzlu.`, en: `Node software version.` },
  altBlocks: { cs: `Alt bloky`, en: `Alt Blocks` },
  numberOfAlternativeBranchesOrp: { cs: `Počet alternativních větví (orphan chain tipy).`, en: `Number of alternative branches (orphan chain tips).` },
  numberOfActiveMinersConnectedT: { cs: `Počet aktivních minerů připojených k poolu.`, en: `Number of active miners connected to the pool.` },
  poolHashrate: { cs: `Pool hashrate`, en: `Pool Hashrate` },
  totalComputationalPowerOfAllMi: { cs: `Celkový výpočetní výkon všech minerů v poolu.`, en: `Total computational power of all miners in the pool.` },
  poolBlocks: { cs: `Pool bloky`, en: `Pool Blocks` },
  numberOfBlocksFoundByThisPool: { cs: `Počet bloků nalezených tímto poolem.`, en: `Number of blocks found by this pool.` },
  lastBlock: { cs: `Poslední blok`, en: `Last Block` },
  latestConfirmedBlockAndItsMini: { cs: `Nejnovější potvrzený blok a čas jeho vytěžení.`, en: `Latest confirmed block and its mining time.` },
  lastReward: { cs: `Odměna`, en: `Last Reward` },
  rewardForTheLatestBlockPerDeca: { cs: `Odměna za poslední blok dle Decade Decay.`, en: `Reward for the latest block per Decade Decay.` },
  emissionProgress: { cs: `Průběh emise`, en: `Emission Progress` },
  decadeDecayModel20Every10Years: { cs: `Decade Decay model: -20 % každých 10 let. Max supply 144 miliard ZION.`, en: `Decade Decay model: -20% every 10 years. Max supply 144 billion ZION.` },
  mined: { cs: `Vytěženo`, en: `Mined` },
  decade: { cs: `Dekáda`, en: `Decade` },
  now: { cs: `Nyní`, en: `Now` },
  block: { cs: `blok`, en: `block` },
  infrastructure: { cs: `Infrastruktura`, en: `Infrastructure` },
  currentRuntime: { cs: `Aktuální runtime`, en: `Current Runtime` },
  currentPublicRuntimeIsA2NodeV3: { cs: `Aktuální veřejný runtime tvoří 2-uzlový P2P mesh v3.2.0 — Edge 1 (primary + pool) a Edge 2 (follower). Local Backup Node (Prague) je offline.`, en: `Current public runtime is a 2-node v3.2.0 P2P mesh — Edge 1 (primary + pool) and Edge 2 (follower). Local Backup Node (Prague) is offline.` },
  portEndpointsSeeNodeDescriptio: { cs: `Endpointy portů viz popis uzlu nahoře`, en: `Port endpoints see node description above` },
  rpcAutoFailoverAcross2NodeMesh: { cs: `RPC auto-failover přes 2-uzlový mesh`, en: `RPC auto-failover across 2-node mesh` },
  p2pMesh83338334Backup8335Offli: { cs: `P2P mesh: 8333, 8334 · backup 8335 offline`, en: `P2P mesh: 8333, 8334 · backup 8335 offline` },
  e2eStack: { cs: `E2E Stack`, en: `E2E Stack` },
  allV306ComponentsHaveBeenVerif: { cs: `Všechny komponenty v3.2.0 byly ověřeny end-to-end na živé mainnet síti.`, en: `All v3.2.0 components have been verified end-to-end on the live mainnet.` },
  k1111Services: { cs: `11/11 služeb`, en: `11/11 services` },
  nodePoolWatchersBridgeWebDashb: { cs: `Node, pool, watchers, bridge, web, dashboard, monitoring — vše active.`, en: `Node, pool, watchers, bridge, web, dashboard, monitoring — all active.` },
  f47F5Active: { cs: `F4.7 + F5 aktivní`, en: `F4.7 + F5 active` },
  maxTxAmountCapAndSenderBalance: { cs: `Max-tx-amount cap a sender balance check jsou nasazené od genesis height.`, en: `Max-tx-amount cap and sender balance check are deployed from genesis height.` },
  memoE2eTests: { cs: `Memo E2E testy`, en: `Memo E2E tests` },
  k3AccountModelTxsWithMemosConfi: { cs: `3 account-model TX s memy potvrzené v bloku 752.`, en: `3 account-model TXs with memos confirmed in block 752.` },
  memoryLeakFix: { cs: `Memory leak fix`, en: `Memory leak fix` },
  poolNodeMemoryLeaksFixedWatchd: { cs: `Pool + node memory leak opraveny, watchdog sleduje zdraví.`, en: `Pool + node memory leaks fixed, watchdog monitors health.` },
  rpcAuditLog: { cs: `RPC audit log`, en: `RPC audit log` },
  nodeRpcAuditLogForSecurityFore: { cs: `Audit log na node pro bezpečnostní forenzní analýzu.`, en: `Node RPC audit log for security forensics.` },
  apparmorUfw: { cs: `AppArmor + UFW`, en: `AppArmor + UFW` },
  edgeServerIsProtectedByApparmo: { cs: `Edge server je chráněn AppArmor profilem a striktním UFW.`, en: `Edge server is protected by AppArmor profile and strict UFW.` },
  bridgeBaseMainnet: { cs: `Bridge Base Mainnet`, en: `Bridge Base Mainnet` },
  zionbridgeAndL2WatchersSynchro: { cs: `ZIONBridge a L2 watchery synchronizují mema na Base.`, en: `ZIONBridge and L2 watchers synchronize memos on Base.` },
  k2NodeMesh: { cs: `2-uzlový mesh`, en: `2-node mesh` },
  edge1AndEdge2Within2BlockSyncL: { cs: `Edge 1 a Edge 2 v syncu ≤2 bloků · Local Backup offline.`, en: `Edge 1 and Edge 2 within ≤2 block sync · Local Backup offline.` },
  liveTelemetry: { cs: `Živá telemetrie`, en: `Live Telemetry` },
  nodeStatus: { cs: `Stav nodu`, en: `Node Status` },
  realTimeHealthBlockHeightHashr: { cs: `Zdraví, výška chainu, hashrate a sync stav v reálném čase z 2-uzlového P2P meshe.`, en: `Real-time health, block height, hashrate, and sync status from the 2-node P2P mesh.` },
  geography: { cs: `Geografie`, en: `Geography` },
  networkMapPoolFinder: { cs: `Mapa sítě a vyhledávač poolu`, en: `Network Map & Pool Finder` },
  visualizeTheCurrentTopologyAnd: { cs: `Vizualizujte aktuální topologii a porovnejte ji s archivovaným multi-host rolloutem zachovaným v release dokumentaci.`, en: `Visualize the current topology and compare it with the archived multi-host rollout preserved in release documentation.` },
  connect: { cs: `Připojení`, en: `Connect` },
  connectionGuides: { cs: `Připojovací návody`, en: `Connection Guides` },
  everythingYouNeedToConnectAMin: { cs: `Vše, co potřebujete k připojení mineru, dotazování RPC API nebo synchronizaci nodu.`, en: `Everything you need to connect a miner, query the RPC API, or sync a node.` },
  status: { cs: `Stav`, en: `Status` },
  networkReadiness: { cs: `Připravenost sítě`, en: `Network Readiness` },
  completed: { cs: `dokončeno`, en: `completed` },
  frequentlyAskedQuestions: { cs: `Často kladené dotazy`, en: `Frequently Asked Questions` },
  everythingAboutTheZionNetworkI: { cs: `Vše o síti ZION na jednom místě.`, en: `Everything about the ZION network in one place.` },
  joinTheZionNetwork: { cs: `Připojte se k síti ZION`, en: `Join the ZION Network` },
  nativeRustInfrastructureRunnin: { cs: `Nativní Rust infrastruktura běží 24/7 z aktuálního primárního hostu s podporou interního kvora. Připojte svůj miner, spusťte vlastní node nebo prozkoumejte blockchain, zatímco historický kontext nasazení zůstává zachován v dokumentaci.`, en: `Native Rust infrastructure running 24/7 from the current primary host with internal quorum support. Connect your miner, run your own node, or explore the blockchain while historical rollout context stays preserved in docs.` },
  primaryHostLive: { cs: `Primární host online`, en: `Primary host live` },
  internalSeeds: { cs: `Interní seedy`, en: `Internal seeds` },
  dockerNative: { cs: `Docker nativně`, en: `Docker native` },
  archivedMultiHostHistory: { cs: `Archivovaná multi-host historie`, en: `Archived multi-host history` },
  explorer: { cs: `Explorer`, en: `Explorer` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  whatConsensusDoesZionUse: { cs: `Jaký konsenzus ZION používá?`, en: `What consensus does ZION use?` },
  cosmicHarmonyProofOfWorkACusto: { cs: `Cosmic Harmony Proof-of-Work – vlastní CryptoNight varianta optimalizovaná pro CPU/GPU mining s 60s block time a Decade Decay emisí.`, en: `Cosmic Harmony Proof-of-Work – a custom CryptoNight variant optimized for CPU/GPU mining with 60s block time and Decade Decay emission.` },
  whatIsTheTargetBlockTime: { cs: `Jaký je cílový block time?`, en: `What is the target block time?` },
  k60SecondsDifficultyAdjustsDyna: { cs: `60 sekund. Obtížnost se dynamicky přizpůsobuje každý blok, aby udržela stabilní tempo.`, en: `60 seconds. Difficulty adjusts dynamically every block to maintain a stable pace.` },
  howManyZionAreMinedPerBlock: { cs: `Kolik ZION se vytěží za blok?`, en: `How many ZION are mined per block?` },
  whatIsTheMaximumSupply: { cs: `Jaká je maximální zásoba?`, en: `What is the maximum supply?` },
  howToConnectAsAMiner: { cs: `Jak se připojit jako miner?`, en: `How to connect as a miner?` },
  howToRunYourOwnFullNode: { cs: `Jak spustit vlastní full node?`, en: `How to run your own full node?` },
  whatPoolFeeDoesZionCharge: { cs: `Jaký pool fee si ZION účtuje?`, en: `What pool fee does ZION charge?` },
  k89GoesToTheMiner5ToTheHumanita: { cs: `89 % putuje minerovi, 5 % do humanitarian fondu, 5 % do fondu Issobella a 1 % pool provozní poplatek.`, en: `89% goes to the miner, 5% to the humanitarian fund, 5% to the Issobella fund, and 1% pool operational fee.` },
  isTheNetworkPubliclyLaunched: { cs: `Je síť veřejně spuštěna?`, en: `Is the network publicly launched?` },
  mainnetGenesisTookPlaceOn11Jun: { cs: `MainNet Genesis proběhl 11. června 2026. Veřejný plný launch je naplánován na 31. prosince 2026 (Silvestr). v3.2.0 "One Love" běží na 2-uzlovém P2P meshi s aktivním poolem, bridge je nasazený na Base Mainnet a E2E memo testy byly potvrzené v bloku 752.`, en: `MainNet Genesis took place on 11 June 2026. The public full launch is scheduled for 31 December 2026 (New Year\'s Eve). v3.2.0 "One Love" runs on a 2-node P2P mesh with an active pool, the bridge is deployed on Base Mainnet, and E2E memo tests were confirmed in block 752.` },
};

const NetworkStatus = dynamic(() => import('@/components/NetworkStatus'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkMap = dynamic(() => import('@/components/NetworkMap'), {
  loading: () => <SurfaceSkeleton lines={5} />,
});
const PoolFinder = dynamic(() => import('@/components/PoolFinder'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkMonitoringSnapshot = dynamic(() => import('@/components/network/NetworkMonitoringSnapshot'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkOperatorToolkit = dynamic(() => import('@/components/network/NetworkOperatorToolkit'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const NetworkAlgorithmPanel = dynamic(() => import('@/components/network/NetworkAlgorithmPanel'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkRewardDistribution = dynamic(() => import('@/components/network/NetworkRewardDistribution'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkEventsFeed = dynamic(() => import('@/components/network/NetworkEventsFeed'), {
  loading: () => <SurfaceSkeleton lines={4} />,
});
const Network24hCharts = dynamic(() => import('@/components/network/Network24hCharts'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkLatencyPanel = dynamic(() => import('@/components/network/NetworkLatencyPanel'), {
  loading: () => <SurfaceSkeleton lines={3} />,
});
const NetworkTopology = dynamic(() => import('@/components/network/NetworkTopology'), {
  loading: () => <SurfaceSkeleton lines={5} />,
});
const NetworkHistoricalCharts = dynamic(() => import('@/components/network/NetworkHistoricalCharts'), {
  loading: () => <SurfaceSkeleton lines={5} />,
});
const NetworkConsensusMetrics = dynamic(() => import('@/components/network/NetworkConsensusMetrics'), {
  loading: () => <SurfaceSkeleton lines={5} />,
});
const LiveToast = dynamic(() => import('@/components/explorer/LiveToast'));

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const getHeroStats = (cs: boolean) => [
  {
    label: NetworkCopy.publicNodes[cs ? 'cs' : 'en'],
    value: '2',
    descriptor: NetworkCopy.k2NodeP2pMeshEdge1Edge2LocalBac[cs ? 'cs' : 'en'],
  },
  {
    label: NetworkCopy.p2pMesh[cs ? 'cs' : 'en'],
    value: NetworkCopy.k2Nodes[cs ? 'cs' : 'en'],
    descriptor: NetworkCopy.edge1Edge2Within2BlockSyncLoca[cs ? 'cs' : 'en'],
  },
  {
    label: NetworkCopy.telemetry[cs ? 'cs' : 'en'],
    value: '30s',
    descriptor: NetworkCopy.autoRefreshInterval[cs ? 'cs' : 'en'],
  },
  {
    label: NetworkCopy.topology[cs ? 'cs' : 'en'],
    value: NetworkCopy.v306E2e[cs ? 'cs' : 'en'],
    descriptor: NetworkCopy.sshTunnelsApparmorUfwRpcAuditL[cs ? 'cs' : 'en'],
  },
  {
    label: NetworkCopy.network[cs ? 'cs' : 'en'],
    value: NetworkCopy.trinity[cs ? 'cs' : 'en'],
    descriptor: NetworkCopy.mainnetBeta1111ServicesProtoco[cs ? 'cs' : 'en'],
  },
];

const getInfraFeatures = (cs: boolean) => [
  {
    icon: Server,
    title: NetworkCopy.edgeNode1PrimaryPool[cs ? 'cs' : 'en'],
    detail: NetworkCopy.publicP2p8333Stratum8444Rpc844[cs ? 'cs' : 'en'],
    ip: SITE_PRIMARY_HOST,
    status: NetworkCopy.active[cs ? 'cs' : 'en'],
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
  {
    icon: Server,
    title: NetworkCopy.edgeNode2Follower[cs ? 'cs' : 'en'],
    detail: NetworkCopy.p2pPeerOnPort8334Rpc8448FullyS[cs ? 'cs' : 'en'],
    ip: `${SITE_PRIMARY_HOST}:8334`,
    status: NetworkCopy.active[cs ? 'cs' : 'en'],
    color: 'text-zion-cyan',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
  {
    icon: Server,
    title: NetworkCopy.localBackupNodePrague[cs ? 'cs' : 'en'],
    detail: NetworkCopy.backupNodeViaSshReverseForward[cs ? 'cs' : 'en'],
    ip: NetworkCopy.zionBackupTunnel[cs ? 'cs' : 'en'],
    status: NetworkCopy.offline[cs ? 'cs' : 'en'],
    color: 'text-gray-400',
    border: 'border-gray-500/30',
    bg: 'bg-gray-500/5',
  },
];

const getRuntimePanels = (cs: boolean) => [
  {
    icon: Radio,
    label: NetworkCopy.publicStratum[cs ? 'cs' : 'en'],
    value: SITE_POOL_PRIMARY,
    detail: NetworkCopy.primaryMiningIngressPoolApi845[cs ? 'cs' : 'en'],
    accent: 'text-zion-gold',
  },
  {
    icon: Terminal,
    label: 'RPC Endpoint',
    value: SITE_PRIMARY_RPC_URL,
    detail: NetworkCopy.nativeRustJsonRpcForExplorersA[cs ? 'cs' : 'en'],
    accent: 'text-zion-cyan',
  },
  {
    icon: Globe,
    label: 'P2P Mesh',
    value: `${SITE_PRIMARY_HOST}:8333`,
    detail: NetworkCopy.k2NodeMesh83338334Backup8335Off[cs ? 'cs' : 'en'],
    accent: 'text-emerald-400',
  },
  {
    icon: BookOpen,
    label: NetworkCopy.releaseContext[cs ? 'cs' : 'en'],
    value: SITE_RELEASE_LABEL,
    detail: cs
      ? `Veřejná linka nad ${SITE_RUNTIME_LABEL}; E2E memo testy potvrzené v bloku 752`
      : `Public line over ${SITE_RUNTIME_LABEL}; E2E memo tests confirmed in block 752`,
    accent: 'text-zion-purple',
  },
  {
    icon: Zap,
    label: NetworkCopy.v306E2eStatus[cs ? 'cs' : 'en'],
    value: NetworkCopy.trinity_2[cs ? 'cs' : 'en'],
    detail: NetworkCopy.k1111ServicesActiveF47F5ActiveM[cs ? 'cs' : 'en'],
    accent: 'text-amber-400',
  },
];

const getGuideBlocks = (cs: boolean) => [
  {
    icon: Zap,
    title: NetworkCopy.mining[cs ? 'cs' : 'en'],
    description: NetworkCopy.connectAnyCosmicHarmonyCpuMine[cs ? 'cs' : 'en'],
    items: [
      `Pool: ${SITE_POOL_PRIMARY} ${NetworkCopy.currentPrimary[cs ? 'cs' : 'en']}`,
      'Wallet: YOUR_ZION_ADDRESS',
      'Password: x',
    ],
  },
  {
    icon: Terminal,
    title: 'RPC API',
    description: NetworkCopy.nativeRustJsonRpcEndpointForEx[cs ? 'cs' : 'en'],
    items: [
      `Primary: ${SITE_PRIMARY_RPC_URL}`,
      `Scope: ${NetworkCopy.publicRuntimeEndpoint[cs ? 'cs' : 'en']}`,
      `Backup RPC: 127.0.0.1:8446 (reverse SSH tunnel)`,
      'Method: POST',
    ],
  },
  {
    icon: Globe,
    title: 'P2P Layer',
    description: NetworkCopy.nativeRustP2pNetwork2NodeMeshW[cs ? 'cs' : 'en'],
    items: [
      `${NetworkCopy.publicPeerEdge1[cs ? 'cs' : 'en']}: ${SITE_PRIMARY_HOST}:8333`,
      `${NetworkCopy.publicPeerEdge2[cs ? 'cs' : 'en']}: ${SITE_PRIMARY_HOST}:8334`,
      `${NetworkCopy.backupPeerTunnel[cs ? 'cs' : 'en']}: P2P 8335 / RPC 8446 — offline`,
      `${NetworkCopy.hardcodedSeedPeers[cs ? 'cs' : 'en']}: ${SITE_PRIMARY_HOST}:8333, ${SITE_PRIMARY_HOST}:8334`,
    ],
  },
];

const getNetworkFacts = (cs: boolean) => [
  { text: NetworkCopy.nativeRustP2p2NodeMesh[cs ? 'cs' : 'en'], done: true },
  {
    text: NetworkCopy.v306TrinityMainnetBeta1111Serv[cs ? 'cs' : 'en'],
    done: true,
  },
  {
    text: cs ? `Edge stratum endpoint: ${SITE_POOL_PRIMARY}` : `Edge stratum endpoint: ${SITE_POOL_PRIMARY}`,
    done: true,
  },
  { text: NetworkCopy.jsonRpcEndpointsLive84438448Ba[cs ? 'cs' : 'en'], done: true },
  { text: NetworkCopy.e2eMemoTestsConfirmedInBlock75[cs ? 'cs' : 'en'], done: true },
  { text: NetworkCopy.f47MaxTxAmountCapF5SenderBalan[cs ? 'cs' : 'en'], done: true },
  { text: NetworkCopy.lwmaDaaTarget60sBlockTime[cs ? 'cs' : 'en'], done: true },
  { text: NetworkCopy.systemdServicesWithAutoRestart[cs ? 'cs' : 'en'], done: true },
  { text: NetworkCopy.prometheusGrafanaMonitoring[cs ? 'cs' : 'en'], done: true },
  {
    text: NetworkCopy.ufwFirewallApparmorRpcAuditLog[cs ? 'cs' : 'en'],
    done: true,
  },
  {
    text: NetworkCopy.sshTunnelsForBackupNodeReverse[cs ? 'cs' : 'en'],
    done: true,
  },
];

interface MonitoringSnapshot {
  chainHeight: number | null;
  coreUp: number | null;
  poolUp: number | null;
  poolSessions: number | null;
  poolAcceptRate: number | null;
  poolUptime: number | null;
  templateFees: number | null;
  load1: number | null;
  memAvailable: number | null;
  memTotal: number | null;
  diskAvailable: number | null;
  diskTotal: number | null;
}

function fmtMetric(n: number | null | undefined, digits = 0) {
  if (n == null) return '—';
  return digits > 0 ? n.toFixed(digits) : n.toLocaleString('en-US');
}

function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null) return '—';
  return `${n.toFixed(digits)}%`;
}

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fmtUptime(secs: number | null | undefined) {
  if (!secs) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function metricValue(query: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.data?.result?.[0];
    return first ? Number.parseFloat(first.value?.[1] ?? '') : null;
  } catch {
    return null;
  }
}

async function fetchMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const values = await Promise.all([
    metricValue('zion_chain_height'),
    metricValue('up{job="zion-core"}'),
    metricValue('up{job="zion-pool"}'),
    metricValue('zion_pool_active_sessions'),
    metricValue('zion_pool_accept_rate_pct'),
    metricValue('zion_pool_uptime_seconds'),
    metricValue('zion_template_fees_zion'),
    metricValue('node_load1'),
    metricValue('node_memory_MemAvailable_bytes'),
    metricValue('node_memory_MemTotal_bytes'),
    metricValue('node_filesystem_avail_bytes{mountpoint="/"}'),
    metricValue('node_filesystem_size_bytes{mountpoint="/"}'),
  ]);

  return {
    chainHeight: values[0],
    coreUp: values[1],
    poolUp: values[2],
    poolSessions: values[3],
    poolAcceptRate: values[4],
    poolUptime: values[5],
    templateFees: values[6],
    load1: values[7],
    memAvailable: values[8],
    memTotal: values[9],
    diskAvailable: values[10],
    diskTotal: values[11],
  };
}

export default function NetworkPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = NetworkCopy.enUs[cs ? 'cs' : 'en'];
  const heroStats = getHeroStats(cs);
  const infraFeatures = getInfraFeatures(cs);
  const runtimePanels = getRuntimePanels(cs);
  const guideBlocks = getGuideBlocks(cs);
  const networkFacts = getNetworkFacts(cs);
  const factsDone = networkFacts.filter((f) => f.done).length;
  const factsTotal = networkFacts.length;

  const primaryPool = SITE_POOL_PRIMARY;

  /* ── Chain stats fetch ── */
  interface ChainStats {
    block_height: number;
    difficulty: number;
    cumulative_difficulty: number;
    circulating_supply: number;
    emission_pct: string;
    network_hashrate: number;
    network_hashrate_formatted: string;
    target_block_time: number;
    avg_block_time: number;
    tx_count: number;
    tx_pool_size: number;
    total_connections: number;
    incoming_connections: number;
    outgoing_connections: number;
    white_peerlist_size: number;
    grey_peerlist_size: number;
    block_size_limit: number;
    block_size_median: number;
    database_size: number;
    alt_blocks_count: number;
    active_miners: number;
    pool_hashrate: number;
    pool_hashrate_formatted: string;
    pool_blocks_found: number;
    pool_uptime_s: number;
    version: string;
    connected: boolean;
    last_block?: { height: number; hash: string; timestamp: number; difficulty: number; reward: number; num_txes: number; block_size: number };
  }

  type HistoryPoint = { ts: number; value: number };

  const [chainStats, setChainStats] = useState<ChainStats | null>(null);
  const [hashrateHistory, setHashrateHistory] = useState<HistoryPoint[]>([]);
  const [difficultyHistory, setDifficultyHistory] = useState<HistoryPoint[]>([]);
  const [blockTimeHistory, setBlockTimeHistory] = useState<HistoryPoint[]>([]);
  const [blockHeight, setBlockHeight] = useState(0);

  const fetchChainStats = useCallback(async () => {
    try {
      const res = await fetch('/api/blockchain/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setChainStats(json);
      const now = Math.floor(Date.now() / 1000);
      const appendPoint = (prev: HistoryPoint[], value: number) =>
        [...prev.filter((p) => now - p.ts < 3600), { ts: now, value }].slice(-60);

      setHashrateHistory((prev) => appendPoint(prev, json.network_hashrate ?? 0));
      setDifficultyHistory((prev) => appendPoint(prev, json.difficulty ?? 0));
      setBlockTimeHistory((prev) => appendPoint(prev, json.avg_block_time ?? 0));
      if (json.block_height) setBlockHeight(json.block_height);
    } catch { /* silent */ }
  }, []);

  usePolling(fetchChainStats, 15_000);

  return (
    <div className="zion-page">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <section
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="zion-kicker border-cyan-400/35 bg-cyan-400/10 text-cyan-200">
                <Radio className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {NetworkCopy.network[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{NetworkCopy.liveStatus[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {NetworkCopy.p2pNetwork[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {NetworkCopy.realTimeTelemetryFromTheCurren[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {NetworkCopy.nativeRust[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 backdrop-blur-sm">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Runtime: {SITE_RUNTIME_LABEL}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200 backdrop-blur-sm">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {NetworkCopy.k1PublicHost2InternalSeeds[cs ? 'cs' : 'en']}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div
                  key={chip.label}
                  className="zion-rainbow-sub px-5 py-4 backdrop-blur"
                  style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ RUNTIME SNAPSHOT ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.runtimeSnapshot[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-cyan" />
              {NetworkCopy.publicNetworkSurface[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.theCurrentLiveFootprintDistill[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
            {runtimePanels.map((panel) => (
              <div
                key={panel.label}
                className="zion-rainbow-sub p-6"
                style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3 mb-4">
                  <panel.icon className={`h-5 w-5 ${panel.accent}`} />
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{panel.label}</p>
                </div>
                <p className="text-base font-semibold text-white break-all">{panel.value}</p>
                <p className="mt-2 text-sm text-gray-400">{panel.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ NETWORK HEALTH SCORE ═══════ */}
        {chainStats && (
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.health[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {NetworkCopy.networkHealthScore[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.aggregateHealthIndicatorBasedO[cs ? 'cs' : 'en']}</p>
          </div>

          {(() => {
            const checks = [
              { label: NetworkCopy.nodeOnline[cs ? 'cs' : 'en'], ok: chainStats.connected, weight: 25 },
              { label: NetworkCopy.blocksMining[cs ? 'cs' : 'en'], ok: chainStats.block_height > 0, weight: 20 },
              { label: NetworkCopy.activeMiners[cs ? 'cs' : 'en'], ok: chainStats.active_miners > 0, weight: 15 },
              { label: NetworkCopy.normalBlockTime[cs ? 'cs' : 'en'], ok: chainStats.avg_block_time > 0 && chainStats.avg_block_time < 180, weight: 15 },
              { label: 'P2P Peers', ok: chainStats.total_connections >= 1, weight: 10 },
              { label: 'Mempool', ok: true, weight: 5 },
              { label: NetworkCopy.databaseOk[cs ? 'cs' : 'en'], ok: chainStats.database_size > 0, weight: 5 },
              { label: NetworkCopy.poolOnline[cs ? 'cs' : 'en'], ok: chainStats.pool_hashrate > 0 || chainStats.active_miners > 0, weight: 5 },
            ];
            const score = checks.reduce((acc, c) => acc + (c.ok ? c.weight : 0), 0);
            const scoreColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-zion-gold' : score >= 50 ? 'text-amber-400' : 'text-red-400';
            const scoreBorder = score >= 90 ? 'border-emerald-400/30' : score >= 70 ? 'border-zion-gold/30' : score >= 50 ? 'border-amber-400/30' : 'border-red-400/30';
            const scoreGlow = score >= 90 ? 'shadow-emerald-400/20' : score >= 70 ? 'shadow-zion-gold/20' : score >= 50 ? 'shadow-amber-400/20' : 'shadow-red-400/20';

            return (
              <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
                {/* Score circle */}
                <div className="flex flex-col items-center justify-center">
                  <div className={`relative w-40 h-40 rounded-full border-4 ${scoreBorder} flex items-center justify-center shadow-lg ${scoreGlow}`}>
                    <div className="text-center">
                      <p className={`text-5xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
                      <p className="text-xs text-gray-500 mt-1">{NetworkCopy.of100[cs ? 'cs' : 'en']}</p>
                    </div>
                    <svg className="absolute inset-0" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="74" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                      <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                        className={scoreColor}
                        strokeDasharray={`${(score / 100) * 465} 465`}
                        transform="rotate(-90 80 80)"
                      />
                    </svg>
                  </div>
                  <p className={`mt-4 text-sm font-semibold ${scoreColor}`}>
                    {score >= 90 ? (NetworkCopy.excellent[cs ? 'cs' : 'en']) : score >= 70 ? (NetworkCopy.good[cs ? 'cs' : 'en']) : score >= 50 ? (NetworkCopy.fair[cs ? 'cs' : 'en']) : (NetworkCopy.critical[cs ? 'cs' : 'en'])}
                  </p>
                </div>

                {/* Check items */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {checks.map((c) => (
                    <div key={c.label} className="zion-rainbow-sub p-4" style={{ '--rc': c.ok ? '52, 211, 153' : '248, 113, 113' } as React.CSSProperties}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${c.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-[11px] text-gray-400 uppercase tracking-wider">{c.label}</span>
                      </div>
                      <p className={`text-lg font-bold ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>{c.ok ? (NetworkCopy.ok[cs ? 'cs' : 'en']) : (NetworkCopy.fail[cs ? 'cs' : 'en'])}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{c.weight} {NetworkCopy.pts[cs ? 'cs' : 'en']}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
        )}

        {/* ═══════ CHAIN PERFORMANCE ═══════ */}
        {chainStats && (
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.performance[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-cyan" />
              {NetworkCopy.chainPerformance[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.liveSparklinesForHashrateDiffi[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Hashrate */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{NetworkCopy.networkHashrate[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{chainStats.network_hashrate_formatted}</p>
                </div>
              </div>
              <NetSparkline data={hashrateHistory.map(p => p.value)} color="rgb(52, 211, 153)" height={80} />
            </div>

            {/* Difficulty */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{NetworkCopy.difficulty[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-zion-cyan font-mono mt-1">{fmtLargeNum(chainStats.difficulty)}</p>
                </div>
              </div>
              <NetSparkline data={difficultyHistory.map(p => p.value)} color="rgb(34, 211, 238)" height={80} />
            </div>

            {/* Block Time */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{NetworkCopy.avgBlockTime[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-blue-400 font-mono mt-1">{chainStats.avg_block_time}s</p>
                </div>
                <span className="text-xs text-gray-500">{NetworkCopy.target[cs ? 'cs' : 'en']}: {chainStats.target_block_time ?? BLOCK_TIME_SECONDS}s</span>
              </div>
              <NetSparkline data={blockTimeHistory.map(p => p.value)} color="rgb(96, 165, 250)" height={80} />
            </div>
          </div>
        </section>
        )}

        {/* ═══════ 24-HOUR TRENDS ═══════ */}
        <Network24hCharts
          cs={cs}
          hashrateData={hashrateHistory.map((p) => p.value)}
          difficultyData={difficultyHistory.map((p) => p.value)}
          blockTimeData={blockTimeHistory.map((p) => p.value)}
        />

        {/* ═══════ HISTORICAL TRENDS (extended) ═══════ */}
        <NetworkHistoricalCharts />

        {/* ═══════ CHAIN STATISTICS ═══════ */}
        {chainStats && (
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.statistics[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-zion-gold" />
              {NetworkCopy.chainStatistics[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.detailedMetricsFromTheLiveBloc[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <ChainStatCard label={NetworkCopy.blockHeight[cs ? 'cs' : 'en']} value={chainStats.block_height.toLocaleString(locale)} color="text-zion-gold" tip={NetworkCopy.totalNumberOfMinedBlocksSinceG[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.difficulty[cs ? 'cs' : 'en']} value={fmtLargeNum(chainStats.difficulty)} color="text-zion-cyan" tip={NetworkCopy.currentMiningDifficultySetByLw[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.cumulativeDiff[cs ? 'cs' : 'en']} value={fmtLargeNum(chainStats.cumulative_difficulty)} color="text-zion-cyan" tip={NetworkCopy.sumOfDifficultyAcrossAllBlocks[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.circulatingSupply[cs ? 'cs' : 'en']} value={`${fmtLargeNum(chainStats.circulating_supply)} ZION`} color="text-zion-gold" tip={NetworkCopy.totalZionInCirculationIncludin[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.emission[cs ? 'cs' : 'en']} value={`${chainStats.emission_pct}%`} color="text-pink-400" tip={NetworkCopy.percentageOfTotalSupplyMinedAc[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.totalTx[cs ? 'cs' : 'en']} value={chainStats.tx_count.toLocaleString(locale)} color="text-purple-400" tip={NetworkCopy.totalNumberOfTransactionsRecor[cs ? 'cs' : 'en']} />
            <ChainStatCard label="Mempool" value={`${chainStats.tx_pool_size} tx`} color={chainStats.tx_pool_size > 0 ? 'text-amber-400' : 'text-gray-400'} tip={NetworkCopy.transactionsWaitingForConfirma[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.totalPeers[cs ? 'cs' : 'en']} value={`${chainStats.total_connections}`} sub={`↓${chainStats.incoming_connections} ↑${chainStats.outgoing_connections}`} color="text-purple-400" tip={NetworkCopy.activeP2pConnectionsIncomingAn[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.knownPeers[cs ? 'cs' : 'en']} value={`${chainStats.white_peerlist_size}`} sub={`${chainStats.grey_peerlist_size} grey`} color="text-indigo-400" tip={NetworkCopy.knownWhiteAndUnknownGreyPeerLi[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.blockSizeLimit[cs ? 'cs' : 'en']} value={fmtBytes(chainStats.block_size_limit)} sub={`${NetworkCopy.median[cs ? 'cs' : 'en']}: ${fmtBytes(chainStats.block_size_median)}`} color="text-cyan-400" tip={NetworkCopy.maximumAndMedianBlockSizeInByt[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.database[cs ? 'cs' : 'en']} value={fmtBytes(chainStats.database_size)} color="text-pink-400" tip={NetworkCopy.sizeOfTheLocalBlockchainDataba[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.version[cs ? 'cs' : 'en']} value={chainStats.version ? `v${chainStats.version}` : '—'} color="text-gray-300" tip={NetworkCopy.nodeSoftwareVersion[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.altBlocks[cs ? 'cs' : 'en']} value={`${chainStats.alt_blocks_count ?? 0}`} color="text-amber-400" tip={NetworkCopy.numberOfAlternativeBranchesOrp[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.activeMiners[cs ? 'cs' : 'en']} value={`${chainStats.active_miners}`} color="text-emerald-400" tip={NetworkCopy.numberOfActiveMinersConnectedT[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.poolHashrate[cs ? 'cs' : 'en']} value={chainStats.pool_hashrate_formatted || '—'} color="text-emerald-400" tip={NetworkCopy.totalComputationalPowerOfAllMi[cs ? 'cs' : 'en']} />
            <ChainStatCard label={NetworkCopy.poolBlocks[cs ? 'cs' : 'en']} value={`${chainStats.pool_blocks_found ?? 0}`} color="text-zion-gold" tip={NetworkCopy.numberOfBlocksFoundByThisPool[cs ? 'cs' : 'en']} />
            {chainStats.last_block && (
              <>
                <ChainStatCard label={NetworkCopy.lastBlock[cs ? 'cs' : 'en']} value={`#${chainStats.last_block.height.toLocaleString(locale)}`} sub={new Date(chainStats.last_block.timestamp * 1000).toLocaleTimeString(locale)} color="text-zion-gold" tip={NetworkCopy.latestConfirmedBlockAndItsMini[cs ? 'cs' : 'en']} />
                <ChainStatCard label={NetworkCopy.lastReward[cs ? 'cs' : 'en']} value={`${(chainStats.last_block.reward / 1e6).toFixed(2)} ZION`} color="text-emerald-400" tip={NetworkCopy.rewardForTheLatestBlockPerDeca[cs ? 'cs' : 'en']} />
              </>
            )}
          </div>
        </section>
        )}

        {/* ═══════ CONSENSUS HEALTH ═══════ */}
        <NetworkConsensusMetrics />

        {/* ═══════ EMISSION PROGRESS ═══════ */}
        {chainStats && (
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.emission[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Coins className="h-7 w-7 text-zion-gold" />
              {NetworkCopy.emissionProgress[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.decadeDecayModel20Every10Years[cs ? 'cs' : 'en']}</p>
          </div>

          {/* Overall progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{NetworkCopy.mined[cs ? 'cs' : 'en']}: {chainStats.emission_pct}%</span>
              <span className="text-sm text-gray-400">{fmtLargeNum(chainStats.circulating_supply)} / {fmtLargeNum(TOTAL_SUPPLY_ZION)} ZION</span>
            </div>
            <div className="h-4 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-zion-gold via-emerald-400 to-zion-cyan transition-all duration-500" style={{ width: `${Math.min(100, Number(chainStats.emission_pct))}%` }} />
            </div>
          </div>

          {/* Decade table */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => {
              const decadeStart = i * BLOCKS_PER_DECADE + 1;
              const decadeEnd = (i + 1) * BLOCKS_PER_DECADE;
              const reward = blockRewardAtHeight(decadeStart);
              const currentDecade = Math.floor((chainStats.block_height - 1) / BLOCKS_PER_DECADE);
              const isCurrent = i === currentDecade;
              const isPast = i < currentDecade;
              return (
                <div key={i} className="zion-rainbow-sub p-4" style={{ '--rc': isCurrent ? '251, 191, 36' : isPast ? '52, 211, 153' : '255, 255, 255' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">{NetworkCopy.decade[cs ? 'cs' : 'en']} {i + 1}</span>
                    {isCurrent && <span className="text-[9px] font-bold uppercase tracking-widest text-zion-gold bg-zion-gold/20 px-2 py-0.5 rounded-full">{NetworkCopy.now[cs ? 'cs' : 'en']}</span>}
                    {isPast && <span className="text-[9px] text-emerald-400">✓</span>}
                  </div>
                  <p className={`text-lg font-bold font-mono ${isCurrent ? 'text-zion-gold' : isPast ? 'text-emerald-400' : 'text-gray-400'}`}>{reward.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">ZION/{NetworkCopy.block[cs ? 'cs' : 'en']}</p>
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">{fmtLargeNum(decadeStart)}–{fmtLargeNum(decadeEnd)}</p>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* ═══════ INFRASTRUCTURE ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.infrastructure[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-gold" />
              {NetworkCopy.currentRuntime[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.currentPublicRuntimeIsA2NodeV3[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-1 lg:max-w-2xl">
            {infraFeatures.map((node) => (
              <div
                key={node.title}
                className="relative overflow-hidden zion-rainbow-sub p-6"
                style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
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
                    <span>{NetworkCopy.portEndpointsSeeNodeDescriptio[cs ? 'cs' : 'en']}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Terminal className="w-3.5 h-3.5 text-gray-500" />
                    <span>{NetworkCopy.rpcAutoFailoverAcross2NodeMesh[cs ? 'cs' : 'en']}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <span>{NetworkCopy.p2pMesh83338334Backup8335Offli[cs ? 'cs' : 'en']}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ v3.2.0 E2E STACK ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">v3.2.0 E2E</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-zion-gold" />
              {NetworkCopy.e2eStack[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {NetworkCopy.allV306ComponentsHaveBeenVerif[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: CheckCircle,
                title: NetworkCopy.k1111Services[cs ? 'cs' : 'en'],
                detail: NetworkCopy.nodePoolWatchersBridgeWebDashb[cs ? 'cs' : 'en'],
              },
              {
                icon: Shield,
                title: NetworkCopy.f47F5Active[cs ? 'cs' : 'en'],
                detail: NetworkCopy.maxTxAmountCapAndSenderBalance[cs ? 'cs' : 'en'],
              },
              {
                icon: FileText,
                title: NetworkCopy.memoE2eTests[cs ? 'cs' : 'en'],
                detail: NetworkCopy.k3AccountModelTxsWithMemosConfi[cs ? 'cs' : 'en'],
              },
              {
                icon: Activity,
                title: NetworkCopy.memoryLeakFix[cs ? 'cs' : 'en'],
                detail: NetworkCopy.poolNodeMemoryLeaksFixedWatchd[cs ? 'cs' : 'en'],
              },
              {
                icon: Terminal,
                title: NetworkCopy.rpcAuditLog[cs ? 'cs' : 'en'],
                detail: NetworkCopy.nodeRpcAuditLogForSecurityFore[cs ? 'cs' : 'en'],
              },
              {
                icon: Lock,
                title: NetworkCopy.apparmorUfw[cs ? 'cs' : 'en'],
                detail: NetworkCopy.edgeServerIsProtectedByApparmo[cs ? 'cs' : 'en'],
              },
              {
                icon: Globe,
                title: NetworkCopy.bridgeBaseMainnet[cs ? 'cs' : 'en'],
                detail: NetworkCopy.zionbridgeAndL2WatchersSynchro[cs ? 'cs' : 'en'],
              },
              {
                icon: Server,
                title: NetworkCopy.k2NodeMesh[cs ? 'cs' : 'en'],
                detail: NetworkCopy.edge1AndEdge2Within2BlockSyncL[cs ? 'cs' : 'en'],
              },
            ].map((item) => (
              <div key={item.title} className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <item.icon className="h-6 w-6 text-zion-gold mb-3" />
                <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ ACTIVE ALGORITHM ═══════ */}
        <NetworkAlgorithmPanel cs={cs} />

        {/* ═══════ BLOCK REWARD DISTRIBUTION ═══════ */}
        <NetworkRewardDistribution cs={cs} />

        {/* ═══════ LIVE TELEMETRY ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.liveTelemetry[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {NetworkCopy.nodeStatus[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.realTimeHealthBlockHeightHashr[cs ? 'cs' : 'en']}</p>
          </div>
          <NetworkStatus className="max-w-none" />
        </section>

        {/* ═══════ MONITORING SNAPSHOT ═══════ */}
        <NetworkMonitoringSnapshot />

        {/* ═══════ LIVE NETWORK FEED ═══════ */}
        <NetworkEventsFeed cs={cs} />

        {/* ═══════ NETWORK MAP + POOL FINDER ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.geography[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-cyan" />
              {NetworkCopy.networkMapPoolFinder[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.visualizeTheCurrentTopologyAnd[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <NetworkMap />
            </div>
            <PoolFinder />
          </div>
        </section>

        {/* ═══════ P2P MESH TOPOLOGY ═══════ */}
        <NetworkTopology />

        {/* ═══════ CONNECTION GUIDES ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.connect[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              {NetworkCopy.connectionGuides[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.everythingYouNeedToConnectAMin[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {guideBlocks.map((block) => (
              <div
                key={block.title}
                className="zion-rainbow-sub p-6 space-y-4"
                style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <block.icon className="h-5 w-5 text-zion-gold" />
                  <h3 className="text-lg font-semibold text-white">{block.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{block.description}</p>
                <div className="zion-rainbow-sub p-4 space-y-1 overflow-x-auto" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                  {block.items.map((line) => (
                    <code key={line} className="block text-sm font-mono text-zion-gold whitespace-nowrap">{line}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ NETWORK CHECKLIST ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkCopy.status[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {NetworkCopy.networkReadiness[cs ? 'cs' : 'en']}
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
            <span>{NetworkCopy.completed[cs ? 'cs' : 'en']}</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(factsDone / factsTotal) * 100}%` }} />
            </div>
          </div>
        </section>

        {/* ═══════ OPERATOR TOOLKIT ═══════ */}
        <NetworkOperatorToolkit primaryPool={primaryPool} />

        {/* ═══════ NETWORK FAQ ═══════ */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">FAQ</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Hash className="h-7 w-7 text-purple-400" />
              {NetworkCopy.frequentlyAskedQuestions[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{NetworkCopy.everythingAboutTheZionNetworkI[cs ? 'cs' : 'en']}</p>
          </div>
          <NetFAQSection cs={cs} />
        </section>

        {/* ═══════ CTA ═══════ */}
        <section className="zion-cta-banner">
          <Radio className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{NetworkCopy.joinTheZionNetwork[cs ? 'cs' : 'en']}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {NetworkCopy.nativeRustInfrastructureRunnin[cs ? 'cs' : 'en']}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · Public launch target 31.12.2026
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {[
              'Cosmic Harmony PoW',
              NetworkCopy.primaryHostLive[cs ? 'cs' : 'en'],
              NetworkCopy.internalSeeds[cs ? 'cs' : 'en'],
              NetworkCopy.dockerNative[cs ? 'cs' : 'en'],
              NetworkCopy.archivedMultiHostHistory[cs ? 'cs' : 'en'],
            ].map((item) => (
              <span key={item} className="zion-badge-gold">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="zion-button-secondary">
              <Activity className="h-4 w-4" /> {NetworkCopy.explorer[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/roadmap" className="zion-button-primary">
              <Rocket className="h-4 w-4" /> {NetworkCopy.roadmap[cs ? 'cs' : 'en']}
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
        </section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} - P2P Síť Pro · 2-uzlový mesh · v3.2.0 E2E Trinity`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} - P2P Network Pro · 2-node mesh · v3.2.0 E2E Trinity`}
        </p>
      </div>

      <LiveToast currentHeight={blockHeight} />
    </div>
  );
}

function SurfaceSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="zion-rainbow-sub p-6 space-y-3" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 w-full rounded bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

/* ─── NetSparkline ─── */
function NetSparkline({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return <div className="flex items-center justify-center" style={{ height }}><span className="text-xs text-gray-500">collecting…</span></div>;
  const w = 260;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
    </svg>
  );
}

/* ─── ChainStatCard ─── */
function ChainStatCard({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color: string; tip?: string }) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 zion-tile px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className={`text-lg font-bold font-mono ${color} truncate`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

/* ─── NetFAQSection ─── */
function NetFAQSection({ cs }: { cs: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: NetworkCopy.whatConsensusDoesZionUse[cs ? 'cs' : 'en'], a: NetworkCopy.cosmicHarmonyProofOfWorkACusto[cs ? 'cs' : 'en'] },
    { q: NetworkCopy.whatIsTheTargetBlockTime[cs ? 'cs' : 'en'], a: NetworkCopy.k60SecondsDifficultyAdjustsDyna[cs ? 'cs' : 'en'] },
    { q: NetworkCopy.howManyZionAreMinedPerBlock[cs ? 'cs' : 'en'], a: cs ? `V první dekádě je odměna ${BLOCK_REWARD_ZION.toFixed(3)} ZION/blok. Každých 10 let (${BLOCKS_PER_DECADE.toLocaleString()} bloků) se odměna sníží o 20 % (Decade Decay).` : `In the first decade the reward is ${BLOCK_REWARD_ZION.toFixed(3)} ZION/block. Every 10 years (${BLOCKS_PER_DECADE.toLocaleString()} blocks) the reward decreases by 20% (Decade Decay).` },
    { q: NetworkCopy.whatIsTheMaximumSupply[cs ? 'cs' : 'en'], a: cs ? `Maximální supply je ${(TOTAL_SUPPLY_ZION / 1e9).toFixed(0)} miliard ZION včetně genesis premine ${(GENESIS_PREMINE_ZION / 1e9).toFixed(2)} mld ZION.` : `Maximum supply is ${(TOTAL_SUPPLY_ZION / 1e9).toFixed(0)} billion ZION including genesis premine of ${(GENESIS_PREMINE_ZION / 1e9).toFixed(2)}B ZION.` },
    { q: NetworkCopy.howToConnectAsAMiner[cs ? 'cs' : 'en'], a: cs ? `Stáhněte si XMRig nebo Desktop App a použijte stratum+tcp://${SITE_POOL_PRIMARY} jako pool adresu. Detaily najdete v Connection Guides výše.` : `Download XMRig or the Desktop App and use stratum+tcp://${SITE_POOL_PRIMARY} as the pool address. See the Connection Guides section above for details.` },
    { q: NetworkCopy.howToRunYourOwnFullNode[cs ? 'cs' : 'en'], a: cs ? `Klonujte repo, spusťte cargo build --release v V3/core a pak ./target/release/zion-node --p2p-bind-ip 0.0.0.0 --add-exclusive-node ${SITE_PRIMARY_HOST}:8333 --add-exclusive-node ${SITE_PRIMARY_HOST}:8334. Docker compose je k dispozici v docker/docker-compose.mainnet.yml.` : `Clone the repo, cargo build --release from V3/core and then ./target/release/zion-node --p2p-bind-ip 0.0.0.0 --add-exclusive-node ${SITE_PRIMARY_HOST}:8333 --add-exclusive-node ${SITE_PRIMARY_HOST}:8334. Docker compose is available in docker/docker-compose.mainnet.yml.` },
    { q: NetworkCopy.whatPoolFeeDoesZionCharge[cs ? 'cs' : 'en'], a: NetworkCopy.k89GoesToTheMiner5ToTheHumanita[cs ? 'cs' : 'en'] },
    { q: NetworkCopy.isTheNetworkPubliclyLaunched[cs ? 'cs' : 'en'], a: NetworkCopy.mainnetGenesisTookPlaceOn11Jun[cs ? 'cs' : 'en'] },
  ];
  return (
    <div className="divide-y divide-white/[0.06]">
      {faqs.map((f, i) => (
        <div key={i}>
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between py-4 text-left gap-4 group">
            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">{f.q}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="pb-4 text-sm text-gray-400 leading-relaxed">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

/* ─── formatters ─── */
function fmtLargeNum(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}
