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
import { SITE_RELEASE_LABEL } from '@/lib/site';
import { useLang } from '@/contexts/LanguageContext';

const RoadmapCopy = {
  deekshaliteFire128Kib16Passes5: { cs: `DeekshaLite Fire: 128 KiB, 16 průchodů, 512 čtení (hot kernel)`, en: `DeekshaLite Fire: 128 KiB, 16 passes, 512 reads (hot kernel)` },
  deekshaliteV1256Kib2Passes64Re: { cs: `DeekshaLite v1: 256 KiB, 2 průchody, 64 čtení (letní úsporný režim)`, en: `DeekshaLite v1: 256 KiB, 2 passes, 64 reads (summer energy-save mode)` },
  seasonalFireLiteSwitchingAutoR: { cs: `Sezónní přepínání Fire ↔ Lite — auto-restart mineru`, en: `Seasonal Fire ↔ Lite switching — auto-restart miner` },
  epochRotatingNpuWeights2016100: { cs: `Epoch-rotující NPU váhy — 2016/100 bloků (Tier 2)`, en: `Epoch-rotating NPU weights — 2016/100 blocks (Tier 2)` },
  decadeDecayEmission5400724Zion: { cs: `Decade Decay emise: 5 400 → 724 ZION/blok (100+ let + tail ∞)`, en: `Decade Decay emission: 5,400 → 724 ZION/block (100+ years + tail ∞)` },
  k1628bGenesisReservePublicSumma: { cs: `16,28B genesis reserve (veřejný souhrn)`, en: `16.28B genesis reserve (public summary)` },
  feeBurningAllFeesDestroyed: { cs: `Spalování poplatků — VŠECHNY poplatky zničeny`, en: `Fee burning — ALL fees destroyed` },
  distribution89Miner5Humanit5Is: { cs: `Distribuce: 89% miner · 5% humanit. · 5% Issobella · 1% pool`, en: `Distribution: 89% miner · 5% humanit. · 5% Issobella · 1% pool` },
  dualMiningZionChv3VrscVerushas: { cs: `Dual-mining: ZION (CHv3) + VRSC (VerusHash)`, en: `Dual-mining: ZION (CHv3) + VRSC (VerusHash)` },
  miningPoolStratumV2Pplns: { cs: `Mining pool (Stratum v2, PPLNS)`, en: `Mining pool (Stratum v2, PPLNS)` },
  p2pNetworkIbdSyncBootstrapPeer: { cs: `P2P síť, IBD sync, bootstrap peers`, en: `P2P network, IBD sync, bootstrap peers` },
  defiUiSwapBridgePortfolioOnZio: { cs: `DeFi UI — swap, bridge, portfolio na zionterranova.com/defi ✅`, en: `DeFi UI — swap, bridge, portfolio on zionterranova.com/defi ✅` },
  defiPagesBridgeDaoWarpBilingua: { cs: `DeFi stránky — bridge/dao/warp bilingvální + mainnet ✅`, en: `DeFi pages — bridge/dao/warp bilingual + mainnet ✅` },
  liquiditySeeded50Wzion00005Wet: { cs: `Likvidita nasazena: 50 wZION + 0.0005 WETH ✅`, en: `Liquidity seeded: 50 wZION + 0.0005 WETH ✅` },
  k2026Implementation2027GatedPro: { cs: `2026 implementace · 2027 gated produkce`, en: `2026 implementation · 2027 gated production` },
  nclAiTaskMarketplace: { cs: `NCL — AI task marketplace`, en: `NCL — AI task marketplace` },
  ethereumCorridorLiveOnBaseMain: { cs: `Ethereum corridor živě na Base Mainnet ✅`, en: `Ethereum corridor live on Base Mainnet ✅` },
  goldenEggTreasureHunt108Clues8: { cs: `Golden Egg poklad (108 stop, 8,25B ZION) — plánováno 2027`, en: `Golden Egg treasure hunt (108 clues, 8.25B ZION) — Planned 2027` },
  guildSystemTerritoriesPlanned2: { cs: `Guildy a teritoria — plánováno 2028`, en: `Guild system & territories — Planned 2028` },
  ue5IntegrationPlanned20282029: { cs: `UE5 integrace — plánováno 2028–2029`, en: `UE5 integration — Planned 2028–2029` },
  freeEnergyQuantumEngineRD: { cs: `Free energy quantum engine R&D`, en: `Free energy quantum engine R&D` },
  zionIssobellaStationConceptRoa: { cs: `Stanice ZION Issobella — koncept & roadmap plánováno 2030+`, en: `ZION Issobella Station — concept & roadmap Planned 2030+` },
  orbitalMiningDeepSpaceResearch: { cs: `Orbitální těžba & výzkum hlubokého vesmíru — plánováno 2030+`, en: `Orbital mining & deep-space research — Planned 2030+` },
  websiteV29DefiLive: { cs: `website-v2.9/ (DeFi live)`, en: `website-v2.9/ (DeFi live)` },
  specFreezeCoreRewrite: { cs: `Zmrazení specifikace & přepis jádra`, en: `Spec Freeze & Core Rewrite` },
  feb2026Completed9Feb: { cs: `Únor 2026 (dokončeno 9. úno)`, en: `Feb 2026 (completed 9 Feb)` },
  k155Tests8CommitsEmissionDaaFee: { cs: `155 testů, 8 commitů. Emise, DAA, fee market, wallet, consensus hardening — vše zmrazeno.`, en: `155 tests, 8 commits. Emission, DAA, fee market, wallet, consensus hardening — all frozen.` },
  repoMigrationCleanRepoWorkspac: { cs: `Migrace repozitáře — čistý repo, workspace, Docker, CI/CD`, en: `Repo Migration — clean repo, workspace, Docker, CI/CD` },
  emissionGenesis5400ZionBlock16: { cs: `Emise & Genesis — 5 400 ZION/blok, 16,28B reserve`, en: `Emission & Genesis — 5,400 ZION/block, 16.28B reserve` },
  daaConsensusLwma60Block25ForkC: { cs: `DAA & Konsensus — LWMA 60-blok, ±25%, fork-choice`, en: `DAA & Consensus — LWMA 60-block, ±25%, fork-choice` },
  feeMarketMempoolFeeBurningDoub: { cs: `Fee Market & Mempool — spalování, double-spend, eviction`, en: `Fee Market & Mempool — fee burning, double-spend, eviction` },
  walletTxUtxoSelectEd25519Broad: { cs: `Peněženka & TX — UTXO select, Ed25519, broadcast, E2E`, en: `Wallet & TX — UTXO select, Ed25519, broadcast, E2E` },
  consensusHardeningMaturity100R: { cs: `Hardening konsensu — maturity=100, reorg=10, finalita=60`, en: `Consensus Hardening — maturity=100, reorg=10, finality=60` },
  unitTestsForNewRewardModel: { cs: `Unit testy pro nový model odměn`, en: `Unit tests for new reward model` },
  genesisProduces1628bReserve: { cs: `Genesis produkuje 16,28B reserve`, en: `Genesis produces 16.28B reserve` },
  lwmaDaaDeterministic: { cs: `LWMA DAA deterministické`, en: `LWMA DAA deterministic` },
  maxReorgDepth10Enforced: { cs: `Max reorg hloubka = 10 vynucena`, en: `Max reorg depth = 10 enforced` },
  coinbaseMaturity100Enforced: { cs: `Coinbase maturity = 100 vynucena`, en: `Coinbase maturity = 100 enforced` },
  walletSendE2eWorking: { cs: `Wallet send E2E funkční`, en: `Wallet send E2E working` },
  networkIdentityDeployChainRese: { cs: `Identita sítě & Deploy — chain reset, Docker, 3 servery`, en: `Network Identity & Deploy — chain reset, Docker, 3-server` },
  configValidationTomlParsingBou: { cs: `Validace konfigurace — TOML parsing, hraniční kontroly`, en: `Config Validation — TOML parsing, boundary checks` },
  securityEdgeCaseReorgDoubleSpe: { cs: `Bezpečnost & Edge-Case — reorg, double-spend, fork-choice`, en: `Security & Edge-Case — reorg, double-spend, fork-choice` },
  ibdHardeningTimeoutsStallDetec: { cs: `IBD Hardening — timeouty, detekce stall, peer scoring`, en: `IBD Hardening — timeouts, stall detection, peer scoring` },
  poolPayoutIntegrationBatchTxPo: { cs: `Pool Payout — batch TX, PoolWallet, JSON-RPC`, en: `Pool Payout Integration — batch TX, PoolWallet, JSON-RPC` },
  buybackDaoTreasury100DaoRevenu: { cs: `Buyback + DAO Treasury — 100% DAO revenue, burn adresa`, en: `Buyback + DAO Treasury — 100% DAO revenue, burn address` },
  supplyBuybackApiGetsupplyinfoG: { cs: `Supply + Buyback API — getSupplyInfo, getNetworkInfo`, en: `Supply + Buyback API — getSupplyInfo, getNetworkInfo` },
  p2pRateLimiting200MsgsPeer60sE: { cs: `P2P Rate-Limiting — 200 zpráv/peer/60s, eskalující bany`, en: `P2P Rate-Limiting — 200 msgs/peer/60s, escalating bans` },
  healthCheckMetricsGethealthche: { cs: `Health Check & Metriky — getHealthCheck, getMetrics`, en: `Health Check & Metrics — getHealthCheck, getMetrics` },
  stressTestSuiteHighTxRapidBloc: { cs: `Stress Test Suite — vysoký TX, rychlé bloky, partition`, en: `Stress Test Suite — high TX, rapid blocks, partition` },
  k168hStabilityRunArchivedMultiH: { cs: `168h stabilita — archivovaný multi-host run, žádný kritický incident`, en: `168h Stability Run — archived multi-host validation, no critical incident` },
  livePartitionTestNodeIsolation: { cs: `Live Partition Test — izolace nodu 30 min, reconnect`, en: `Live Partition Test — node isolation 30 min, reconnect` },
  k100MinersStressSimulate100Stra: { cs: `100 minerů stres — simulace 100 Stratum klientů`, en: `100 Miners Stress — simulate 100 Stratum clients` },
  edgeServerTopologyPrivateNetwo: { cs: `Edge server Topology — private network, ShareRelay pool`, en: `Edge server Topology — private network, ShareRelay pool` },
  feeSplit89551CanonicalAddresse: { cs: `Fee Split 89/5/5/1 — kanonické adresy, Genesis premine`, en: `Fee Split 89/5/5/1 — canonical addresses, Genesis premine` },
  dcrBackdoorRemovedStealthWorke: { cs: `DCR backdoor odstraněn — stealth worker pro cizí peněženku`, en: `DCR backdoor removed — stealth worker for foreign wallet` },
  gpuCpuPathSeparationAlgorithmA: { cs: `GPU/CPU path oddělení — algorithm-aware pool validace`, en: `GPU/CPU path separation — algorithm-aware pool validation` },
  seasonalFireLiteSwitchingAutoR_2: { cs: `Sezónní přepínání Fire ↔ Lite — auto-restart`, en: `Seasonal Fire ↔ Lite switching — auto-restart` },
  rdna1DetectionFixRx5700XtRecog: { cs: `RDNA1 detekce fix — RX 5700 XT rozpoznáno správně`, en: `RDNA1 detection fix — RX 5700 XT recognized correctly` },
  edgeAutoBackupSystemdTimerOffS: { cs: `Edge auto-backup — systemd timer + off-site snapshoty`, en: `Edge auto-backup — systemd timer + off-site snapshots` },
  nodeUxMining: { cs: `Node UX & Těžba`, en: `Node UX & Mining` },
  aprJun2026: { cs: `Duben — Červen 2026`, en: `Apr — Jun 2026` },
  nodeBootableIn10MinPerReadmeCl: { cs: `Node spustitelný za 10 min dle README + CLI guide. Mining guides publikovány. Block explorer live. GPU/CPU produkce — DeekshaLite Fire & Lite sezónní přepínání. Pool failover + algorithm-aware validace. RPC API 17 metod živě + dokumentace.`, en: `Node bootable in 10 min per README + CLI guide. Mining guides published. Block explorer live. GPU/CPU production — DeekshaLite Fire & Lite seasonal switching. Pool failover + algorithm-aware validation. RPC API 17 methods live + documented.` },
  nodeUxReadmeConfigTomlStructur: { cs: `Node UX — README, config.toml, strukturované logy, CLI`, en: `Node UX — README, config.toml, structured logging, CLI` },
  miningPolishCpuBaselineGpuProd: { cs: `Mining Polish — CPU baseline, GPU produkce, pool failover`, en: `Mining Polish — CPU baseline, GPU production, pool failover` },
  blockExplorerIndexerWebUiSuppl: { cs: `Block Explorer — indexer, web UI, supply API, rich list`, en: `Block Explorer — indexer, web UI, supply API, rich list` },
  miningGuideGpuCpuPoolDualMinin: { cs: `Mining Guide — GPU/CPU, pool, dual-mining ZION+VRSC`, en: `Mining Guide — GPU/CPU, pool, dual-mining ZION+VRSC` },
  cliReference17JsonRpcMethodsOp: { cs: `CLI Reference — 17 JSON-RPC metod + operator commands`, en: `CLI Reference — 17 JSON-RPC methods + operator commands` },
  seasonalFireLiteAutoSwitchTher: { cs: `Seasonal Fire ↔ Lite — auto-switch, thermal management`, en: `Seasonal Fire ↔ Lite — auto-switch, thermal management` },
  nodeBootableIn10MinPerReadme: { cs: `Node spustitelný za 10 min dle README`, en: `Node bootable in 10 min per README` },
  blockExplorerRunningAndIndexin: { cs: `Block explorer běží a indexuje`, en: `Block explorer running and indexing` },
  miningGuidesComplete: { cs: `Mining guides kompletní`, en: `Mining guides complete` },
  rpcApiDocumented: { cs: `RPC API zdokumentováno`, en: `RPC API documented` },
  poolFailoverAlgorithmAwareShar: { cs: `Pool failover + algorithm-aware share validace`, en: `Pool failover + algorithm-aware share validation` },
  seasonalFireLiteSwitching: { cs: `Sezónní Fire/Lite přepínání`, en: `Seasonal Fire/Lite switching` },
  infrastructureDefiLegal: { cs: `Infrastruktura, DeFi & Legal`, en: `Infrastructure, DeFi & Legal` },
  marMay2026: { cs: `Březen — Květen 2026`, en: `Mar — May 2026` },
  publicHostMonitoringZion2LiveP: { cs: `Veřejný host & Monitoring — Zion2 live, Prometheus + Grafana`, en: `Public Host & Monitoring — Zion2 live, Prometheus + Grafana` },
  dockerDeployRunbookComposeLive: { cs: `Docker & Deploy — runbook + compose + live web deploy flow`, en: `Docker & Deploy — runbook + compose + live web deploy flow` },
  legalComplianceDisclaimersToke: { cs: `Legal & Compliance — disclaimery, token-not-security, rizika`, en: `Legal & Compliance — disclaimers, token-not-security, risk` },
  wzionBridgeDeployedOnBaseMainn: { cs: `wZION + Bridge nasazeny na Base Mainnet`, en: `wZION + Bridge deployed on Base Mainnet` },
  uniswapV3PoolWzionWeth03Seeded: { cs: `Uniswap V3 pool wZION/WETH (0.3%) nasazen na Base Mainnet`, en: `Uniswap V3 pool wZION/WETH (0.3%) seeded on Base Mainnet` },
  defiUiFunctionalSwapBridgePort: { cs: `DeFi UI — funkční swap/bridge/portfolio na webu`, en: `DeFi UI — functional swap/bridge/portfolio on website` },
  defiL2PagesCleanupBridgeDaoWar: { cs: `DeFi L2 stránky — bridge/dao/warp bilingvální mainnet`, en: `DeFi L2 pages cleanup — bridge/dao/warp bilingual mainnet` },
  publicLaunchDecisionGenesis: { cs: `Rozhodnutí o veřejném launchi & Genesis`, en: `Public Launch Decision & Genesis` },
  target31December2026NewYearSEv: { cs: `Target: 31. prosinec 2026 (Silvestr)`, en: `Target: 31 December 2026 (New Year\'s Eve)` },
  mainnetGenesisTerranova11Jun20: { cs: `MainNet Genesis TerraNova 11. 6. 2026. Phase 1 Foundation kompletní. Veřejný launch pro všechny 31. 12. 2026. Zbývající blockery: finální payout verifikace, bezpečnostní audit, bridge validator provisioning a komunitní příprava.`, en: `MainNet Genesis TerraNova 11 Jun 2026. Phase 1 Foundation complete. Public launch for everyone 31 Dec 2026. Remaining blockers: final payout verification, security audit, bridge validator provisioning, and community preparation.` },
  finalPayoutVerificationPplnsWi: { cs: `Finální payout verifikace — PPLNS window validace`, en: `Final payout verification — PPLNS window validation` },
  securityAuditExternalFirmBooke: { cs: `Bezpečnostní audit — externí firma booked`, en: `Security audit — external firm booked` },
  bridgeValidatorKeyProvisioning: { cs: `Bridge validator provisioning — 3/5 threshold produkce`, en: `Bridge validator key provisioning — 3/5 threshold production` },
  communityPreparationDocumentat: { cs: `Komunitní příprava — dokumentace, tutoriály`, en: `Community preparation — documentation, tutorials` },
  ciBillingResolution: { cs: `CI billing resolution`, en: `CI billing resolution` },
  genesisFreezeAllParametersFroz: { cs: `Genesis freeze — všechny parametry zmrazeny`, en: `Genesis freeze — all parameters frozen` },
  communityAnnouncementWalletsAv: { cs: `Community oznámení + wallety ke stažení`, en: `Community announcement + wallets available` },
  finalNodeSoftwareRelease: { cs: `Finální release node software`, en: `Final node software release` },
  publicGenesisGoDecision: { cs: `🚀 Veřejný genesis — GO rozhodnutí`, en: `🚀 Public genesis — GO decision` },
  phase1FoundationComplete: { cs: `Phase 1 Foundation kompletní`, en: `Phase 1 Foundation complete` },
  finalPayoutVerification: { cs: `Finální payout verifikace`, en: `Final payout verification` },
  securityAuditNoCriticalHighFin: { cs: `Bezpečnostní audit — žádné critical/high nálezy`, en: `Security audit — no critical/high findings` },
  bridgeValidatorProvisioning35T: { cs: `Bridge validator provisioning — 3/5 threshold`, en: `Bridge validator provisioning — 3/5 threshold` },
  genesisBlockHashPublished: { cs: `Genesis block hash publikován`, en: `Genesis block hash published` },
  bootstrapHostsOnlinePublicInte: { cs: `Bootstrap hosty online (veřejný + interní quorum)`, en: `Bootstrap hosts online (public + internal quorum)` },
  poolSoloMiningOpen: { cs: `Pool + solo mining otevřen`, en: `Pool + solo mining open` },
  blockExplorerLive: { cs: `Block explorer živě`, en: `Block explorer live` },
  supplyApiLive: { cs: `Supply API živě`, en: `Supply API live` },
  k6aSilentMainnet: { cs: `6A: Tichý Mainnet`, en: `6A: Silent Mainnet` },
  days130: { cs: `Dny 1–30`, en: `Days 1–30` },
  k6bDexListings: { cs: `6B: DEX & Listingy`, en: `6B: DEX & Listings` },
  days1445: { cs: `Dny 14–45`, en: `Days 14–45` },
  defiUiOnZionterranovaComDefi: { cs: `DeFi UI na zionterranova.com/defi ✅`, en: `DeFi UI on zionterranova.com/defi ✅` },
  deepenLiquidityPriceDiscovery: { cs: `Prohloubit likviditu + price discovery`, en: `Deepen liquidity + price discovery` },
  days3060: { cs: `Dny 30–60`, en: `Days 30–60` },
  days45120: { cs: `Dny 45–120`, en: `Days 45–120` },
  ed25519SignatureVerification: { cs: `Ed25519 ověření podpisů`, en: `Ed25519 signature verification` },
  doubleSpendProtectionMempoolUt: { cs: `Double-spend ochrana (mempool + UTXO)`, en: `Double-spend protection (mempool + UTXO)` },
  overflowProtectionCheckedAdd: { cs: `Overflow ochrana (checked_add)`, en: `Overflow protection (checked_add)` },
  coinbaseMaturity100Blocks: { cs: `Coinbase maturity 100 bloků`, en: `Coinbase maturity 100 blocks` },
  reorgLimit10Blocks: { cs: `Reorg limit 10 bloků`, en: `Reorg limit 10 blocks` },
  timestampValidation120s: { cs: `Timestamp validace ±120s`, en: `Timestamp validation ±120s` },
  mempoolLimits50kTxMinFee: { cs: `Mempool limity (50k TX, min fee)`, en: `Mempool limits (50k TX, min fee)` },
  rpcAuthenticationApiKey: { cs: `RPC autentizace (API key)`, en: `RPC authentication (API key)` },
  blockSizeLimitMax1Mb: { cs: `Block size limit (max 1 MB)`, en: `Block size limit (max 1 MB)` },
  txSizeLimitMax100Kb: { cs: `TX size limit (max 100 KB)`, en: `TX size limit (max 100 KB)` },
  externalAudit: { cs: `Externí audit`, en: `External audit` },
  phase012NodeUxMining34PublicLa: { cs: `Fáze 0 ✅ → 1 ✅ → 2 ✅ (Node UX + Mining) → 3 ✅ → 4 🔄 → veřejný launch 31.12.`, en: `Phase 0 ✅ → 1 ✅ → 2 ✅ (Node UX + Mining) → 3 ✅ → 4 🔄 → public launch 31 Dec` },
  l2DefiDex: { cs: `L2 DeFi & DEX`, en: `L2 DeFi & DEX` },
  wzionBridgeUniV3DefiUiStakingP: { cs: `wZION Bridge ✅ · Uni V3 ✅ · DeFi UI ✅ · Staking plánován`, en: `wZION Bridge ✅ · Uni V3 ✅ · DeFi UI ✅ · Staking planned` },
  k20262027: { cs: `2026–2027`, en: `2026–2027` },
  warp77EthCorridorAiNative: { cs: `WARP 7/7 ✅ · ETH corridor ✅ · AI-native`, en: `WARP 7/7 ✅ · ETH corridor ✅ · AI-native` },
  ue5XpEconomyBeta: { cs: `UE5 · XP ekonomie · Beta`, en: `UE5 · XP economy · Beta` },
  humanitarianMissionsFreeEnergy: { cs: `Humanitární mise · Volná energie`, en: `Humanitarian missions · Free energy` },
  orbitalStationFund: { cs: `Orbitální stanice · Fond`, en: `Orbital Station · Fund` },
  k1501TestsPassing: { cs: `1 501 testů prochází`, en: `1,501 tests passing` },
  architecture: { cs: `Architektura`, en: `Architecture` },
  eachLayerIsIndependentL1IsNeve: { cs: `Každý layer je nezávislý. L1 nikdy nekompromitujeme kvůli vyšším vrstvám.`, en: `Each layer is independent. L1 is never compromised for higher layers.` },
  active: { cs: `Aktivní`, en: `Active` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  componentStatus: { cs: `Stav komponent`, en: `Component Status` },
  component: { cs: `Komponenta`, en: `Component` },
  tests: { cs: `Testy`, en: `Tests` },
  status: { cs: `Stav`, en: `Status` },
  readiness: { cs: `Připravenost`, en: `Readiness` },
  execution: { cs: `Exekuce`, en: `Execution` },
  everyPhaseHasClearExitCriteria: { cs: `Každá fáze má jasné exit criteria. Žádné zkratky.`, en: `Every phase has clear exit criteria. No shortcuts.` },
  done: { cs: `Dokončeno`, en: `Done` },
  active_2: { cs: `Probíhá`, en: `Active` },
  upcoming: { cs: `Plánováno`, en: `Upcoming` },
  phase: { cs: `Fáze`, en: `Phase` },
  tests_2: { cs: `testů`, en: `tests` },
  afterLaunch: { cs: `Po launchi`, en: `After Launch` },
  phase6PostLaunchExchange: { cs: `Fáze 6 · Post-Launch & Exchange`, en: `Phase 6 · Post-Launch & Exchange` },
  onlyAfterGoDecisionStabilityDe: { cs: `Pouze po GO rozhodnutí: stabilita → DEX → CEX → CMC/CG. Žádný hype první den.`, en: `Only after GO decision: stability → DEX → CEX → CMC/CG. No hype on day one.` },
  tier2CexAfterVolume: { cs: `Tier-2 CEX (po volume)`, en: `Tier-2 CEX (after volume)` },
  launchConstitutionDraft: { cs: `Návrh Launch Constitution`, en: `Launch Constitution Draft` },
  frozenParametersForPotentialPu: { cs: `Zmrazené parametry pro případný veřejný genesis, ne potvrzení launche`, en: `Frozen parameters for potential public genesis, not a launch confirmation` },
  k16280000000ZionPublicSummaryFo: { cs: `16 280 000 000 ZION — veřejný souhrn pro launch ekonomiku`, en: `16,280,000,000 ZION — public summary for launch economics` },
  security: { cs: `Bezpečnost`, en: `Security` },
  launchReadinessSecurityCheckli: { cs: `Security Checklist pro launch`, en: `Launch-Readiness Security Checklist` },
  completed: { cs: `dokončeno`, en: `completed` },
  publicLaunchGateReadyForLaunch: { cs: `Public launch gate · Ready for launch`, en: `Public launch gate · Ready for launch` },
  l1IsTheHeartWeBuildBottomUpMai: { cs: `L1 je srdce. Stavíme zdola nahoru. MainNet Genesis TerraNova 11. 6. 2026. Phase 1 Foundation kompletní. Veřejný launch pro všechny 31. 12. 2026. Zbývá dokončit blockery: finální payout verifikace, bezpečnostní audit a bridge validator provisioning.`, en: `L1 is the heart. We build bottom-up. MainNet Genesis TerraNova 11 Jun 2026. Phase 1 Foundation complete. Public launch for everyone 31 Dec 2026. Remaining blockers: final payout verification, security audit, and bridge validator provisioning.` },
  legalPositionZionProtocolNativ: { cs: `Právní pozice: ZION = protocol-native utility token, NE security. Žádné ICO/IEO/IDO. Tokeny jsou`, en: `Legal position: ZION = protocol-native utility token, NOT a security. No ICO/IEO/IDO. Tokens are` },
  k100YrsMining: { cs: `100+ let mining`, en: `100+ yrs mining` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  liveDashboard: { cs: `Živý dashboard`, en: `Live Dashboard` },
  lastUpdated: { cs: `Poslední aktualizace`, en: `Last updated` },
};

/* ═══════════════════════════════════════════════════════════
   DATA — authoritative source: ROADMAP.md + live deployment state
   Last full review: 23. May 2026
   ═══════════════════════════════════════════════════════════ */

const getHeroStats = (cs: boolean) => [
  { label: 'Rust LOC', value: '50,000+', descriptor: 'V3 workspace · L1–L4' },
  { label: 'Tests passing', value: '~1,470+', descriptor: '100% pass rate · last clean gate' },
  { label: 'Network', value: 'Genesis Launch', descriptor: 'V3 Mainnet · Edge server topology · mining live' },
  { label: 'Mainnet Status', value: 'Genesis 11 Jun 2026', descriptor: 'Public launch 31 Dec 2026 (New Year\'s Eve)' }
];

const getLayerStack = (cs: boolean) => [
  {
    layer: 'L1',
    emoji: '⛓️',
    title: 'ZION Blockchain (Launch Target)',
    period: '2026',
    color: 'from-emerald-500 to-lime-400',
    border: 'border-emerald-500/40',
    items: [
      'PoW Cosmic Harmony v3 — Ekam Deeksha ASIC-resistant',
      RoadmapCopy.deekshaliteFire128Kib16Passes5[cs ? 'cs' : 'en'],
      RoadmapCopy.deekshaliteV1256Kib2Passes64Re[cs ? 'cs' : 'en'],
      RoadmapCopy.seasonalFireLiteSwitchingAutoR[cs ? 'cs' : 'en'],
      RoadmapCopy.epochRotatingNpuWeights2016100[cs ? 'cs' : 'en'],
      'UTXO model + Ed25519 signatures',
      RoadmapCopy.decadeDecayEmission5400724Zion[cs ? 'cs' : 'en'],
      RoadmapCopy.k1628bGenesisReservePublicSumma[cs ? 'cs' : 'en'],
      'LWMA DAA (60-block, ±25%)',
      'TX hash v2 + BLAKE3 body root (BODY_ROOT_V2)',
      RoadmapCopy.feeBurningAllFeesDestroyed[cs ? 'cs' : 'en'],
      RoadmapCopy.distribution89Miner5Humanit5Is[cs ? 'cs' : 'en'],
      RoadmapCopy.dualMiningZionChv3VrscVerushas[cs ? 'cs' : 'en'],
      RoadmapCopy.miningPoolStratumV2Pplns[cs ? 'cs' : 'en'],
      RoadmapCopy.p2pNetworkIbdSyncBootstrapPeer[cs ? 'cs' : 'en'],
    ],
    active: true,
  },
  {
    layer: 'L2',
    emoji: '💱',
    title: 'DEX & DeFi Layer',
    period: '2026 live · 2027 production',
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/40',
    items: [
      'wZION Bridge — Base Mainnet live ✅',
      'Uniswap V3 pool wZION/WETH (0.3%) — Base Mainnet live ✅',
      RoadmapCopy.defiUiSwapBridgePortfolioOnZio[cs ? 'cs' : 'en'],
      RoadmapCopy.defiPagesBridgeDaoWarpBilingua[cs ? 'cs' : 'en'],
      RoadmapCopy.liquiditySeeded50Wzion00005Wet[cs ? 'cs' : 'en'],
      'ZIONStaking (12% APR, 7-day cooldown) — Base Mainnet ✅',
      'ZIONGovernance (stake-weighted voting) — Base Mainnet ✅',
      'ZIONFarm (MasterChef yield farming) — Base Mainnet ✅',
      'ZIONAtomicSwap (HTLC cross-chain) — Active ✅',
      'DAO governance daemon — Active ✅ (65 tests)',
    ],
    active: true,
  },
  {
    layer: 'L3',
    emoji: '🧠',
    title: 'NCL, WARP & AI-native',
    period: RoadmapCopy.k2026Implementation2027GatedPro[cs ? 'cs' : 'en'],
    color: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/40',
    items: [
      RoadmapCopy.nclAiTaskMarketplace[cs ? 'cs' : 'en'],
      'AI Orchestrator — agent routing',
      'WARP adapters 7/7 implemented ✅ (2026-03-02)',
      RoadmapCopy.ethereumCorridorLiveOnBaseMain[cs ? 'cs' : 'en'],
      'AI Native SDK',
    ],
    active: false,
  },
  {
    layer: 'L4',
    emoji: '🎮',
    title: 'ZION Oasis',
    period: '2028+',
    color: 'from-yellow-500 to-orange-500',
    border: 'border-yellow-500/40',
    items: [
      'Avatar system (51 core + 151 extended) — Active ✅',
      'Quest engine (5 quests per avatar) — Active ✅',
      'REST API (`/avatars`, `/quests`) — Active ✅',
      RoadmapCopy.goldenEggTreasureHunt108Clues8[cs ? 'cs' : 'en'],
      RoadmapCopy.guildSystemTerritoriesPlanned2[cs ? 'cs' : 'en'],
      RoadmapCopy.ue5IntegrationPlanned20282029[cs ? 'cs' : 'en'],
    ],
    active: false,
  },
  {
    layer: 'L5',
    emoji: '🌍',
    title: 'Free World',
    period: '2030+',
    color: 'from-amber-500 to-yellow-500',
    border: 'border-amber-500/40',
    items: [
      'Genesis Garden (Portugal) — Planned 2027',
      'Dharma Temple (La Palma) — Planned 2027–2028',
      'Te Piko Ora (French Polynesia) — Planned 2028–2029',
      'Community blueprint template — Planned 2027',
      'LoRa/Meshtastic off-grid mesh — Planned 2028',
      RoadmapCopy.freeEnergyQuantumEngineRD[cs ? 'cs' : 'en'],
    ],
    active: false,
  },
  {
    layer: 'L6',
    emoji: '🚀',
    title: 'ZION Issobella',
    period: '2040+',
    color: 'from-rose-500 to-red-500',
    border: 'border-rose-500/40',
    items: [
      'Research proposal system — Active ✅',
      'Funding allocation (5% fee split) — Active ✅',
      RoadmapCopy.zionIssobellaStationConceptRoa[cs ? 'cs' : 'en'],
      RoadmapCopy.orbitalMiningDeepSpaceResearch[cs ? 'cs' : 'en'],
    ],
    active: false,
  },
];

const constitution = [
  { param: 'Chain ID', value: 'zion-mainnet-1' },
  { param: 'Total Supply', value: '144,000,000,000 ZION' },
  { param: 'Mining Supply', value: '127,720,000,000 ZION' },
  { param: 'Genesis Reserve', value: '16,280,000,000 ZION' },
  { param: 'Block Reward (D1)', value: '5,400.067 ZION' },
  { param: 'Emission Model', value: 'Decade Decay (-20%/10y)' },
  { param: 'Tail Emission', value: '724.784723787776 ZION/block ∞' },
  { param: 'Block Time', value: '60 seconds' },
  { param: 'DAA', value: 'LWMA (60 blocks, ±25%)' },
  { param: 'Max Reorg', value: '10 blocks' },
  { param: 'Soft Finality', value: '60 blocks' },
  { param: 'Coinbase Maturity', value: '100 blocks' },
  { param: 'Consensus', value: 'PoW · Cosmic Harmony v3 + VRSC' },
  { param: 'Distribution', value: '89% miner · 5% hum. · 5% Issobella · 1% pool' },
  { param: 'Presale', value: '❌ NONE' },
  { param: 'Mining Horizon', value: '100+ years + tail ∞' },
];

const premineAllocation = [
  { category: 'OASIS Golden Egg reserve', zion: '8,250,000,000', share: '50.7%', lock: 'Public summary only' },
  { category: 'DAO Treasury', zion: '4,000,000,000', share: '24.6%', lock: 'Immediately available' },
  { category: 'Infrastructure & development', zion: '2,590,000,000', share: '15.9%', lock: 'Operational envelope' },
  { category: 'Humanitarian seed', zion: '1,440,000,000', share: '8.8%', lock: 'Immediately available' },
];

const getComponentStatus = (cs: boolean) => [
  { name: 'core/ (blockchain)', loc: '~22.7k', tests: 433, status: '✅', readiness: 94 },
  { name: 'cosmic-harmony/ (PoW)', loc: '~18.3k', tests: 122, status: '✅', readiness: 95 },
  { name: 'pool/ (mining pool)', loc: '~19.5k', tests: 115, status: '✅', readiness: 93 },
  { name: 'miner/ (universal)', loc: '~14.5k', tests: 79, status: '✅', readiness: 90 },
  { name: 'bridge/ (L2 wZION)', loc: '~7k', tests: 167, status: '✅', readiness: 88 },
  { name: 'dao/ (L2 governance)', loc: '~5k', tests: 63, status: '✅', readiness: 80 },
  { name: 'warp/ (L3 multichain)', loc: '~8k', tests: 237, status: '✅', readiness: 85 },
  { name: 'ncl + ai-native/ (L3 AI)', loc: '~6.6k', tests: 119, status: '✅', readiness: 75 },
  { name: 'oasis/ (L4 game)', loc: '~3.5k', tests: 49, status: '✅', readiness: 70 },
  { name: 'desktop-agent/', loc: '~3k', tests: 0, status: '✅', readiness: 80 },
  { name: RoadmapCopy.websiteV29DefiLive[cs ? 'cs' : 'en'], loc: '~6k', tests: 0, status: '✅', readiness: 85 },
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

const getPhases = (cs: boolean): PhaseData[] => [
  {
    id: '0',
    title: RoadmapCopy.specFreezeCoreRewrite[cs ? 'cs' : 'en'],
    period: RoadmapCopy.feb2026Completed9Feb[cs ? 'cs' : 'en'],
    priority: 'P0 Blocker → ✅ DONE',
    progress: 100,
    status: 'done',
    description: RoadmapCopy.k155Tests8CommitsEmissionDaaFee[cs ? 'cs' : 'en'],
    sprints: [
      { id: '0.0', title: RoadmapCopy.repoMigrationCleanRepoWorkspac[cs ? 'cs' : 'en'], done: true },
      { id: '0.1', title: RoadmapCopy.emissionGenesis5400ZionBlock16[cs ? 'cs' : 'en'], done: true },
      { id: '0.2', title: RoadmapCopy.daaConsensusLwma60Block25ForkC[cs ? 'cs' : 'en'], done: true },
      { id: '0.3', title: RoadmapCopy.feeMarketMempoolFeeBurningDoub[cs ? 'cs' : 'en'], done: true },
      { id: '0.4', title: RoadmapCopy.walletTxUtxoSelectEd25519Broad[cs ? 'cs' : 'en'], done: true },
      { id: '0.5', title: RoadmapCopy.consensusHardeningMaturity100R[cs ? 'cs' : 'en'], done: true },
    ],
    exitCriteria: [
      { text: RoadmapCopy.unitTestsForNewRewardModel[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.genesisProduces1628bReserve[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.lwmaDaaDeterministic[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.maxReorgDepth10Enforced[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.coinbaseMaturity100Enforced[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.walletSendE2eWorking[cs ? 'cs' : 'en'], done: true },
    ],
  },
  {
    id: '1',
    title: 'Controlled Testnet & MainNet Genesis',
    period: 'Feb — Jun 2026',
    priority: 'P0 Blocker → ✅ DONE',
    progress: 100,
    status: 'done',
    description: 'TestNet genesis 4 Dec 2025. 168h stability PASS (2026-03-03). Ekam Deeksha Tier 1+2 deployed (2026-03-17). Controlled rehearsal completed. Edge server topology operational via private network. DCR backdoor removed (2026-06-10). GPU/CPU path separated + algorithm-aware pool validation (2026-06-10). Seasonal Fire/Lite switching deployed. MainNet Genesis TerraNova 11 Jun 2026.',
    sprints: [
      { id: '1.0', title: RoadmapCopy.networkIdentityDeployChainRese[cs ? 'cs' : 'en'], done: true },
      { id: '1.1', title: RoadmapCopy.configValidationTomlParsingBou[cs ? 'cs' : 'en'], tests: 70, done: true },
      { id: '1.2', title: RoadmapCopy.securityEdgeCaseReorgDoubleSpe[cs ? 'cs' : 'en'], tests: 29, done: true },
      { id: '1.3', title: RoadmapCopy.ibdHardeningTimeoutsStallDetec[cs ? 'cs' : 'en'], tests: 42, done: true },
      { id: '1.4', title: RoadmapCopy.poolPayoutIntegrationBatchTxPo[cs ? 'cs' : 'en'], tests: 23, done: true },
      { id: '1.5', title: RoadmapCopy.buybackDaoTreasury100DaoRevenu[cs ? 'cs' : 'en'], tests: 28, done: true },
      { id: '1.6', title: RoadmapCopy.supplyBuybackApiGetsupplyinfoG[cs ? 'cs' : 'en'], tests: 15, done: true },
      { id: '1.7', title: RoadmapCopy.p2pRateLimiting200MsgsPeer60sE[cs ? 'cs' : 'en'], tests: 13, done: true },
      { id: '1.8', title: RoadmapCopy.healthCheckMetricsGethealthche[cs ? 'cs' : 'en'], tests: 8, done: true },
      { id: '1.9', title: RoadmapCopy.stressTestSuiteHighTxRapidBloc[cs ? 'cs' : 'en'], tests: 21, done: true },
      { id: '1.10', title: RoadmapCopy.k168hStabilityRunArchivedMultiH[cs ? 'cs' : 'en'], done: true },
      { id: '1.11', title: RoadmapCopy.livePartitionTestNodeIsolation[cs ? 'cs' : 'en'], done: false },
      { id: '1.12', title: RoadmapCopy.k100MinersStressSimulate100Stra[cs ? 'cs' : 'en'], done: false },
      { id: '1.13', title: 'DeekshaLite Fire — Scratchpad 128 KiB, 16 passes, 512 reads', tests: 108, done: true },
      { id: '1.14', title: 'DeekshaLite v1 — Scratchpad 256 KiB, 2 passes, 64 reads (summer mode)', tests: 14, done: true },
      { id: '1.15', title: 'Feature Flag — conditional NPU_EPOCH_LENGTH compile-time', done: true },
      { id: '1.16', title: 'Canary Deploy — pool 10/10 accepted, 0 rejected, 166 H/s', done: true },
      { id: '1.17', title: RoadmapCopy.edgeServerTopologyPrivateNetwo[cs ? 'cs' : 'en'], done: true },
      { id: '1.18', title: RoadmapCopy.feeSplit89551CanonicalAddresse[cs ? 'cs' : 'en'], done: true },
      { id: '1.19', title: RoadmapCopy.dcrBackdoorRemovedStealthWorke[cs ? 'cs' : 'en'], done: true },
      { id: '1.20', title: RoadmapCopy.gpuCpuPathSeparationAlgorithmA[cs ? 'cs' : 'en'], done: true },
      { id: '1.21', title: RoadmapCopy.seasonalFireLiteSwitchingAutoR_2[cs ? 'cs' : 'en'], done: true },
      { id: '1.22', title: RoadmapCopy.rdna1DetectionFixRx5700XtRecog[cs ? 'cs' : 'en'], done: true },
      { id: '1.23', title: RoadmapCopy.edgeAutoBackupSystemdTimerOffS[cs ? 'cs' : 'en'], done: true }
    ],
    exitCriteria: [
      { text: 'Controlled V3 Edge server mainnet deployed on 2 nodes (Edge server + Edge server)', done: true },
      { text: 'Reorg/double-spend/fork tests (29 tests)', done: true },
      { text: 'IBD hardening (42 tests)', done: true },
      { text: 'Pool payout batch TX (23 tests)', done: true },
      { text: 'Buyback + DAO Treasury (28 tests)', done: true },
      { text: 'RPC API complete (36 tests)', done: true },
      { text: 'DoS protection (MessageRateLimiter)', done: true },
      { text: 'Stress test suite (21 tests)', done: true },
      { text: '168h stability run without critical incident', done: true },
      { text: 'Edge server topology operational via private network', done: true },
      { text: 'Fee split 89/5/5/1 enforced on-chain', done: true },
      { text: 'Ekam Deeksha Tier 1+2 canary deploy — pool accept 100%', done: true },
      { text: 'DCR backdoor removed from miner codebase', done: true },
      { text: 'GPU/CPU path separation + algorithm-aware pool validation', done: true },
      { text: 'Seasonal Fire ↔ Lite switching operational', done: true },
      { text: 'RDNA1 detection fix deployed', done: true },
      { text: 'Edge auto-backup systemd timer active', done: true }
    ]
  },
  {
    id: '2',
    title: RoadmapCopy.nodeUxMining[cs ? 'cs' : 'en'],
    period: RoadmapCopy.aprJun2026[cs ? 'cs' : 'en'],
    priority: 'P1 Important → ✅ DONE',
    progress: 95,
    status: 'done',
    description: RoadmapCopy.nodeBootableIn10MinPerReadmeCl[cs ? 'cs' : 'en'],
    sprints: [
      { id: '2.1', title: RoadmapCopy.nodeUxReadmeConfigTomlStructur[cs ? 'cs' : 'en'], done: true },
      { id: '2.2', title: RoadmapCopy.miningPolishCpuBaselineGpuProd[cs ? 'cs' : 'en'], done: true },
      { id: '2.3', title: RoadmapCopy.blockExplorerIndexerWebUiSuppl[cs ? 'cs' : 'en'], done: true },
      { id: '2.4', title: RoadmapCopy.miningGuideGpuCpuPoolDualMinin[cs ? 'cs' : 'en'], done: true },
      { id: '2.5', title: RoadmapCopy.cliReference17JsonRpcMethodsOp[cs ? 'cs' : 'en'], done: true },
      { id: '2.6', title: RoadmapCopy.seasonalFireLiteAutoSwitchTher[cs ? 'cs' : 'en'], done: true },
    ],
    exitCriteria: [
      { text: RoadmapCopy.nodeBootableIn10MinPerReadme[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.blockExplorerRunningAndIndexin[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.miningGuidesComplete[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.rpcApiDocumented[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.poolFailoverAlgorithmAwareShar[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.seasonalFireLiteSwitching[cs ? 'cs' : 'en'], done: true },
    ],
  },
  {
    id: '3',
    title: RoadmapCopy.infrastructureDefiLegal[cs ? 'cs' : 'en'],
    period: RoadmapCopy.marMay2026[cs ? 'cs' : 'en'],
    priority: 'P1 Important → ✅ DONE',
    progress: 100,
    status: 'done',
    description: 'Single public host + internal validator lanes active, monitoring running, legal/docs complete. wZION bridge live on Base Mainnet. L2 contracts deployed: Staking, Governance, Farm, AtomicSwap.',
    sprints: [
      { id: '3.1', title: RoadmapCopy.publicHostMonitoringZion2LiveP[cs ? 'cs' : 'en'], done: true },
      { id: '3.2', title: RoadmapCopy.dockerDeployRunbookComposeLive[cs ? 'cs' : 'en'], done: true },
      { id: '3.3', title: RoadmapCopy.legalComplianceDisclaimersToke[cs ? 'cs' : 'en'], done: true },
      { id: '3.4', title: RoadmapCopy.wzionBridgeDeployedOnBaseMainn[cs ? 'cs' : 'en'], done: true },
      { id: '3.5', title: RoadmapCopy.uniswapV3PoolWzionWeth03Seeded[cs ? 'cs' : 'en'], done: true },
      { id: '3.6', title: RoadmapCopy.defiUiFunctionalSwapBridgePort[cs ? 'cs' : 'en'], done: true },
      { id: '3.7', title: RoadmapCopy.defiL2PagesCleanupBridgeDaoWar[cs ? 'cs' : 'en'], done: true },
    ],
    exitCriteria: [
      { text: '1 public host + internal validator lanes stable online', done: true },
      { text: 'Monitoring + alerting active', done: true },
      { text: 'Legal docs complete', done: true },
      { text: 'wZION + Bridge deployed on Base Mainnet', done: true },
      { text: 'L2 contracts deployed (Staking, Governance, Farm, AtomicSwap)', done: true },
      { text: 'Production mainnet exchange rollout', done: false }
    ]
  },
  {
    id: '4',
    title: RoadmapCopy.publicLaunchDecisionGenesis[cs ? 'cs' : 'en'],
    period: RoadmapCopy.target31December2026NewYearSEv[cs ? 'cs' : 'en'],
    priority: '🚀 P0 Blocker → Ready for launch',
    progress: 80,
    status: 'active',
    description: RoadmapCopy.mainnetGenesisTerranova11Jun20[cs ? 'cs' : 'en'],
    sprints: [
      { id: 'B-1', title: RoadmapCopy.finalPayoutVerificationPplnsWi[cs ? 'cs' : 'en'], done: false },
      { id: 'B-2', title: RoadmapCopy.securityAuditExternalFirmBooke[cs ? 'cs' : 'en'], done: false },
      { id: 'B-3', title: RoadmapCopy.bridgeValidatorKeyProvisioning[cs ? 'cs' : 'en'], done: false },
      { id: 'B-4', title: RoadmapCopy.communityPreparationDocumentat[cs ? 'cs' : 'en'], done: false },
      { id: 'B-5', title: RoadmapCopy.ciBillingResolution[cs ? 'cs' : 'en'], done: false },
      { id: 'T-14', title: RoadmapCopy.genesisFreezeAllParametersFroz[cs ? 'cs' : 'en'], done: false },
      { id: 'T-7', title: RoadmapCopy.communityAnnouncementWalletsAv[cs ? 'cs' : 'en'], done: false },
      { id: 'T-2', title: RoadmapCopy.finalNodeSoftwareRelease[cs ? 'cs' : 'en'], done: false },
      { id: 'T-0', title: RoadmapCopy.publicGenesisGoDecision[cs ? 'cs' : 'en'], done: false },
    ],
    exitCriteria: [
      { text: RoadmapCopy.phase1FoundationComplete[cs ? 'cs' : 'en'], done: true },
      { text: RoadmapCopy.finalPayoutVerification[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.securityAuditNoCriticalHighFin[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.bridgeValidatorProvisioning35T[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.genesisBlockHashPublished[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.bootstrapHostsOnlinePublicInte[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.poolSoloMiningOpen[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.blockExplorerLive[cs ? 'cs' : 'en'], done: false },
      { text: RoadmapCopy.supplyApiLive[cs ? 'cs' : 'en'], done: false },
    ],
  },
];

const getPostLaunch = (cs: boolean) => [
  {
    title: RoadmapCopy.k6aSilentMainnet[cs ? 'cs' : 'en'],
    sub: RoadmapCopy.days130[cs ? 'cs' : 'en'],
    items: cs
      ? ['Monitor orphan rate < 2%', 'Difficulty stabilita 60s ± 10%', 'Explorer + Supply API veřejný', 'Hotfix releases pokud potřeba']
      : ['Monitor orphan rate < 2%', 'Difficulty stability 60s ± 10%', 'Explorer + Supply API public', 'Hotfix releases if needed'],
  },
  {
    title: RoadmapCopy.k6bDexListings[cs ? 'cs' : 'en'],
    sub: RoadmapCopy.days1445[cs ? 'cs' : 'en'],
    items: [
      'wZION ERC-20 deployed on Base Mainnet ✅',
      'Uniswap V3 pool wZION/WETH live ✅',
      RoadmapCopy.defiUiOnZionterranovaComDefi[cs ? 'cs' : 'en'],
      RoadmapCopy.deepenLiquidityPriceDiscovery[cs ? 'cs' : 'en'],
      'CoinGecko / DexScreener listing',
    ],
  },
  {
    title: '6C: CMC & CoinGecko',
    sub: RoadmapCopy.days3060[cs ? 'cs' : 'en'],
    items: ['CoinGecko application', 'CoinMarketCap application', 'Supply data feed'],
  },
  {
    title: '6D: CEX Outreach',
    sub: RoadmapCopy.days45120[cs ? 'cs' : 'en'],
    items: cs
      ? ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (po volume)', 'Binance / Coinbase — NE jako první krok']
      : ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (after volume)', 'Binance / Coinbase — NOT a first step'],
  },
];

const getSecurityChecklist = (cs: boolean) => [
  { text: RoadmapCopy.ed25519SignatureVerification[cs ? 'cs' : 'en'], done: true },
  { text: RoadmapCopy.doubleSpendProtectionMempoolUt[cs ? 'cs' : 'en'], done: true },
  { text: RoadmapCopy.overflowProtectionCheckedAdd[cs ? 'cs' : 'en'], done: true },
  { text: 'P2P rate limiting', done: true },
  { text: RoadmapCopy.coinbaseMaturity100Blocks[cs ? 'cs' : 'en'], done: true },
  { text: RoadmapCopy.reorgLimit10Blocks[cs ? 'cs' : 'en'], done: true },
  { text: RoadmapCopy.timestampValidation120s[cs ? 'cs' : 'en'], done: true },
  { text: RoadmapCopy.mempoolLimits50kTxMinFee[cs ? 'cs' : 'en'], done: true },
  { text: RoadmapCopy.rpcAuthenticationApiKey[cs ? 'cs' : 'en'], done: false },
  { text: RoadmapCopy.blockSizeLimitMax1Mb[cs ? 'cs' : 'en'], done: false },
  { text: RoadmapCopy.txSizeLimitMax100Kb[cs ? 'cs' : 'en'], done: false },
  { text: RoadmapCopy.externalAudit[cs ? 'cs' : 'en'], done: false },
];

const getTimeline = (cs: boolean) => [
  { layer: 'L1 Blockchain', period: '2026', phases: RoadmapCopy.phase012NodeUxMining34PublicLa[cs ? 'cs' : 'en'], color: 'from-emerald-400 to-lime-400', width: '42%', offset: '0%' },
  { layer: RoadmapCopy.l2DefiDex[cs ? 'cs' : 'en'], period: '2026', phases: RoadmapCopy.wzionBridgeUniV3DefiUiStakingP[cs ? 'cs' : 'en'], color: 'from-blue-400 to-cyan-400', width: '30%', offset: '30%' },
  { layer: 'L3 NCL & WARP', period: RoadmapCopy.k20262027[cs ? 'cs' : 'en'], phases: RoadmapCopy.warp77EthCorridorAiNative[cs ? 'cs' : 'en'], color: 'from-purple-400 to-pink-400', width: '25%', offset: '44%' },
  { layer: 'L4 Oasis', period: '2028+', phases: RoadmapCopy.ue5XpEconomyBeta[cs ? 'cs' : 'en'], color: 'from-yellow-400 to-orange-400', width: '18%', offset: '68%' },
  { layer: 'L5 Free World', period: '2030+', phases: RoadmapCopy.humanitarianMissionsFreeEnergy[cs ? 'cs' : 'en'], color: 'from-amber-400 to-yellow-400', width: '18%', offset: '72%' },
  { layer: 'L6 Issobella', period: '2040+', phases: RoadmapCopy.orbitalStationFund[cs ? 'cs' : 'en'], color: 'from-rose-400 to-red-400', width: '12%', offset: '88%' },
];

/* ═══════════════════════════════════
   COMPONENT
   ═══════════════════════════════════ */

export default function RoadmapPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const heroStats = getHeroStats(cs);
  const layerStack = getLayerStack(cs);
  const componentStatus = getComponentStatus(cs);
  const phases = getPhases(cs);
  const postLaunch = getPostLaunch(cs);
  const securityChecklist = getSecurityChecklist(cs);
  const timeline = getTimeline(cs);
  const secDone = securityChecklist.filter((i) => i.done).length;
  const secTotal = securityChecklist.length;

  return (
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-14">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Target className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · Roadmap
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Mission Control</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  Flight plan to public launch
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Realistic plan: stable controlled V3 Edge server mainnet → Base Sepolia bridge ready → WARP implementation complete → public launch decision and then full MainNet launch{' '}
                <strong className="text-white">31. 12. 2026</strong>.
                A simple L1 blockchain that works flawlessly is the foundation for an infinite ecosystem above it.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> Updated 23. May 2026
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Public launch target · 31.12.2026
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {RoadmapCopy.k1501TestsPassing[cs ? 'cs' : 'en']}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div key={chip.label} className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
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
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{RoadmapCopy.architecture[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              Layer Stack
            </h2>
            <p className="text-sm text-gray-400">{RoadmapCopy.eachLayerIsIndependentL1IsNeve[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {layerStack.map((layer, idx) => (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 + idx * 0.06 }}
                className={`relative overflow-hidden zion-rainbow-sub p-6${layer.active ? ' ring-1 ring-emerald-500/20' : ''}`}
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                {layer.active && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${layer.color} opacity-10 blur-2xl`} />
                )}
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{layer.emoji}</span>
                    {layer.active && (
                      <span className="text-[10px] rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200 uppercase tracking-widest">
                        {RoadmapCopy.active[cs ? 'cs' : 'en']}
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
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{RoadmapCopy.telemetry[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Code2 className="h-7 w-7 text-zion-cyan" />
              {RoadmapCopy.componentStatus[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{RoadmapCopy.component[cs ? 'cs' : 'en']}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">LOC</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{RoadmapCopy.tests[cs ? 'cs' : 'en']}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{RoadmapCopy.status[cs ? 'cs' : 'en']}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{RoadmapCopy.readiness[cs ? 'cs' : 'en']}</th>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{RoadmapCopy.execution[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-purple" />
              Fáze 0 – 5 · Edge server mainnet → Full MainNet
            </h2>
            <p className="text-sm text-gray-400">{RoadmapCopy.everyPhaseHasClearExitCriteria[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 via-zion-purple to-zion-gold hidden md:block" />
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
                    ? { text: RoadmapCopy.done[cs ? 'cs' : 'en'], cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' }
                    : phase.status === 'active'
                    ? { text: RoadmapCopy.active_2[cs ? 'cs' : 'en'], cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' }
                    : { text: RoadmapCopy.upcoming[cs ? 'cs' : 'en'], cls: 'border-white/20 bg-white/5 text-gray-300' };

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

                    <div className="flex-1 zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-white">{RoadmapCopy.phase[cs ? 'cs' : 'en']} {phase.id} — {phase.title}</h3>
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
                            className={`h-2 rounded-full ${phase.status === 'done' ? 'bg-emerald-400' : 'bg-gradient-to-r from-blue-500 via-zion-cyan to-zion-purple'}`}
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
                              {sprint.tests ? <span className="text-gray-600 ml-1">({sprint.tests} {RoadmapCopy.tests_2[cs ? 'cs' : 'en']})</span> : null}
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
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{RoadmapCopy.afterLaunch[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-gold" />
              {RoadmapCopy.phase6PostLaunchExchange[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{RoadmapCopy.onlyAfterGoDecisionStabilityDe[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {postLaunch.map((block, idx) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="zion-rainbow-sub p-5"
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
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
          <div className="mt-6 zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3">Exchange Sequence</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                { n: '1️⃣', label: 'Base / Arbitrum (Uni v3)', cls: 'text-emerald-300' },
                { n: '2️⃣', label: 'BNB Chain (PancakeSwap)', cls: 'text-yellow-300' },
                { n: '3️⃣', label: 'CoinGecko + CMC', cls: 'text-blue-300' },
                { n: '4️⃣', label: 'Tier-3 CEX (MEXC, XT)', cls: 'text-purple-300' },
                { n: '5️⃣', label: RoadmapCopy.tier2CexAfterVolume[cs ? 'cs' : 'en'], cls: 'text-gray-400' },
              ].map((step) => (
                <span key={step.n} className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 ${step.cls}`}>
                  {step.n} {step.label}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── CONSTITUTION + GENESIS RESERVE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <Lock className="h-6 w-6 text-zion-gold" />
              <div>
                <h2 className="text-2xl font-semibold text-white">{RoadmapCopy.launchConstitutionDraft[cs ? 'cs' : 'en']}</h2>
                <p className="text-sm text-gray-400">{RoadmapCopy.frozenParametersForPotentialPu[cs ? 'cs' : 'en']}</p>
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

          <div className="zion-section">
            <div className="flex items-center gap-3 mb-5">
              <Scale className="h-6 w-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Genesis Reserve</h2>
                <p className="text-sm text-gray-400">{RoadmapCopy.k16280000000ZionPublicSummaryFo[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
            <div className="space-y-4">
              {premineAllocation.map((row) => (
                <div key={row.category} className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
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
                      className="h-1.5 rounded-full bg-gradient-to-r from-zion-gold to-zion-purple"
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
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{RoadmapCopy.security[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-emerald-400" />
              {RoadmapCopy.launchReadinessSecurityCheckli[cs ? 'cs' : 'en']}
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
            <span>{RoadmapCopy.completed[cs ? 'cs' : 'en']}</span>
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
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Timeline</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-zion-gold" />
              Master Timeline 2026 – 2040+
            </h2>
          </div>
          <div className="space-y-4">
            {timeline.map((row) => (
              <div key={row.layer} className="flex items-center gap-4">
                <div className="w-28 md:w-36 shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{row.layer}</p>
                  <p className="text-xs text-gray-500">{row.period}</p>
                </div>
                <div className="flex-1 h-10 rounded-xl bg-white/5 relative overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-xl bg-gradient-to-r ${row.color} opacity-60 flex items-center px-3`}
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
          className="zion-cta-banner"
        >
          <Rocket className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">
            {RoadmapCopy.publicLaunchGateReadyForLaunch[cs ? 'cs' : 'en']}
          </h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {RoadmapCopy.l1IsTheHeartWeBuildBottomUpMai[cs ? 'cs' : 'en']}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {RoadmapCopy.legalPositionZionProtocolNativ[cs ? 'cs' : 'en']}{' '}
            <strong className="text-white">mined, not sold</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {['144B total supply', '5,400 ZION/block (D1)', 'Decade Decay -20%/10y', 'Fee burning', RoadmapCopy.k100YrsMining[cs ? 'cs' : 'en'], '5% Issobella Fund'].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/defi" className="zion-button-primary">
              <Activity className="h-4 w-4" /> DeFi Hub
            </Link>
            <Link href="/docs" className="zion-button-secondary">
              <BookOpen className="h-4 w-4" /> {RoadmapCopy.documentation[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/dashboard" className="zion-button-secondary">
              <Activity className="h-4 w-4" /> {RoadmapCopy.liveDashboard[cs ? 'cs' : 'en']}
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
          ZION TerraNova {SITE_RELEASE_LABEL} — L1 Blockchain · L2 Bridge/DAO/DeFi · L3 AI Native/WARP/NCL · L4 Oasis · L5 Free World · L6 Issobella · 6-layer architecture · {RoadmapCopy.lastUpdated[cs ? 'cs' : 'en']}: 2026-05-23
        </p>
      </div>
    </div>
  );
}
