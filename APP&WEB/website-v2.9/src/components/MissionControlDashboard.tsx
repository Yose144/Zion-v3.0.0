'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowLeftRight, BarChart3, Brain, CheckCircle2,
  ChevronDown, Clock, Compass, Cpu, Database, Flame, Gamepad2, Gauge, Globe, Globe2,
  HardDrive, Heart, Layers, Link, Lock, Map, Megaphone, Monitor, Network,
  Pickaxe, Radio, RefreshCw, Rocket, Scale, Server, Shield, Sparkles,
  Square, Target, Timer, TrendingUp, Wallet, Wrench, Zap, Code2, CalendarDays,
  CircleDot, XCircle, CheckCheck, Construction
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL, SITE_VERSION } from '@/lib/site';
import { SEED_PRICE_USD } from '@/lib/defi-contracts';

const MissionControlDashboardCopy = {
  dashboard: { cs: `Prehled`, en: `Dashboard` },
  stackMetrics: { cs: `Metriky stacku`, en: `Stack Metrics` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  layers: { cs: `Vrstvy`, en: `Layers` },
  constitution: { cs: `Ustava`, en: `Constitution` },
  economy: { cs: `Ekonomika`, en: `Economy` },
  security: { cs: `Bezpecnost`, en: `Security` },
  timeline: { cs: `Casova osa`, en: `Timeline` },
  priority: { cs: `Priorita`, en: `Priority` },
  phase1Foundation: { cs: `Fáze 1 — Foundation`, en: `Phase 1 — Foundation` },
  coreConsensusInfrastructureL2B: { cs: `Core, consensus, infrastructure, L2 bridge`, en: `Core, consensus, infrastructure, L2 bridge` },
  feeSplit89551: { cs: `Fee split 89/5/5/1`, en: `Fee split 89/5/5/1` },
  pplnsPayoutVerifiedAndActive: { cs: `PPLNS payout ověřen a aktivní`, en: `PPLNS payout verified and active` },
  edgeServerTopology: { cs: `Síťová topologie`, en: `Network topology` },
  privateVpnActive: { cs: `Zabezpečená síť aktivní`, en: `Secure mesh active` },
  dockerComposeMainnet: { cs: `Mainnet stack`, en: `Mainnet stack` },
  readyForDeployment: { cs: `Připraveno pro deployment`, en: `Ready for deployment` },
  securityCleanup: { cs: `Bezpečnostní cleanup`, en: `Security cleanup` },
  credentialRotationComplete: { cs: `Credential rotation dokončen`, en: `Credential rotation complete` },
  finalPayoutVerification: { cs: `Finální payout verification`, en: `Final payout verification` },
  pplnsWindowValidationInProgres: { cs: `PPLNS window validace probíhá`, en: `PPLNS window validation in progress` },
  securityAudit: { cs: `Security audit`, en: `Security audit` },
  externalFirmBooked: { cs: `Externí firma rezervována`, en: `External firm booked` },
  bridgeValidatorKeyProvisioning: { cs: `Bridge validator provisioning`, en: `Bridge validator key provisioning` },
  k35ThresholdProduction: { cs: `3/5 threshold produkce`, en: `3/5 threshold production` },
  ciBillingResolution: { cs: `CI billing`, en: `CI billing resolution` },
  githubActionsInfrastructurePen: { cs: `GitHub Actions infrastruktura`, en: `GitHub Actions infrastructure pending` },
  genesisPremine: { cs: `Genesis premine`, en: `Genesis premine` },
  k1628bZion12Wallets: { cs: `16.78B ZION, 14 výstupů`, en: `16.78B ZION, 14 outputs` },
  wzionErc20: { cs: `wZION ERC-20`, en: `wZION ERC-20` },
  deployedOnBaseMainnet: { cs: `Deployed na Base Mainnet`, en: `Deployed on Base Mainnet` },
  zionstaking: { cs: `ZIONStaking`, en: `ZIONStaking` },
  k12Apr7DayCooldown: { cs: `12% APR, 7-denní cooldown`, en: `12% APR, 7-day cooldown` },
  pplnsFeeSplitFinalVerification: { cs: `PPLNS fee split finální ověření`, en: `PPLNS fee split final verification` },
  confirm89551Wiring: { cs: `Potvrdit 89/5/5/1 wiring`, en: `Confirm 89/5/5/1 wiring` },
  launchChecklistDashboardIntegr: { cs: `Launch checklist dashboard integrace`, en: `Launch checklist dashboard integration` },
  connectToMissionControl: { cs: `Propojit s Mission Control`, en: `Connect to Mission Control` },
  bfgScrubGitHistory: { cs: `BFG scrub / git historie`, en: `BFG scrub / git history` },
  finalCleanupBeforeLaunch: { cs: `Finální cleanup před launch`, en: `Final cleanup before launch` },
  all: { cs: `Vse`, en: `All` },
  mining: { cs: `Tezba`, en: `Mining` },
  inspect: { cs: `Zkontrolovat`, en: `Inspect` },
  offline: { cs: `Offline`, en: `Offline` },
  online: { cs: `Online`, en: `Online` },
  syncing: { cs: `Synchronizace`, en: `Syncing` },
  stale: { cs: `Neaktualni`, en: `Stale` },
  unhealthy: { cs: `Nezdrave`, en: `Unhealthy` },
  height: { cs: `Vyska`, en: `Height` },
  peers: { cs: `Peeri`, en: `Peers` },
  difficulty: { cs: `Obtiznost`, en: `Difficulty` },
  lastBlock: { cs: `Posledni blok`, en: `Last Block` },
  containers: { cs: `Kontejnery`, en: `Containers` },
  memory: { cs: `Pamet`, en: `Memory` },
  disk: { cs: `Disk`, en: `Disk` },
  load: { cs: `Zatez`, en: `Load` },
  ports: { cs: `Porty`, en: `Ports` },
  closeDetails: { cs: `Zavrit detail`, en: `Close details` },
  serviceDetail: { cs: `Detail sluzby`, en: `Service Detail` },
  status: { cs: `Stav`, en: `Status` },
  operationalContext: { cs: `Provozni kontext`, en: `Operational Context` },
  localServiceWithoutADirectProm: { cs: `Lokalni sluzba bez primeho Prometheus scrape targetu.`, en: `Local service without a direct Prometheus scrape target.` },
  quickActions: { cs: `Rychle akce`, en: `Quick Actions` },
  operatorNotes: { cs: `Poznamky operatora`, en: `Operator Notes` },
  statusDownMeansAScrapeFailureO: { cs: `Stav DOWN znamena scrape fail nebo nedostupny target.`, en: `Status DOWN means a scrape failure or an unreachable target.` },
  statusNAMeansTheServiceIsNotCo: { cs: `Stav N/A znamena, ze sluzba neni napojena primo na Prometheus scrape.`, en: `Status N/A means the service is not connected directly to a Prometheus scrape.` },
  useTheMonitoringOrGrafanaActio: { cs: `Pro hlubsi drill-down pouzij akce Monitoring nebo Grafana vyse.`, en: `Use the Monitoring or Grafana actions above for deeper drill-down.` },
  awaitingData: { cs: `cekam na data`, en: `awaiting data` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
  coreNode: { cs: `Core node`, en: `Core Node` },
  miningPool: { cs: `Mining pool`, en: `Mining Pool` },
  minerRuntime: { cs: `Miner runtime`, en: `Miner Runtime` },
  block: { cs: `Blok`, en: `Block` },
  blocksAcc: { cs: `Prijate bloky`, en: `Blocks Acc` },
  tmplTxs: { cs: `Tx v sablone`, en: `Tmpl Txs` },
  tmplFees: { cs: `Fee sablony`, en: `Tmpl Fees` },
  chainHeight1h: { cs: `Vyska chainu — 1h`, en: `Chain Height — 1h` },
  activeMiners1h: { cs: `Aktivni mineri — 1h`, en: `Active Miners — 1h` },
  acceptedShares1h: { cs: `Prijate shares — 1h`, en: `Accepted Shares — 1h` },
  minerTarget: { cs: `Cil minera`, en: `Miner Target` },
  hashrate10s: { cs: `Hashrate 10 s`, en: `Hashrate 10s` },
  hashrate60s: { cs: `Hashrate 60 s`, en: `Hashrate 60s` },
  accepted: { cs: `Prijate`, en: `Accepted` },
  rejected: { cs: `Odmítnuté`, en: `Rejected` },
  acceptRate: { cs: `Accept rate`, en: `Accept Rate` },
  submitAvg: { cs: `Prumer submitu`, en: `Submit Avg` },
  poolHeight: { cs: `Vyska poolu`, en: `Pool Height` },
  minerHashrate1h: { cs: `Hashrate minera — 1 h`, en: `Miner Hashrate — 1h` },
  poolRoutingGroups: { cs: `Routing skupiny poolu`, en: `Pool Routing Groups` },
  cpuLoad: { cs: `CPU zatez`, en: `CPU Load` },
  serverUptime: { cs: `Uptime serveru`, en: `Server Uptime` },
  since: { cs: `od`, en: `since` },
  k30LivePrometheusMetrics: { cs: `30+ zivych Prometheus metrik`, en: `30+ live Prometheus metrics` },
  instantRangeQueries: { cs: `Instantni + range dotazy`, en: `Instant + Range queries` },
  k15sAutoRefresh: { cs: `Auto-refresh 15 s`, en: `15s auto-refresh` },
  svgSparklines1h: { cs: `SVG sparkliny (1 h)`, en: `SVG sparklines (1h)` },
  fullMonitoringPage: { cs: `Cela monitoring stranka →`, en: `Full monitoring page →` },
  openGrafana: { cs: `Otevrit Grafanu →`, en: `Open Grafana →` },
  signedTxOnly: { cs: `JEN PODEPSANE TX`, en: `SIGNED TX ONLY` },
  walletDiagnosticsTransactionSu: { cs: `Diagnostika walletu a odeslani transakce`, en: `Wallet Diagnostics & Transaction Submit` },
  liveRpcHealthBalanceUtxoSnapsh: { cs: `Zive zdravi RPC, balance, UTXO snapshot, viditelnost payoutu minera a bezpecny broadcast jiz podepsane transakce bez prace s privatnimi klici na serveru.`, en: `Live RPC health, balance, UTXO snapshot, miner payout visibility, and safe broadcast of an already signed transaction without handling private keys on the server.` },
  chainHeight: { cs: `Vyska chainu`, en: `Chain Height` },
  network: { cs: `Sit`, en: `Network` },
  rpcVersion: { cs: `Verze RPC`, en: `RPC Version` },
  walletAddressOrAccount: { cs: `Adresa walletu nebo ucet`, en: `Wallet Address Or Account` },
  loading: { cs: `Nacitam…`, en: `Loading…` },
  loadWallet: { cs: `Nacist wallet`, en: `Load Wallet` },
  address: { cs: `Adresa`, en: `Address` },
  notLoaded: { cs: `nenacteno`, en: `not loaded` },
  utxoCount: { cs: `Pocet UTXO`, en: `UTXO Count` },
  utxoTotal: { cs: `UTXO celkem`, en: `UTXO Total` },
  minerPending: { cs: `Miner pending`, en: `Miner Pending` },
  minerPaid: { cs: `Miner vyplaceno`, en: `Miner Paid` },
  minerShares: { cs: `Miner shares`, en: `Miner Shares` },
  recentUtxos: { cs: `Posledni UTXO`, en: `Recent UTXOs` },
  top20FromRpc: { cs: `top 20 z RPC`, en: `top 20 from RPC` },
  height_2: { cs: `vyska`, en: `height` },
  noUtxosReturnedForThisAddress: { cs: `Pro tuto adresu se nevratilo zadne UTXO.`, en: `No UTXOs returned for this address.` },
  loadAZion1AddressToInspectUtxo: { cs: `Nacti adresu zion1 pro kontrolu UTXO.`, en: `Load a zion1 address to inspect UTXOs.` },
  rpcSubmitTester: { cs: `RPC tester odeslani`, en: `RPC Submit Tester` },
  signedPayloadOnly: { cs: `jen podepsany payload`, en: `signed payload only` },
  submitting: { cs: `Odesilam…`, en: `Submitting…` },
  broadcastSignedTx: { cs: `Broadcast podepsane TX`, en: `Broadcast Signed TX` },
  method: { cs: `metoda`, en: `method` },
  accepted_2: { cs: `prijato`, en: `accepted` },
  yes: { cs: `ano`, en: `yes` },
  no: { cs: `ne`, en: `no` },
  done: { cs: `Hotovo`, en: `Done` },
  missingBeforePublicLaunch: { cs: `Chybí před public launch`, en: `Missing before public launch` },
  noLongerMissing: { cs: `Co už nechybí`, en: `No longer missing` },
  next4872h: { cs: `Další 48-72h`, en: `Next 48-72h` },
  liveTelemetry: { cs: `Ziva telemetrie`, en: `Live Telemetry` },
  missionControl: { cs: `Rizeni mise`, en: `Mission Control` },
  liveData30sRefresh: { cs: `ZIVA DATA · refresh 30 s`, en: `LIVE DATA · 30s refresh` },
  allSystemsHealthy: { cs: `Vsechny systemy zdrave`, en: `All Systems Healthy` },
  partialSystemsUp: { cs: `Cast systemu online`, en: `Partial Systems Up` },
  systemsMonitoring: { cs: `Monitoring systemu`, en: `Systems Monitoring` },
  live: { cs: `ZIVE`, en: `LIVE` },
  loadingMissionControlData: { cs: `Nacitam data Mission Control…`, en: `Loading Mission Control data…` },
  liveTelemetryUnavailable: { cs: `Ziva telemetrie neni dostupna`, en: `Live telemetry unavailable` },
  nodeApiTemporarilyUnreachableR: { cs: `Node API je docasne nedostupne - zalozky roadmapy a ustavy stale funguji.`, en: `Node API temporarily unreachable - roadmap & constitution tabs still work.` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
  launchReadinessPreLaunchBlocke: { cs: `Připravenost k launchi — Pre-Launch Blockers`, en: `Launch Readiness — Pre-Launch Blockers` },
  currentLaunchGateStatusBasedOn: { cs: `Aktuální stav launch gate založený na ROADMAP a operational status. Blockers musí být vyřešeny před public mainnet GO.`, en: `Current launch gate status based on ROADMAP and operational status. Blockers must be resolved before public mainnet GO.` },
  noItems: { cs: `Žádné položky`, en: `No items` },
  goldenCompassSevenDirectionsOf: { cs: `Zlatý Kompas — sedm směrů TerraNova`, en: `Golden Compass — seven directions of TerraNova` },
  truthfulnessCareDisciplineComm: { cs: `Pravdivost · Péče · Disciplína · Komunita · Otevřenost · Odvaha · Míra — interaktivní orientace projektu z knihy TerraNova.`, en: `Truthfulness · Care · Discipline · Community · Openness · Courage · Measure — interactive project orientation from the TerraNova book.` },
  progress: { cs: `Postup`, en: `Progress` },
  phase0SpecFreezeCoreRewrite: { cs: `Faze 0 — zmrazeni specifikace a prepis core`, en: `Phase 0 — Spec Freeze & Core Rewrite` },
  completed: { cs: `DOKONCENO`, en: `COMPLETED` },
  architecture: { cs: `Architektura`, en: `Architecture` },
  layerStack: { cs: `Vrstvovy stack`, en: `Layer Stack` },
  totalSupply: { cs: `Celková zásoba`, en: `Total Supply` },
  miningSupply: { cs: `Těžební zásoba`, en: `Mining Supply` },
  genesisPremine_2: { cs: `Genesis premine`, en: `Genesis Premine` },
  blockRewardD1: { cs: `Block reward (D1)`, en: `Block Reward (D1)` },
  emissionModel: { cs: `Emisni model`, en: `Emission Model` },
  tailEmission: { cs: `Tail emise`, en: `Tail Emission` },
  blockTime: { cs: `Cas bloku`, en: `Block Time` },
  k60Seconds: { cs: `60 sekund`, en: `60 seconds` },
  maxReorg: { cs: `Max reorg`, en: `Max Reorg` },
  k10Blocks: { cs: `10 bloku`, en: `10 blocks` },
  softFinality: { cs: `Soft finalita`, en: `Soft Finality` },
  k60Blocks: { cs: `60 bloku`, en: `60 blocks` },
  coinbaseMaturity: { cs: `Coinbase maturity`, en: `Coinbase Maturity` },
  k100Blocks: { cs: `100 bloku`, en: `100 blocks` },
  distribution: { cs: `Distribuce`, en: `Distribution` },
  k89Miner5Humanitarian5Issobella: { cs: `89 % miner · 5 % humanit. · 5 % Issobella · 1 % pool`, en: `89% miner · 5% humanitarian · 5% Issobella · 1% pool` },
  atomicUnits: { cs: `Atomic units`, en: `Atomic Units` },
  k1mPerZion: { cs: `1M na ZION`, en: `1M per ZION` },
  miningHorizon: { cs: `Horizont tezby`, en: `Mining Horizon` },
  k100YearsTail: { cs: `100+ let + tail ∞`, en: `100+ years + tail ∞` },
  immediatelyAvailable: { cs: `Okamzite dostupne`, en: `Immediately available` },
  infrastructureDev: { cs: `Infrastruktura a vyvoj`, en: `Infrastructure & Dev` },
  humanitarianFund: { cs: `Humanitarni fond`, en: `Humanitarian Fund` },
  zionBlockFrom2126: { cs: `ZION/block ∞ (od 2126)`, en: `ZION/block ∞ (from 2126)` },
  minerHumanitarianIssobellaPool: { cs: `miner / humanit. / Issobella / pool`, en: `miner / humanitarian / Issobella / pool` },
  k100Years: { cs: `100+ let`, en: `100+ years` },
  perpetualTail: { cs: `+ perpetualni tail ∞`, en: `+ perpetual tail ∞` },
  l5L6Treasury: { cs: `L5 / L6 Pokladna`, en: `L5 / L6 Treasury` },
  humanitarianFundSpaceStation: { cs: `Humanitární fond & Vesmírná stanice`, en: `Humanitarian Fund & Space Station` },
  k5OfEveryBlockRewardGoesToTheL5: { cs: `5 % každého blokového odměny putuje na L5 humanitární fond a 5 % na L6 Issobella vesmírný fond.`, en: `5% of every block reward goes to the L5 humanitarian fund and 5% to the L6 Issobella space fund.` },
  physicalCommunitiesHumanitaria: { cs: `Fyzické komunity, humanitární projekty, Free Energy, terénní governance. Fond odemčen ve výšce bloku ~525,600.`, en: `Physical communities, humanitarian projects, Free Energy, on-ground governance. Fund unlocked at block ~525,600.` },
  orbitalStationSpaceResearchSet: { cs: `Orbitální stanice, vesmírný výzkum, SETI, Overview Effect protokoly. Fond odemčen ve výšce bloku ~525,600.`, en: `Orbital station, space research, SETI, Overview Effect protocols. Fund unlocked at block ~525,600.` },
  allL1TransactionFees: { cs: `VSECHNY L1 TRANSAKCNI POPLATKY → `, en: `ALL L1 TRANSACTION FEES → ` },
  burned: { cs: `SPALENY`, en: `BURNED` },
  sentToABurnAddressWithoutAPriv: { cs: `Posilany na burn adresu bez privatniho klice → deflacni tlak`, en: `Sent to a burn address without a private key → deflationary pressure` },
  priorities: { cs: `Priority`, en: `Priorities` },
};

/* ═══════════════════════ TYPES ═══════════════════════ */
interface NodeStats {
  height?: number;
  peers_connected?: number;
  difficulty?: number;
  mempool_size?: number;
  status?: string;
  time_since_last_block?: number;
  tip?: string;
  tps?: number;
  sync?: { state?: string };
  network?: string;
}
interface PoolData {
  ok?: boolean;
  miners?: { active?: number; total?: number };
  hashrate?: { pool?: number; pool_24h?: number };
  shares?: { valid?: number; invalid?: number };
  blocks?: { found?: number; pending?: number };
  pool?: { fee?: number; version?: string; uptime_secs?: number };
  payouts?: { pending_miners?: number };
  pplns_window_size?: number;
  blockchain?: { connected?: boolean };
}
interface ServerNode {
  ip?: string;
  stats?: NodeStats;
  pool?: PoolData;
  mem?: { used?: number; total?: number };
  disk?: { used_pct?: number };
  load?: number;
  containers_up?: number;
  containers_healthy?: number;
}
interface StabilityRun {
  start?: string;
  elapsed_secs?: number;
  remaining_secs?: number;
  duration_secs?: number;
  progress_pct?: number;
  status?: string;
  public_launch_gate?: string;
  closure_report_ready?: boolean;
  agreement?: {
    online_nodes?: number;
    expected_nodes?: number;
    tip_agreement?: boolean;
    height_spread?: number | null;
    current_tip?: string | null;
  };
  collector?: {
    enabled?: boolean;
    run_id?: string | null;
    sample_interval_secs?: number | null;
    samples_collected?: number;
    issue_count?: number;
    healthy_sample_ratio?: number | null;
    last_sample_at?: string | null;
    state_path?: string | null;
  };
  pool?: {
    reachable?: boolean;
    active_miners?: number;
    valid_shares?: number;
    invalid_shares?: number;
    accept_rate_pct?: number | null;
  };
}
interface ReadinessItem {
  title?: string;
  detail?: string;
}
interface ReadinessMap {
  done?: ReadinessItem[];
  missing?: ReadinessItem[];
  not_missing?: ReadinessItem[];
  next_48h?: ReadinessItem[];
}
interface EnvironmentStatus {
  label?: string;
  current_phase?: string;
  public_launch_status?: string;
}
interface DashData {
  timestamp?: string;
  environment?: EnvironmentStatus;
  mainnet_stability_run?: StabilityRun;
  stability_run?: StabilityRun;
  canary_run?: StabilityRun;
  launch_rehearsal?: StabilityRun;
  readiness_map?: ReadinessMap;
  current_topology?: string;
  internal_seed_containers?: string[];
  seed_containers?: string[];
  primary?: ServerNode;
  // Legacy aliases can still be present in older mission-data snapshots.
  helsinki?: ServerNode;
  usa?: ServerNode;
  singapore?: ServerNode;
  asia?: ServerNode;
  log_tail?: string;
}

/* ═══════════════════════ PROMETHEUS TYPES ═══════════════════════ */
interface PromResult { metric: Record<string, string>; value: [number, string]; }
interface PromRangeResult { metric: Record<string, string>; values: [number, string][]; }

interface V3Metrics {
  chainHeight: number | null; peerCount: number | null; mempoolSize: number | null;
  blocksAccepted: number | null; templateHeight: number | null; templateTxs: number | null; templateFees: number | null;
  poolActiveSessions: number | null; poolSubmits: number | null; poolAccepted: number | null;
  poolRejected: number | null; poolAcceptRate: number | null; poolUptime: number | null;
  minerHashrate: number | null; minerHashrate10s: number | null; minerHashrate60s: number | null;
  minerAccepted: number | null; minerRejected: number | null; minerAcceptRate: number | null;
  minerSubmitAvgMs: number | null; minerPoolHeight: number | null; minerUp: number | null;
  groupZionSub: number | null; groupZionAcc: number | null; groupRevenueSub: number | null; groupRevenueAcc: number | null;
  groupNclSub: number | null; groupNclAcc: number | null; groupAutoSub: number | null; groupAutoAcc: number | null;
  pplnsWindowSize: number | null; pplnsWindowUsed: number | null; pplnsMiners: number | null;
  pplnsPaid: number | null; pplnsRounds: number | null;
  serverLoad1: number | null; serverLoad5: number | null; serverLoad15: number | null;
  memTotal: number | null; memAvail: number | null; diskTotal: number | null; diskAvail: number | null;
  bootTime: number | null; coreUp: number | null; poolUp: number | null;
}

interface V3Sparklines {
  chainHeight: number[]; poolSessions: number[]; shares: number[]; minerHashrate: number[];
}

interface V3Charts {
  chainHeight: number[]; poolSessions: number[]; shares: number[]; minerHashrate: number[];
  cpuLoad: number[]; memPct: number[]; redisMemory: number[]; timestamps: number[];
}

interface G8Run {
  started?: string | null;
  target_end?: string | null;
  status?: 'not_started' | 'running' | 'completed' | 'stopped';
  elapsed_seconds?: number;
  remaining_seconds?: number;
  progress_percent?: number;
  uptime_percent?: number | null;
  services?: Array<{ name: string; status: string }>;
  _error?: string;
}

interface WalletDiagnosticsData {
  ok: boolean;
  rpc: {
    connected: boolean;
    chain_height: number;
    peers: number;
    mempool_size: number;
    network: string;
    version: string;
    submit_methods: string[];
  };
  supply?: {
    circulating_supply_zion: number;
    remaining_supply_zion: number;
    block_reward_zion: number;
  } | null;
  wallet?: {
    address: string;
    balance_atomic: number;
    balance_zion: number;
    balance_display: string;
    chain_height: number;
    transaction_model: string;
    utxo_count: number;
    total_utxo_amount: number;
    total_utxo_zion: number;
    utxos: Array<{
      tx_hash: string;
      output_index: number;
      amount: number;
      address: string;
      height: number;
    }>;
  } | null;
  miner?: {
    pending_balance_zion: number;
    paid_balance_zion: number;
    accepted_shares: number;
    rejected_shares: number;
    blocks_found: number;
    hashrate_1h: number;
    hashrate_24h: number;
    last_seen: number;
    recent_payouts: Array<{
      amount: number;
      tx_id?: string;
      timestamp?: number;
      status?: string;
    }>;
  } | null;
  broadcast: {
    endpoint: string;
    mode: string;
    note: string;
  };
}

interface WalletBroadcastResult {
  ok: boolean;
  method: string;
  accepted: boolean;
  tx_id: string | null;
  error?: string;
}

type WalletSubmitMethod = 'submitTransaction' | 'submitAccountTransaction' | 'sendRawTransaction';

type ChartRange = '1h' | '6h' | '24h';
type ServiceGroup = 'all' | 'core' | 'mining' | 'monitoring' | 'remote';

interface OpsAlert {
  id: string;
  message: string;
  severity: 'info' | 'warn' | 'critical';
  href?: string;
}

interface ServiceStatus {
  name: string; job: string; up: boolean | null; image: string; ports: string; note?: string;
}

interface StackSummary {
  redisUp: number | null;
  redisClients: number | null;
  redisMemoryUsed: number | null;
  redisMemoryMax: number | null;
  redisHitRatio: number | null;
  prometheusUp: number | null;
  nodeExporterUp: number | null;
  redisExporterUp: number | null;
  corePoolUp: number | null;
  coreNodeUp: number | null;
  hostKernel: string | null;
  prometheusHeadSeries: number | null;
  prometheusHeadChunks: number | null;
  prometheusReloadOk: number | null;
  alertmanagersDiscovered: number | null;
  prometheusQueueLength: number | null;
  prometheusVersion: string | null;
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmt(n?: number | null) { return n != null ? n.toLocaleString() : '—'; }
function fmtTime(s?: number | null) {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
function fmtHash(h?: number | null) {
  if (h == null || h === 0) return '0 H/s';
  if (h >= 1e15) return `${(h / 1e15).toFixed(2)} PH/s`;
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} KH/s`;
  return `${h.toFixed(0)} H/s`;
}
function fmtZion(value?: number | null) {
  if (value == null) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })} ZION`;
}
function fmtUptime(secs?: number | null) {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
function valColor(pct: number | null) {
  if (pct == null) return 'text-gray-400';
  if (pct > 85) return 'text-zion-purple';
  if (pct > 70) return 'text-zion-gold';
  return 'text-zion-cyan';
}
function barColor(pct: number | null) {
  if (pct == null) return 'bg-gray-500/40';
  if (pct > 85) return 'bg-zion-purple';
  if (pct > 70) return 'bg-zion-gold';
  return 'bg-zion-cyan';
}

function getInternalSeedContainers(data?: DashData | null) {
  return data?.internal_seed_containers ?? data?.seed_containers ?? [];
}

/* ═══════════ PROMETHEUS HELPERS ═══════════ */
async function promQuery(query: string): Promise<PromResult[]> {
  try {
    const r = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.result ?? [];
  } catch { return []; }
}
async function promRange(query: string, range = '1h', step = '120'): Promise<PromRangeResult[]> {
  try {
    const r = await fetch(`/api/metrics?query=${encodeURIComponent(query)}&range=${range}&step=${step}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.result ?? [];
  } catch { return []; }
}
function pv(results: PromiseSettledResult<PromResult[]>[], i: number): number | null {
  const r = results[i] as PromiseSettledResult<PromResult[]> | undefined;
  if (r?.status === 'fulfilled') { const first = r.value[0]; if (first) return parseFloat(first.value[1] ?? ''); }
  return null;
}
function pvLabel(results: (PromiseSettledResult<PromResult[]> | undefined)[], label: string, val: string): number | null {
  for (const r of results) { if (!r || r.status !== 'fulfilled') continue; for (const m of r.value) { if (m.metric[label] === val) return parseFloat(m.value[1] ?? ''); } }
  return null;
}

const EDGE_CORE_UP_QUERY = 'up{job="zion-core",instance="host.docker.internal:9115"}';
const EDGE_POOL_UP_QUERY = 'up{job="zion-pool",instance="zion-pool:8080"}';

async function fetchV3Metrics(): Promise<V3Metrics> {
  try {
    const r = await fetch('/api/dashboard-metrics', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      if (!d.error) return d as V3Metrics;
    }
  } catch { /* fall back to Prometheus */ }
  const qs = [
    'zion_chain_height','zion_peer_count','zion_mempool_size','zion_blocks_accepted_total',
    'zion_template_height','zion_template_txs','zion_template_fees_zion',
    'zion_pool_active_sessions','zion_pool_submits_total','zion_pool_accepted_total',
    'zion_pool_rejected_total','zion_pool_accept_rate_pct','zion_pool_uptime_seconds',
    'zion_miner_hashrate_hps','zion_miner_hashrate_10s_hps','zion_miner_hashrate_60s_hps',
    'zion_miner_accepted_shares_total','zion_miner_rejected_shares_total','zion_miner_accept_rate_pct',
    'zion_miner_submit_avg_latency_ms','zion_miner_pool_height','up{job=~"zion-miner-.*|zion-miner"}',
    'zion_pool_group_submits','zion_pool_group_accepted',
    'zion_pplns_window_size','zion_pplns_window_used','zion_pplns_registered_miners',
    'zion_pplns_total_paid_flowers','zion_pplns_payout_rounds',
    'node_load1','node_load5','node_load15',
    'node_memory_MemTotal_bytes','node_memory_MemAvailable_bytes',
    'node_filesystem_size_bytes{mountpoint="/"}','node_filesystem_avail_bytes{mountpoint="/"}',
    'node_boot_time_seconds',
    'up{job="zion-core"}','up{job="zion-pool"}',
  ];
  const res = await Promise.allSettled(qs.map(q => promQuery(q)));
  const minerUp = pv(res, 21) ?? ((pv(res, 13) ?? 0) > 0 ? 1 : 0);
  return {
    chainHeight: pv(res,0), peerCount: pv(res,1), mempoolSize: pv(res,2), blocksAccepted: pv(res,3),
    templateHeight: pv(res,4), templateTxs: pv(res,5), templateFees: pv(res,6),
    poolActiveSessions: pv(res,7), poolSubmits: pv(res,8), poolAccepted: pv(res,9),
    poolRejected: pv(res,10), poolAcceptRate: pv(res,11), poolUptime: pv(res,12),
    minerHashrate: pv(res,13), minerHashrate10s: pv(res,14), minerHashrate60s: pv(res,15),
    minerAccepted: pv(res,16), minerRejected: pv(res,17), minerAcceptRate: pv(res,18),
    minerSubmitAvgMs: pv(res,19), minerPoolHeight: pv(res,20), minerUp,
    groupZionSub: pvLabel([res[22]],'group','zion'), groupZionAcc: pvLabel([res[23]],'group','zion'),
    groupRevenueSub: pvLabel([res[22]],'group','revenue'), groupRevenueAcc: pvLabel([res[23]],'group','revenue'),
    groupNclSub: pvLabel([res[22]],'group','ncl'), groupNclAcc: pvLabel([res[23]],'group','ncl'),
    groupAutoSub: pvLabel([res[22]],'group','auto'), groupAutoAcc: pvLabel([res[23]],'group','auto'),
    pplnsWindowSize: pv(res,24), pplnsWindowUsed: pv(res,25), pplnsMiners: pv(res,26),
    pplnsPaid: pv(res,27), pplnsRounds: pv(res,28),
    serverLoad1: pv(res,29), serverLoad5: pv(res,30), serverLoad15: pv(res,31),
    memTotal: pv(res,32), memAvail: pv(res,33), diskTotal: pv(res,34), diskAvail: pv(res,35),
    bootTime: pv(res,36), coreUp: pv(res,37), poolUp: pv(res,38),
  };
}
async function fetchV3Sparklines(): Promise<V3Sparklines> {
  try {
    const r = await fetch('/api/dashboard-history', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      const s = d.samples ?? [];
      if (s.length > 0) {
        return {
          chainHeight: s.map((x: any) => x.n1_height ?? 0),
          poolSessions: s.map((x: any) => x.sessions ?? 0),
          shares: s.map((x: any) => x.shares_ok ?? 0),
          minerHashrate: s.map((x: any) => (x.hashrate ?? 0) * 1000),
        };
      }
    }
  } catch { /* fall back to Prometheus */ }
  const [h,s,a,m] = await Promise.allSettled([
    promRange('zion_chain_height','1h','120'),
    promRange('zion_pool_active_sessions','1h','120'),
    promRange('zion_pool_accepted_total','1h','120'),
    promRange('zion_miner_hashrate_hps','1h','120'),
  ]);
  const ex = (r: PromiseSettledResult<PromRangeResult[]>) => {
    if (r.status !== 'fulfilled') return []; const f = r.value[0]; return f ? f.values.map(([,v]) => parseFloat(v)) : [];
  };
  return { chainHeight: ex(h), poolSessions: ex(s), shares: ex(a), minerHashrate: ex(m) };
}

async function fetchV3Charts(range: ChartRange): Promise<V3Charts> {
  try {
    const r = await fetch('/api/dashboard-history', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      const s = d.samples ?? [];
      if (s.length > 0) {
        return {
          chainHeight: s.map((x: any) => x.n1_height ?? 0),
          poolSessions: s.map((x: any) => x.sessions ?? 0),
          shares: s.map((x: any) => x.shares_ok ?? 0),
          minerHashrate: s.map((x: any) => (x.hashrate ?? 0) * 1000),
          cpuLoad: [],
          memPct: [],
          redisMemory: [],
          timestamps: s.map((x: any) => x.t ?? 0),
        };
      }
    }
  } catch { /* fall back to Prometheus */ }
  const step = range === '1h' ? '60' : range === '6h' ? '300' : '600';
  const [h,s,a,m,cpu,memTotal,memAvail,redisMem] = await Promise.allSettled([
    promRange('zion_chain_height', range, step),
    promRange('zion_pool_active_sessions', range, step),
    promRange('zion_pool_accepted_total', range, step),
    promRange('zion_miner_hashrate_hps', range, step),
    promRange('node_load1', range, step),
    promRange('node_memory_MemTotal_bytes', range, step),
    promRange('node_memory_MemAvailable_bytes', range, step),
    promRange('redis_memory_used_bytes', range, step),
  ]);
  const ex = (r: PromiseSettledResult<PromRangeResult[]>) => {
    if (r.status !== 'fulfilled') return []; const f = r.value[0]; return f ? f.values.map(([,v]) => parseFloat(v)) : [];
  };
  const ts = (r: PromiseSettledResult<PromRangeResult[]>) => {
    if (r.status !== 'fulfilled') return []; const f = r.value[0]; return f ? f.values.map(([t]) => t) : [];
  };
  const totalArr = ex(memTotal), availArr = ex(memAvail);
  const memPct = totalArr.map((t, i) => { const a = availArr[i] ?? 0; return t > 0 ? ((1 - a / t) * 100) : 0; });
  return {
    chainHeight: ex(h),
    poolSessions: ex(s),
    shares: ex(a),
    minerHashrate: ex(m),
    cpuLoad: ex(cpu),
    memPct,
    redisMemory: ex(redisMem),
    timestamps: ts(h),
  };
}

async function fetchServiceStatuses(): Promise<ServiceStatus[]> {
  const upResults = await promQuery('up');

  const resolveJob = (prefixes: string[]): string => {
    const match = upResults.find((item) => {
      const job = item.metric.job ?? '';
      return prefixes.some((prefix) => job.startsWith(prefix));
    });
    return match?.metric.job ?? '';
  };

  const STACK: Omit<ServiceStatus, 'up'>[] = [
    { name: 'zion-core', job: 'zion-core', image: 'zion-core:2.9.8', ports: '8333, 8443, 9115' },
    { name: 'zion-pool', job: 'zion-pool', image: 'zion-pool:2.9.8', ports: '8444, 8080' },
    { name: 'zion-miner', job: '', image: 'zion-miner:2.9.8', ports: '—', note: 'no scrape target' },
    { name: 'zion-redis', job: 'redis', image: 'redis:7-alpine', ports: '6379' },
    { name: 'zion-seed-1', job: '', image: 'zion-core:2.9.8', ports: 'internal', note: 'seed node' },
    { name: 'zion-seed-2', job: '', image: 'zion-core:2.9.8', ports: 'internal', note: 'seed node' },
    { name: 'zion-website', job: '', image: 'zion-website:2.9.9', ports: '3000', note: 'this site' },
    { name: 'zion-prometheus', job: resolveJob(['prometheus']) || 'prometheus', image: 'prom/prometheus:v2.53.0', ports: '9090' },
    { name: 'zion-grafana', job: '', image: 'grafana/grafana:11.1.0', ports: '3001', note: '/grafana/' },
    { name: 'zion-node-exporter', job: 'node', image: 'prom/node-exporter:v1.8.1', ports: '9100' },
    { name: 'zion-redis-exporter', job: 'redis', image: 'oliver006/redis_exporter:v1.61.0', ports: '9121' },
    { name: 'zion-alertmanager', job: '', image: 'prom/alertmanager:v0.27.0', ports: '9093' },
    { name: 'core-pool-target', job: 'zion-pool-core', image: 'local scrape', ports: '—', note: 'Pool target' },
    { name: 'core-node-target', job: 'zion-core-core', image: 'local scrape', ports: '—', note: 'Node target' },
  ];
  const jobUp: Record<string, boolean> = {};
  for (const r of upResults) { jobUp[r.metric.job ?? ''] = r.value[1] === '1'; }
  return STACK.map(s => ({ ...s, up: s.job ? (jobUp[s.job] ?? null) : null }));
}

async function fetchStackSummary(): Promise<StackSummary> {
  const qs = [
    'redis_up',
    'redis_connected_clients',
    'redis_memory_used_bytes',
    'redis_memory_max_bytes',
    'redis_keyspace_hits_total',
    'redis_keyspace_misses_total',
    'up{job="prometheus"}',
    'up{job="node"}',
    'up{job="redis"}',
    'up{job="zion-pool-core"}',
    'up{job="zion-core-core"}',
    'node_uname_info',
    'prometheus_tsdb_head_series',
    'prometheus_tsdb_head_chunks',
    'prometheus_config_last_reload_successful',
    'prometheus_notifications_alertmanagers_discovered',
    'prometheus_notifications_queue_length',
    'prometheus_build_info',
  ];
  const res = await Promise.allSettled(qs.map(q => promQuery(q)));
  const hits = pv(res, 4);
  const misses = pv(res, 5);
  const hitRatio = hits != null && misses != null && (hits + misses) > 0 ? (hits / (hits + misses)) * 100 : null;
  const kernelResult = res[11];
  let hostKernel: string | null = null;
  if (kernelResult?.status === 'fulfilled') {
    const first = kernelResult.value[0];
    if (first) {
      const sysname = first.metric.sysname ?? 'Linux';
      const release = first.metric.release ?? 'unknown';
      const machine = first.metric.machine ?? '';
      hostKernel = `${sysname} ${release}${machine ? ` · ${machine}` : ''}`;
    }
  }
  let prometheusVersion: string | null = null;
  const buildInfoResult = res[17];
  if (buildInfoResult?.status === 'fulfilled') {
    const first = buildInfoResult.value[0];
    if (first) {
      prometheusVersion = first.metric.version ?? null;
    }
  }
  return {
    redisUp: pv(res, 0),
    redisClients: pv(res, 1),
    redisMemoryUsed: pv(res, 2),
    redisMemoryMax: pv(res, 3),
    redisHitRatio: hitRatio,
    prometheusUp: pv(res, 6),
    nodeExporterUp: pv(res, 7),
    redisExporterUp: pv(res, 8),
    corePoolUp: pv(res, 9),
    coreNodeUp: pv(res, 10),
    hostKernel,
    prometheusHeadSeries: pv(res, 12),
    prometheusHeadChunks: pv(res, 13),
    prometheusReloadOk: pv(res, 14),
    alertmanagersDiscovered: pv(res, 15),
    prometheusQueueLength: pv(res, 16),
    prometheusVersion,
  };
}

async function fetchWalletDiagnostics(address?: string): Promise<WalletDiagnosticsData> {
  const query = address?.trim() ? `?address=${encodeURIComponent(address.trim())}` : '';
  const response = await fetch(`/api/wallet${query}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? 'Wallet diagnostics unavailable');
  }
  return payload as WalletDiagnosticsData;
}

async function submitWalletBroadcast(method: WalletSubmitMethod, transaction: unknown): Promise<WalletBroadcastResult> {
  const response = await fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, transaction }),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? 'Transaction submit failed');
  }
  return payload as WalletBroadcastResult;
}

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/* ═══════════════════════ TAB CONFIG ═══════════════════════ */
const getTabs = (cs: boolean) => [
  { id: 'dashboard', label: MissionControlDashboardCopy.dashboard[cs ? 'cs' : 'en'], icon: Monitor },
  { id: 'metrics', label: MissionControlDashboardCopy.stackMetrics[cs ? 'cs' : 'en'], icon: BarChart3 },
  { id: 'upgrade', label: 'Ekam Deeksha', icon: Sparkles },
  { id: 'roadmap', label: MissionControlDashboardCopy.roadmap[cs ? 'cs' : 'en'], icon: Target },
  { id: 'layers', label: MissionControlDashboardCopy.layers[cs ? 'cs' : 'en'], icon: Layers },
  { id: 'constitution', label: MissionControlDashboardCopy.constitution[cs ? 'cs' : 'en'], icon: Lock },
  { id: 'economy', label: MissionControlDashboardCopy.economy[cs ? 'cs' : 'en'], icon: Wallet },
  { id: 'security', label: MissionControlDashboardCopy.security[cs ? 'cs' : 'en'], icon: Shield },
  { id: 'timeline', label: MissionControlDashboardCopy.timeline[cs ? 'cs' : 'en'], icon: CalendarDays },
  { id: 'priority', label: MissionControlDashboardCopy.priority[cs ? 'cs' : 'en'], icon: Zap },
] as const;

type TabId = 'dashboard' | 'metrics' | 'upgrade' | 'roadmap' | 'layers' | 'constitution' | 'economy' | 'security' | 'timeline' | 'priority';

function getFallbackReadinessMap(cs: boolean): ReadinessMap {
  return {
    done: [
      { title: 'Ekam Deeksha v3.2 canonical PoW', detail: cs ? '512 KiB scratchpad · 2 passes · 128 reads · 2 AES rounds · KAT locked' : '512 KiB scratchpad · 2 passes · 128 reads · 2 AES rounds · KAT locked' },
      { title: 'V31 cutover + premine soft-fork', detail: cs ? 'Ekam Deeksha na všech výškách · premine time-locky + admin multisig' : 'Ekam Deeksha at all heights · premine time-locks + admin multisig' },
      { title: 'Gates G1–G5 · G7 · G11 + E4', detail: cs ? 'Rigy, chaos/load, bridge round-trip, migrace uzavřeny' : 'Rigs, chaos/load, bridge round-trip, migration closed' },
      { title: MissionControlDashboardCopy.feeSplit89551[cs ? 'cs' : 'en'], detail: MissionControlDashboardCopy.pplnsPayoutVerifiedAndActive[cs ? 'cs' : 'en'] },
      { title: 'Public releases v3.2.0', detail: 'Miner · CLI · Desktop Agent' },
    ],
    missing: [],
    not_missing: [
      { title: MissionControlDashboardCopy.genesisPremine[cs ? 'cs' : 'en'], detail: cs ? '16.78B ZION, 14 výstupů, admin-locked' : '16.78B ZION, 14 outputs, admin-locked' },
      { title: MissionControlDashboardCopy.wzionErc20[cs ? 'cs' : 'en'], detail: MissionControlDashboardCopy.deployedOnBaseMainnet[cs ? 'cs' : 'en'] },
      { title: '89/5/5/1 reward split', detail: cs ? 'On-chain od V31 cutoveru' : 'On-chain since the V31 cutover' },
    ],
    next_48h: [
      { title: 'G8 — 30-day continuous run', detail: cs ? '23. 8. — 22. 9. 2026 · uptime ≥ 99,9 %' : '23 Aug — 22 Sep 2026 · uptime ≥ 99.9%' },
      { title: 'G9 — security audit', detail: MissionControlDashboardCopy.externalFirmBooked[cs ? 'cs' : 'en'] },
      { title: 'G10 — L5/L6 decision', detail: cs ? 'Treasury + humanitární fond + Issobella governance' : 'Treasury + humanitarian fund + Issobella governance' },
    ],
  };
}

const CHART_RANGES: { value: ChartRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
];

const getServiceGroups = (cs: boolean): { value: ServiceGroup; label: string }[] => [
  { value: 'all', label: MissionControlDashboardCopy.all[cs ? 'cs' : 'en'] },
  { value: 'core', label: 'Core' },
  { value: 'mining', label: MissionControlDashboardCopy.mining[cs ? 'cs' : 'en'] },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'remote', label: 'Remote' },
];

function getServiceGroup(service: ServiceStatus): Exclude<ServiceGroup, 'all'> {
  if (service.name.includes('germany-')) return 'remote';
  if (service.name.includes('prometheus') || service.name.includes('grafana') || service.name.includes('exporter') || service.name.includes('alertmanager') || service.name.includes('website')) return 'monitoring';
  if (service.name.includes('pool') || service.name.includes('miner')) return 'mining';
  return 'core';
}

function getServiceActions(service: ServiceStatus, cs: boolean): { href: string; label: string }[] {
  const actions: { href: string; label: string }[] = [];
  if (service.job || service.name.includes('core') || service.name.includes('pool') || service.name.includes('redis') || service.name.includes('germany-')) {
    actions.push({ href: '/monitoring', label: 'Monitoring' });
  }
  if (service.name.includes('prometheus') || service.name.includes('grafana') || service.name.includes('exporter') || service.name.includes('alertmanager')) {
    actions.push({ href: '/grafana/', label: 'Grafana' });
  }
  if (actions.length === 0) {
    actions.push({ href: '/monitoring', label: MissionControlDashboardCopy.inspect[cs ? 'cs' : 'en'] });
  }
  return actions;
}

function getServiceSortRank(service: ServiceStatus): number {
  if (service.up === false) return 0;
  if (service.up === null) return 1;
  return 2;
}

/* ═══════════════════════ SUB-COMPONENTS ═══════════════════════ */
function Stat({ label, value, sub, color = 'text-white', mono }: { label: string; value: string; sub?: string; color?: string; mono?: boolean }) {
  return (
    <div className="zion-rainbow-sub px-3 sm:px-5 py-3 sm:py-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gray-400">{label}</p>
      <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold ${color} ${mono ? 'font-mono' : ''}`}>{value}</p>
      {sub && <p className="text-xs sm:text-sm text-gray-300">{sub}</p>}
    </div>
  );
}

function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-2 rounded-full bg-white/10 overflow-hidden ${className}`}>
      <motion.div
        className="h-full rounded-full bg-linear-to-r from-zion-cyan via-zion-purple to-zion-purple"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </div>
  );
}

function BigProgress({ run }: { run?: StabilityRun }) {
  const pct = run?.progress_pct ?? 0;
  return (
    <div className="mb-4">
      <div className="flex flex-col sm:flex-row sm:justify-between text-[10px] sm:text-xs text-gray-500 mb-2 gap-0.5">
        <span>Start: {run?.start ? new Date(run.start).toLocaleString() : '—'}</span>
        <span>End: {run?.start && run?.duration_secs ? new Date(new Date(run.start).getTime() + run.duration_secs * 1000).toLocaleString() : '—'}</span>
      </div>
      <div className="relative h-9 zion-section overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-zion-cyan via-zion-purple to-zion-purple"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <div className="absolute right-0 inset-y-0 w-14 bg-linear-to-r from-transparent to-white/25 animate-pulse" />
        </motion.div>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md z-10">{pct}%</span>
      </div>
    </div>
  );
}

function G8RunCard({ run }: { run: G8Run | null }) {
  if (!run?.started) {
    return (
      <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-zion-cyan" />
          <div>
            <h4 className="text-sm font-semibold text-white">30-Day Continuous Run</h4>
            <p className="text-xs text-gray-400">Not started</p>
          </div>
        </div>
      </div>
    );
  }

  const pct = run.progress_percent ?? 0;
  const elapsed = run.elapsed_seconds ?? 0;
  const remaining = run.remaining_seconds ?? 0;

  function fmtG8Duration(s: number) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }

  const statusLabel = run.status === 'running' ? 'Running' : run.status === 'completed' ? 'Completed' : run.status === 'stopped' ? 'Stopped' : 'Not started';
  const statusColor = run.status === 'running' ? '#22C55E' : run.status === 'completed' ? '#3B82F6' : '#F59E0B';

  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-zion-cyan" />
          <div>
            <h4 className="text-sm font-semibold text-white">30-Day Continuous Run</h4>
            <p className="text-[10px] text-gray-400">Mainnet stability target ≥99.9% uptime</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold self-start" style={{ background: statusColor + '20', color: statusColor, border: '1px solid ' + statusColor + '40' }}>
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Started</p>
          <p className="text-xs font-mono text-white">{new Date(run.started).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">End</p>
          <p className="text-xs font-mono text-white">{run.target_end ? new Date(run.target_end).toLocaleString() : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Elapsed</p>
          <p className="text-xs font-mono text-zion-cyan">{fmtG8Duration(elapsed)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Remaining</p>
          <p className="text-xs font-mono text-zion-cyan">{fmtG8Duration(remaining)}</p>
        </div>
      </div>
      {typeof run.uptime_percent === 'number' && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <span className="font-semibold text-zion-cyan">{run.uptime_percent.toFixed(2)}%</span>
          <span>service uptime</span>
        </div>
      )}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Progress</span>
          <span className="font-mono text-white">{pct.toFixed(4)}%</span>
        </div>
        <ProgressBar pct={pct} />
      </div>
    </div>
  );
}

function fmtLastBlock(secs?: number | null) {
  if (secs == null) return '—';
  if (secs < 120) return `${secs}s`;
  if (secs < 7200) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function ServerCard({ node, name, flag, ip }: { node?: ServerNode; name: string; flag: string; ip: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const s = node?.stats;
  const memPct =
    node?.mem?.total && node.mem.total > 0 && node.mem.used != null
      ? Math.round((node.mem.used / node.mem.total) * 100)
      : null;
  const diskPct = node?.disk?.used_pct ?? null;
  const isHealthy = s?.status === 'OK' || s?.status === 'ok' || s?.status === 'healthy';
  const isSyncing = s?.sync?.state === 'Downloading' || s?.sync?.state === 'Syncing';
  const isStale = (s?.time_since_last_block ?? 0) > 300; // 5 min no blocks
  const containersLabel =
    node?.containers_up != null && node?.containers_healthy != null
      ? `${node.containers_up}/${node.containers_healthy}`
      : '—/—';

  const statusLabel = !s?.status ? (MissionControlDashboardCopy.offline[cs ? 'cs' : 'en']) : isHealthy ? (MissionControlDashboardCopy.online[cs ? 'cs' : 'en']) : isSyncing ? (MissionControlDashboardCopy.syncing[cs ? 'cs' : 'en']) : isStale ? (MissionControlDashboardCopy.stale[cs ? 'cs' : 'en']) : (MissionControlDashboardCopy.unhealthy[cs ? 'cs' : 'en']);
  const statusStyle = isHealthy
    ? 'text-emerald-200 bg-zion-cyan/10 border-zion-cyan/30'
    : isSyncing
    ? 'text-blue-200 bg-zion-purple/10 border-zion-purple/30'
    : s?.status
    ? 'text-yellow-200 bg-zion-gold/10 border-zion-gold/30'
    : 'text-red-200 bg-zion-purple/10 border-zion-purple/30';
  const StatusIcon = isHealthy ? CircleDot : !s?.status ? XCircle : AlertTriangle;
  const borderStyle = isHealthy ? 'border-zion-cyan/30 bg-zion-cyan/5' : isSyncing ? 'border-zion-purple/30 bg-zion-purple/5' : 'border-zion-gold/30 bg-zion-gold/5';

  return (
    <div className="zion-rainbow-card p-4 sm:p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 flex-wrap">
        <span className="text-xl sm:text-2xl">{flag}</span>
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm sm:text-base">{name}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 font-mono truncate">{ip}</div>
        </div>
        <span className={`ml-auto inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border uppercase tracking-widest ${statusStyle}`}>
          <StatusIcon className="h-3 w-3" /> {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
        <MiniMetric label={MissionControlDashboardCopy.height[cs ? 'cs' : 'en']} value={fmt(s?.height)} color="text-zion-cyan" />
        <MiniMetric label={MissionControlDashboardCopy.peers[cs ? 'cs' : 'en']} value={fmt(s?.peers_connected)} />
        <MiniMetric label={MissionControlDashboardCopy.difficulty[cs ? 'cs' : 'en']} value={fmt(s?.difficulty)} />
        <MiniMetric label="Mempool" value={fmt(s?.mempool_size)} />
        <MiniMetric label={MissionControlDashboardCopy.lastBlock[cs ? 'cs' : 'en']} value={fmtLastBlock(s?.time_since_last_block)} color={isStale ? 'text-zion-gold' : 'text-white'} />
        <MiniMetric label={MissionControlDashboardCopy.containers[cs ? 'cs' : 'en']} value={containersLabel} />
        <div className="zion-tile p-3">
          <p className="text-[9px] uppercase tracking-[0.5px] text-gray-400">{MissionControlDashboardCopy.memory[cs ? 'cs' : 'en']}</p>
          <p className={`text-base font-bold font-mono ${valColor(memPct)}`}>{memPct == null ? '—' : `${memPct}%`}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${barColor(memPct)}`} style={{ width: `${memPct ?? 0}%` }} />
          </div>
        </div>
        <div className="zion-tile p-3">
          <p className="text-[9px] uppercase tracking-[0.5px] text-gray-400">{MissionControlDashboardCopy.disk[cs ? 'cs' : 'en']}</p>
          <p className={`text-base font-bold font-mono ${valColor(diskPct)}`}>{diskPct == null ? '—' : `${diskPct}%`}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${barColor(diskPct)}`} style={{ width: `${diskPct ?? 0}%` }} />
          </div>
        </div>
        <MiniMetric label={MissionControlDashboardCopy.load[cs ? 'cs' : 'en']} value={String(node?.load ?? '—')} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="zion-tile p-2.5 sm:p-3 min-w-0">
      <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-gray-400 truncate">{label}</p>
      <p className={`text-sm sm:text-base font-bold font-mono truncate ${color}`}>{value}</p>
    </div>
  );
}

function OpsServiceCard({ service, onOpen }: { service: ServiceStatus; onOpen: (service: ServiceStatus) => void }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const group = getServiceGroup(service);
  const actions = getServiceActions(service, cs);
  const statusClass = service.up === true
    ? 'text-zion-cyan border-zion-cyan/30 bg-zion-cyan/10'
    : service.up === false
    ? 'text-zion-purple border-zion-purple/30 bg-zion-purple/10'
    : 'text-gray-400 border-white/10 bg-white/5';
  const dotClass = service.up === true ? 'bg-zion-cyan' : service.up === false ? 'bg-zion-purple' : 'bg-gray-500';
  const statusLabel = service.up === true ? 'UP' : service.up === false ? 'DOWN' : 'N/A';
  return (
    <button onClick={() => onOpen(service)} className="zion-rainbow-sub w-full text-left p-3 space-y-3 transition-colors" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotClass} ${service.up === true ? 'animate-pulse' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{service.name}</div>
          <div className="text-[10px] text-gray-500 font-mono truncate">{service.image}</div>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border uppercase tracking-widest ${statusClass}`}>{statusLabel}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 uppercase tracking-[0.2em] text-gray-400">{group}</span>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {actions.map(action => (
            <a
              key={`${service.name}_${action.label}`}
              href={action.href}
              onClick={event => event.stopPropagation()}
              target={action.href.startsWith('/grafana') ? '_blank' : undefined}
              rel={action.href.startsWith('/grafana') ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-1 rounded-lg border border-zion-cyan/20 bg-zion-cyan/10 px-2 py-1 text-zion-cyan hover:border-zion-cyan/40 hover:text-cyan-200 transition-colors"
            >
              <Link className="h-3 w-3" />
              {action.label}
            </a>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="zion-tile p-2">
          <div className="uppercase tracking-[0.2em] text-gray-500 mb-1">{MissionControlDashboardCopy.ports[cs ? 'cs' : 'en']}</div>
          <div className="font-mono text-gray-300 break-all">{service.ports}</div>
        </div>
        <div className="zion-tile p-2">
          <div className="uppercase tracking-[0.2em] text-gray-500 mb-1">Meta</div>
          <div className="text-gray-300 wrap-break-word">{service.note ?? (service.job ? `job: ${service.job}` : 'local service')}</div>
        </div>
      </div>
    </button>
  );
}

function ServiceDetailDrawer({ service, onClose }: { service: ServiceStatus; onClose: () => void }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const group = getServiceGroup(service);
  const actions = getServiceActions(service, cs);
  const statusLabel = service.up === true ? 'UP' : service.up === false ? 'DOWN' : 'N/A';
  const statusClass = service.up === true
    ? 'text-zion-cyan border-zion-cyan/30 bg-zion-cyan/10'
    : service.up === false
    ? 'text-zion-purple border-zion-purple/30 bg-zion-purple/10'
    : 'text-gray-300 border-white/10 bg-white/5';
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <button aria-label={MissionControlDashboardCopy.closeDetails[cs ? 'cs' : 'en']} onClick={onClose} className="absolute inset-0" />
      <motion.div initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }} className="relative h-full w-full max-w-lg border-l border-white/10 bg-zinc-950/95 p-5 sm:p-6 overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{MissionControlDashboardCopy.serviceDetail[cs ? 'cs' : 'en']}</p>
            <h3 className="text-2xl font-semibold text-white mt-2">{service.name}</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">{service.image}</p>
          </div>
          <button onClick={onClose} className="zion-tile p-2 text-gray-300 hover:text-white transition-colors">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border uppercase tracking-widest ${statusClass}`}>{statusLabel}</span>
          <span className="text-[10px] font-semibold px-3 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300 uppercase tracking-widest">{group}</span>
          {service.job && <span className="text-[10px] font-semibold px-3 py-1 rounded-full border border-zion-cyan/20 bg-zion-cyan/10 text-zion-cyan uppercase tracking-widest">{service.job}</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <MiniMetric label={MissionControlDashboardCopy.ports[cs ? 'cs' : 'en']} value={service.ports} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.status[cs ? 'cs' : 'en']} value={statusLabel} color={service.up === true ? 'text-zion-cyan' : service.up === false ? 'text-zion-purple' : 'text-gray-300'} />
        </div>
        <div className="zion-section p-4 mb-5">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">{MissionControlDashboardCopy.operationalContext[cs ? 'cs' : 'en']}</div>
          <div className="text-sm text-gray-300 leading-relaxed">{service.note ?? (service.job ? (cs ? `Prometheus target je propojen pres job ${service.job}.` : `Prometheus target linked through job ${service.job}.`) : (MissionControlDashboardCopy.localServiceWithoutADirectProm[cs ? 'cs' : 'en']))}</div>
        </div>
        <div className="zion-section p-4 mb-5">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">{MissionControlDashboardCopy.quickActions[cs ? 'cs' : 'en']}</div>
          <div className="flex flex-wrap gap-2">
            {actions.map(action => (
              <a key={`${service.name}_drawer_${action.label}`} href={action.href} target={action.href.startsWith('/grafana') ? '_blank' : undefined} rel={action.href.startsWith('/grafana') ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2 rounded-xl border border-zion-cyan/20 bg-zion-cyan/10 px-3 py-2 text-sm text-zion-cyan hover:border-zion-cyan/40 hover:text-cyan-200 transition-colors">
                <Link className="h-4 w-4" />
                {action.label}
              </a>
            ))}
          </div>
        </div>
        <div className="zion-section p-4">
          <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">{MissionControlDashboardCopy.operatorNotes[cs ? 'cs' : 'en']}</div>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>{MissionControlDashboardCopy.statusDownMeansAScrapeFailureO[cs ? 'cs' : 'en']}</li>
            <li>{MissionControlDashboardCopy.statusNAMeansTheServiceIsNotCo[cs ? 'cs' : 'en']}</li>
            <li>{MissionControlDashboardCopy.useTheMonitoringOrGrafanaActio[cs ? 'cs' : 'en']}</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

function StatusDot({ up }: { up: number | null }) {
  const c = up === 1 ? 'bg-zion-cyan' : up === 0 ? 'bg-zion-purple' : 'bg-gray-500';
  const p = up === 1 ? 'animate-pulse' : '';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c} ${p}`} />;
}

function MetricBar({ value, max, color = 'bg-zion-cyan' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MiniSparkline({ data: d, color = '#10b981', height = 28 }: { data: number[]; color?: string; height?: number }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  if (d.length < 2) return <div className="h-7 flex items-center text-[10px] text-gray-600">{MissionControlDashboardCopy.awaitingData[cs ? 'cs' : 'en']}</div>;
  const min = Math.min(...d), max = Math.max(...d), range = max - min || 1, w = 140;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AreaChart({ data: d, timestamps, label, color = '#10b981', unit = '', height = 120 }: { data: number[]; timestamps?: number[]; label: string; color?: string; unit?: string; height?: number }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = MissionControlDashboardCopy.enUs[cs ? 'cs' : 'en'];
  if (d.length < 2) return <div className="zion-tile p-4"><div className="text-[10px] text-gray-500 mb-1">{label}</div><div className="h-20 flex items-center justify-center text-[10px] text-gray-600">{MissionControlDashboardCopy.awaitingData[cs ? 'cs' : 'en']}</div></div>;
  const min = Math.min(...d), max = Math.max(...d), range = max - min || 1;
  const w = 600, h = height, pad = 2;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * w},${h - ((v - min) / range) * (h - pad * 2) - pad}`);
  const polyline = pts.join(' ');
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`;
  const gradId = `grad_${label.replace(/\s/g, '_')}`;
  // Y-axis labels
  const yMax = max >= 1000 ? `${(max / 1000).toFixed(1)}k` : max >= 1 ? max.toFixed(max < 10 ? 1 : 0) : max.toFixed(2);
  const yMin = min >= 1000 ? `${(min / 1000).toFixed(1)}k` : min >= 1 ? min.toFixed(min < 10 ? 1 : 0) : min.toFixed(2);
  const yMid = ((min + max) / 2);
  const yMidLabel = yMid >= 1000 ? `${(yMid / 1000).toFixed(1)}k` : yMid >= 1 ? yMid.toFixed(yMid < 10 ? 1 : 0) : yMid.toFixed(2);
  // Time labels
  const tLabels: string[] = [];
  if (timestamps && timestamps.length >= 2) {
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor((i / 4) * (timestamps.length - 1));
      const t = timestamps[idx];
      if (t != null) tLabels.push(new Date(t * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
    }
  }
  const latest = d[d.length - 1] ?? 0;
  const latestStr = latest >= 1000 ? `${(latest / 1000).toFixed(1)}k` : latest.toFixed(latest < 10 ? 1 : 0);
  return (
    <div className="zion-tile p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm font-mono font-bold" style={{ color }}>{latestStr}{unit}</div>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[8px] text-gray-600 font-mono w-8 shrink-0">
          <span>{yMax}</span><span>{yMidLabel}</span><span>{yMin}</span>
        </div>
        <div className="flex-1 min-w-0">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1={0} y1={h / 4} x2={w} y2={h / 4} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <line x1={0} y1={h * 3 / 4} x2={w} y2={h * 3 / 4} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            <polygon points={area} fill={`url(#${gradId})`} />
            <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {tLabels.length > 0 && (
            <div className="flex justify-between text-[8px] text-gray-600 font-mono mt-1">
              {tLabels.map((t, i) => <span key={i}>{t}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PoolGroupRow({ name, submits, accepted, dot }: { name: string; submits: number | null | undefined; accepted: number | null | undefined; dot: string }) {
  const s = submits ?? 0, a = accepted ?? 0, rate = s > 0 ? ((a / s) * 100) : 0;
  return (
    <div className="zion-rainbow-sub flex items-center gap-3 p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white capitalize">{name}</span>
          <span className="text-xs text-gray-400">{fmt(submits)} sub / {fmt(accepted)} acc</span>
        </div>
        <MetricBar value={a} max={s || 1} color={s > 0 ? 'bg-zion-cyan' : 'bg-gray-600'} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-12 text-right">{s > 0 ? `${rate.toFixed(0)}%` : '—'}</span>
    </div>
  );
}

/* ═══════════ ONE LOVE TEST MAINNET METRICS SECTION ═══════════ */
function V3MetricsSection({
  v3: m,
  sparks,
  nowSec,
  cs,
  locale,
}: {
  v3: V3Metrics;
  sparks: V3Sparklines;
  nowSec: number;
  cs: boolean;
  locale: string;
}) {
  const memPct = m.memTotal && m.memAvail ? ((1 - m.memAvail / m.memTotal) * 100) : null;
  const diskPct = m.diskTotal && m.diskAvail ? ((1 - m.diskAvail / m.diskTotal) * 100) : null;
  const uptime = m.bootTime ? nowSec - m.bootTime : null;
  const pplnsPct = m.pplnsWindowSize && m.pplnsWindowUsed ? ((m.pplnsWindowUsed / m.pplnsWindowSize) * 100) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="zion-rainbow-card p-4 sm:p-6 lg:p-8 space-y-6"
      style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">One Love Mainnet</p>
          <span className="text-[10px] uppercase tracking-widest border border-zion-cyan/40 bg-zion-cyan/10 text-zion-cyan px-2 py-0.5 rounded-full font-semibold">LIVE PROMETHEUS</span>
        </div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
          <TrendingUp className="h-7 w-7 text-zion-cyan" />
          One Love Mainnet Metrics
        </h2>
        <p className="text-sm text-gray-400">30+ live Prometheus metrics pro mainnet launch stack: core node, mining pool, PPLNS engine a host infrastrukturu.</p>
      </div>

      {/* Status indicators */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.coreUp} /><span className="text-gray-300">{MissionControlDashboardCopy.coreNode[cs ? 'cs' : 'en']}</span></div>
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.poolUp} /><span className="text-gray-300">{MissionControlDashboardCopy.miningPool[cs ? 'cs' : 'en']}</span></div>
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.minerUp} /><span className="text-gray-300">{MissionControlDashboardCopy.minerRuntime[cs ? 'cs' : 'en']}</span></div>
        <div className="flex items-center gap-2 text-sm"><StatusDot up={m.serverLoad1 != null ? 1 : null} /><span className="text-gray-300">Node Exporter</span></div>
        <div className="ml-auto text-xs text-gray-500 font-mono">{m.chainHeight != null ? `${MissionControlDashboardCopy.block[cs ? 'cs' : 'en']} #${m.chainHeight.toLocaleString(locale)}` : ''}</div>
      </div>

      {/* ── Core Blockchain ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Server className="h-4 w-4 text-zion-cyan" /> Core Blockchain</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          <MiniMetric label="Chain Height" value={fmt(m.chainHeight)} color="text-zion-gold" />
          <MiniMetric label="Template Ht" value={fmt(m.templateHeight)} color="text-zion-gold" />
          <MiniMetric label="Peers" value={fmt(m.peerCount)} color="text-zion-cyan" />
          <MiniMetric label="Mempool" value={fmt(m.mempoolSize)} color="text-zion-purple" />
          <MiniMetric label={MissionControlDashboardCopy.blocksAcc[cs ? 'cs' : 'en']} value={fmt(m.blocksAccepted)} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.tmplTxs[cs ? 'cs' : 'en']} value={fmt(m.templateTxs)} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.tmplFees[cs ? 'cs' : 'en']} value={m.templateFees != null ? `${m.templateFees}` : '—'} color="text-zion-gold" />
        </div>
        {sparks.chainHeight.length > 1 && (
          <div className="mt-2 zion-tile p-3">
            <div className="text-[10px] text-gray-500 mb-1">{MissionControlDashboardCopy.chainHeight1h[cs ? 'cs' : 'en']}</div>
            <MiniSparkline data={sparks.chainHeight} color="#fcd116" height={32} />
          </div>
        )}
      </div>

      {/* ── Mining Pool ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-zion-gold" /> Mining Pool</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          <MiniMetric label="Active Miners" value={fmt(m.poolActiveSessions)} color="text-zion-gold" />
          <MiniMetric label="Submits" value={fmt(m.poolSubmits)} color="text-zion-cyan" />
          <MiniMetric label="Accepted" value={fmt(m.poolAccepted)} color="text-zion-cyan" />
          <MiniMetric label="Rejected" value={fmt(m.poolRejected)} color="text-zion-purple" />
          <MiniMetric label="Accept Rate" value={m.poolAcceptRate != null ? `${m.poolAcceptRate.toFixed(1)}%` : '—'} color={m.poolAcceptRate != null && m.poolAcceptRate >= 95 ? 'text-zion-cyan' : 'text-zion-gold'} />
          <MiniMetric label="Pool Uptime" value={fmtUptime(m.poolUptime)} color="text-zion-cyan" />
          <MiniMetric label="PPLNS Miners" value={fmt(m.pplnsMiners)} color="text-zion-purple" />
        </div>
        {(sparks.poolSessions.length > 1 || sparks.shares.length > 1) && (
          <div className="mt-2 grid md:grid-cols-2 gap-2.5">
            {sparks.poolSessions.length > 1 && (<div className="zion-tile p-3"><div className="text-[10px] text-gray-500 mb-1">{MissionControlDashboardCopy.activeMiners1h[cs ? 'cs' : 'en']}</div><MiniSparkline data={sparks.poolSessions} color="#fcd116" /></div>)}
            {sparks.shares.length > 1 && (<div className="zion-tile p-3"><div className="text-[10px] text-gray-500 mb-1">{MissionControlDashboardCopy.acceptedShares1h[cs ? 'cs' : 'en']}</div><MiniSparkline data={sparks.shares} color="#10b981" /></div>)}
          </div>
        )}
      </div>

      {/* ── Miner Runtime ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Pickaxe className="h-4 w-4 text-zion-cyan" /> {MissionControlDashboardCopy.minerRuntime[cs ? 'cs' : 'en']}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          <MiniMetric label={MissionControlDashboardCopy.minerTarget[cs ? 'cs' : 'en']} value={m.minerUp === 1 ? 'UP' : m.minerUp === 0 ? 'DOWN' : '—'} color={m.minerUp === 1 ? 'text-zion-cyan' : m.minerUp === 0 ? 'text-zion-purple' : 'text-gray-400'} />
          <MiniMetric label="Hashrate" value={m.minerHashrate != null ? fmtHash(m.minerHashrate) : '—'} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.hashrate10s[cs ? 'cs' : 'en']} value={m.minerHashrate10s != null ? fmtHash(m.minerHashrate10s) : '—'} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.hashrate60s[cs ? 'cs' : 'en']} value={m.minerHashrate60s != null ? fmtHash(m.minerHashrate60s) : '—'} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.accepted[cs ? 'cs' : 'en']} value={fmt(m.minerAccepted)} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.rejected[cs ? 'cs' : 'en']} value={fmt(m.minerRejected)} color="text-zion-purple" />
          <MiniMetric label={MissionControlDashboardCopy.acceptRate[cs ? 'cs' : 'en']} value={m.minerAcceptRate != null ? `${m.minerAcceptRate.toFixed(1)}%` : '—'} color={m.minerAcceptRate != null && m.minerAcceptRate >= 95 ? 'text-zion-cyan' : 'text-zion-gold'} />
          <MiniMetric label={MissionControlDashboardCopy.submitAvg[cs ? 'cs' : 'en']} value={m.minerSubmitAvgMs != null ? `${m.minerSubmitAvgMs.toFixed(1)} ms` : '—'} color="text-zion-purple" />
          <MiniMetric label={MissionControlDashboardCopy.poolHeight[cs ? 'cs' : 'en']} value={fmt(m.minerPoolHeight)} color="text-zion-gold" />
        </div>
        {sparks.minerHashrate.length > 1 && (
          <div className="mt-2 zion-tile p-3">
            <div className="text-[10px] text-gray-500 mb-1">{MissionControlDashboardCopy.minerHashrate1h[cs ? 'cs' : 'en']}</div>
            <MiniSparkline data={sparks.minerHashrate} color="#10b981" height={32} />
          </div>
        )}
      </div>

      {/* ── Pool Groups ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Network className="h-4 w-4 text-zion-cyan" /> {MissionControlDashboardCopy.poolRoutingGroups[cs ? 'cs' : 'en']}</h3>
        <div className="grid md:grid-cols-2 gap-2.5">
          <PoolGroupRow name="zion (Main)" submits={m.groupZionSub} accepted={m.groupZionAcc} dot="bg-zion-cyan" />
          <PoolGroupRow name="revenue (CH3)" submits={m.groupRevenueSub} accepted={m.groupRevenueAcc} dot="bg-zion-gold" />
          <PoolGroupRow name="ncl (Neural)" submits={m.groupNclSub} accepted={m.groupNclAcc} dot="bg-zion-purple" />
          <PoolGroupRow name="auto" submits={m.groupAutoSub} accepted={m.groupAutoAcc} dot="bg-zion-cyan" />
        </div>
      </div>

      {/* ── PPLNS Reward Engine ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-zion-purple" /> PPLNS Reward Engine</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Window Size</p>
            <p className="text-base sm:text-lg font-mono font-bold text-zion-purple truncate">{fmt(m.pplnsWindowSize)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Window Used</p>
            <p className="text-base sm:text-lg font-mono font-bold text-zion-purple truncate">{fmt(m.pplnsWindowUsed)}</p>
            {pplnsPct != null && <MetricBar value={m.pplnsWindowUsed ?? 0} max={m.pplnsWindowSize ?? 1} color="bg-zion-purple" />}
            <p className="text-[10px] text-gray-500">{pplnsPct != null ? (cs ? `${pplnsPct.toFixed(1)} % zaplneno` : `${pplnsPct.toFixed(1)}% full`) : ''}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Registered Miners</p>
            <p className="text-base sm:text-lg font-mono font-bold text-zion-cyan truncate">{fmt(m.pplnsMiners)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Total Paid</p>
            <p className="text-base sm:text-lg font-mono font-bold text-zion-gold truncate">{fmt(m.pplnsPaid)} <span className="text-[10px] text-gray-500">ZION</span></p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Payout Rounds</p>
            <p className="text-base sm:text-lg font-mono font-bold text-zion-gold truncate">{fmt(m.pplnsRounds)}</p>
          </div>
        </div>
      </div>

      {/* ── Server Infrastructure ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><HardDrive className="h-4 w-4 text-zion-cyan" /> Network Infrastructure <span className="text-[10px] text-gray-500 font-normal">ZION network</span></h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="zion-tile p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 flex items-center gap-1"><Flame className="h-3 w-3" /> {MissionControlDashboardCopy.cpuLoad[cs ? 'cs' : 'en']}</p>
            <p className="text-lg font-mono font-bold text-zion-cyan">{m.serverLoad1?.toFixed(1) ?? '—'}</p>
            <p className="text-[10px] text-gray-500">{m.serverLoad5?.toFixed(1) ?? '—'} / {m.serverLoad15?.toFixed(1) ?? '—'} (5m/15m)</p>
          </div>
          <div className="zion-tile p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">{MissionControlDashboardCopy.memory[cs ? 'cs' : 'en']}</p>
            <p className={`text-lg font-mono font-bold ${memPct != null && memPct > 85 ? 'text-zion-purple' : 'text-zion-purple'}`}>{memPct != null ? `${memPct.toFixed(1)}%` : '—'}</p>
            {m.memTotal && m.memAvail && <MetricBar value={m.memTotal - m.memAvail} max={m.memTotal} color={memPct != null && memPct > 85 ? 'bg-zion-purple' : 'bg-zion-purple'} />}
            <p className="text-[10px] text-gray-500">{cs ? `${fmtBytes(m.memAvail)} volne / ${fmtBytes(m.memTotal)}` : `${fmtBytes(m.memAvail)} free / ${fmtBytes(m.memTotal)}`}</p>
          </div>
          <div className="zion-tile p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">Disk</p>
            <p className={`text-lg font-mono font-bold ${diskPct != null && diskPct > 85 ? 'text-zion-purple' : 'text-zion-gold'}`}>{diskPct != null ? `${diskPct.toFixed(1)}%` : '—'}</p>
            {m.diskTotal && m.diskAvail && <MetricBar value={m.diskTotal - m.diskAvail} max={m.diskTotal} color={diskPct != null && diskPct > 85 ? 'bg-zion-purple' : 'bg-zion-gold'} />}
            <p className="text-[10px] text-gray-500">{cs ? `${fmtBytes(m.diskAvail)} volne / ${fmtBytes(m.diskTotal)}` : `${fmtBytes(m.diskAvail)} free / ${fmtBytes(m.diskTotal)}`}</p>
          </div>
          <div className="zion-tile p-3">
            <p className="text-[9px] uppercase tracking-wider text-gray-400">{MissionControlDashboardCopy.serverUptime[cs ? 'cs' : 'en']}</p>
            <p className="text-lg font-mono font-bold text-zion-cyan">{fmtUptime(uptime)}</p>
            <p className="text-[10px] text-gray-500">{MissionControlDashboardCopy.since[cs ? 'cs' : 'en']} {m.bootTime ? new Date(m.bootTime * 1000).toLocaleDateString(locale) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-gray-500 pt-2 border-t border-white/10">
        <span>{MissionControlDashboardCopy.k30LivePrometheusMetrics[cs ? 'cs' : 'en']}</span>
        <span>{MissionControlDashboardCopy.instantRangeQueries[cs ? 'cs' : 'en']}</span>
        <span>{MissionControlDashboardCopy.k15sAutoRefresh[cs ? 'cs' : 'en']}</span>
        <span>{MissionControlDashboardCopy.svgSparklines1h[cs ? 'cs' : 'en']}</span>
        <a href="/monitoring" className="text-zion-cyan hover:text-zion-cyan transition-colors">{MissionControlDashboardCopy.fullMonitoringPage[cs ? 'cs' : 'en']}</a>
        <a href="/grafana/" target="_blank" rel="noopener noreferrer" className="text-zion-cyan hover:text-zion-cyan transition-colors">{MissionControlDashboardCopy.openGrafana[cs ? 'cs' : 'en']}</a>
      </div>
    </motion.section>
  );
}

function WalletDiagnosticsSection({
  diagnostics,
  loading,
  error,
  addressInput,
  queriedAddress,
  onAddressChange,
  onLoad,
  txMethod,
  txPayload,
  txSubmitting,
  txResult,
  txError,
  onMethodChange,
  onPayloadChange,
  onSubmit,
}: {
  diagnostics: WalletDiagnosticsData | null;
  loading: boolean;
  error: string | null;
  addressInput: string;
  queriedAddress: string;
  onAddressChange: (value: string) => void;
  onLoad: () => void;
  txMethod: WalletSubmitMethod;
  txPayload: string;
  txSubmitting: boolean;
  txResult: WalletBroadcastResult | null;
  txError: string | null;
  onMethodChange: (value: WalletSubmitMethod) => void;
  onPayloadChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const rpc = diagnostics?.rpc;
  const wallet = diagnostics?.wallet;
  const miner = diagnostics?.miner;
  const broadcastMethods = diagnostics?.rpc.submit_methods?.length
    ? diagnostics.rpc.submit_methods
    : ['submitTransaction', 'submitAccountTransaction', 'sendRawTransaction'];
  const activeAddress = wallet?.address ?? queriedAddress;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14 }}
      className="zion-rainbow-card p-4 sm:p-6 lg:p-8 space-y-6"
      style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Wallet & RPC</p>
          <span className="text-[10px] uppercase tracking-widest border border-zion-cyan/40 bg-zion-cyan/10 text-zion-cyan px-2 py-0.5 rounded-full font-semibold">{MissionControlDashboardCopy.signedTxOnly[cs ? 'cs' : 'en']}</span>
        </div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
          <Wallet className="h-7 w-7 text-zion-cyan" />
          {MissionControlDashboardCopy.walletDiagnosticsTransactionSu[cs ? 'cs' : 'en']}
        </h2>
        <p className="text-sm text-gray-400">{MissionControlDashboardCopy.liveRpcHealthBalanceUtxoSnapsh[cs ? 'cs' : 'en']}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <Stat label="RPC" value={rpc?.connected ? 'ONLINE' : 'OFFLINE'} color={rpc?.connected ? 'text-zion-cyan' : 'text-zion-purple'} />
        <Stat label={MissionControlDashboardCopy.chainHeight[cs ? 'cs' : 'en']} value={fmt(rpc?.chain_height)} color="text-zion-cyan" mono />
        <Stat label="Peers" value={fmt(rpc?.peers)} color="text-zion-cyan" mono />
        <Stat label="Mempool" value={fmt(rpc?.mempool_size)} color="text-zion-purple" mono />
        <Stat label={MissionControlDashboardCopy.network[cs ? 'cs' : 'en']} value={rpc?.network?.toUpperCase() ?? '—'} color="text-zion-gold" />
        <Stat label={MissionControlDashboardCopy.rpcVersion[cs ? 'cs' : 'en']} value={rpc?.version ?? '—'} color="text-gray-200" mono />
      </div>

      <div className="zion-rainbow-sub p-4 sm:p-5 space-y-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-2">{MissionControlDashboardCopy.walletAddressOrAccount[cs ? 'cs' : 'en']}</label>
            <input
              value={addressInput}
              onChange={(event) => onAddressChange(event.target.value)}
              placeholder="zion1... nebo wallet.alpha"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-cyan/40"
            />
          </div>
          <button
            onClick={onLoad}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-3 text-sm font-semibold text-zion-cyan transition-colors hover:border-zion-cyan/50 hover:text-cyan-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? (MissionControlDashboardCopy.loading[cs ? 'cs' : 'en']) : (MissionControlDashboardCopy.loadWallet[cs ? 'cs' : 'en'])}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-zion-purple/30 bg-zion-purple/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniMetric label={MissionControlDashboardCopy.address[cs ? 'cs' : 'en']} value={activeAddress || (MissionControlDashboardCopy.notLoaded[cs ? 'cs' : 'en'])} color="text-zion-cyan" />
          <MiniMetric label="TX Model" value={wallet?.transaction_model ?? 'rpc-only'} color="text-zion-gold" />
          <MiniMetric label="Balance" value={wallet ? fmtZion(wallet.balance_zion) : '—'} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.utxoCount[cs ? 'cs' : 'en']} value={wallet ? fmt(wallet.utxo_count) : '—'} color="text-zion-purple" />
          <MiniMetric label={MissionControlDashboardCopy.utxoTotal[cs ? 'cs' : 'en']} value={wallet ? fmtZion(wallet.total_utxo_zion) : '—'} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.minerPending[cs ? 'cs' : 'en']} value={miner ? fmtZion(miner.pending_balance_zion) : '—'} color="text-zion-gold" />
          <MiniMetric label={MissionControlDashboardCopy.minerPaid[cs ? 'cs' : 'en']} value={miner ? fmtZion(miner.paid_balance_zion) : '—'} color="text-zion-cyan" />
          <MiniMetric label={MissionControlDashboardCopy.minerShares[cs ? 'cs' : 'en']} value={miner ? `${fmt(miner.accepted_shares)} / ${fmt(miner.rejected_shares)}` : '—'} color="text-gray-200" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="zion-section p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-[0.25em] text-gray-500">{MissionControlDashboardCopy.recentUtxos[cs ? 'cs' : 'en']}</div>
              <div className="text-[10px] text-gray-500">{MissionControlDashboardCopy.top20FromRpc[cs ? 'cs' : 'en']}</div>
            </div>
            {wallet?.utxos?.length ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {wallet.utxos.slice(0, 6).map((utxo) => (
                  <div key={`${utxo.tx_hash}_${utxo.output_index}`} className="zion-tile p-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-zion-cyan truncate">{utxo.tx_hash.slice(0, 12)}…:{utxo.output_index}</span>
                      <span className="font-mono text-zion-cyan">{fmtZion(utxo.amount / 1_000_000)}</span>
                    </div>
                    <div className="mt-1 text-gray-500">{MissionControlDashboardCopy.height_2[cs ? 'cs' : 'en']} {fmt(utxo.height)} · {utxo.address}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">{activeAddress ? (MissionControlDashboardCopy.noUtxosReturnedForThisAddress[cs ? 'cs' : 'en']) : (MissionControlDashboardCopy.loadAZion1AddressToInspectUtxo[cs ? 'cs' : 'en'])}</div>
            )}
          </div>

          <div className="zion-section p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-[0.25em] text-gray-500">{MissionControlDashboardCopy.rpcSubmitTester[cs ? 'cs' : 'en']}</div>
              <div className="text-[10px] text-gray-500">{MissionControlDashboardCopy.signedPayloadOnly[cs ? 'cs' : 'en']}</div>
            </div>
            <div className="space-y-3">
              <select
                value={txMethod}
                onChange={(event) => onMethodChange(event.target.value as WalletSubmitMethod)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zion-cyan/40"
              >
                {broadcastMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <textarea
                value={txPayload}
                onChange={(event) => onPayloadChange(event.target.value)}
                placeholder={'{\n  "version": 1,\n  "inputs": [],\n  "outputs": [],\n  "signature": "..."\n}'}
                className="min-h-[220px] w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-cyan/40 font-mono"
              />
              <button
                onClick={onSubmit}
                disabled={txSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-3 text-sm font-semibold text-zion-cyan transition-colors hover:border-zion-cyan/50 hover:text-emerald-200 disabled:opacity-50"
              >
                <ArrowLeftRight className={`h-4 w-4 ${txSubmitting ? 'animate-pulse' : ''}`} />
                {txSubmitting ? (MissionControlDashboardCopy.submitting[cs ? 'cs' : 'en']) : (MissionControlDashboardCopy.broadcastSignedTx[cs ? 'cs' : 'en'])}
              </button>
              {txResult && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${txResult.accepted ? 'border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200' : 'border-zion-gold/30 bg-zion-gold/10 text-amber-200'}`}>
                  <div>{MissionControlDashboardCopy.method[cs ? 'cs' : 'en']}: {txResult.method}</div>
                  <div>{MissionControlDashboardCopy.accepted_2[cs ? 'cs' : 'en']}: {txResult.accepted ? (MissionControlDashboardCopy.yes[cs ? 'cs' : 'en']) : (MissionControlDashboardCopy.no[cs ? 'cs' : 'en'])}</div>
                  <div>tx_id: {txResult.tx_id ?? '—'}</div>
                </div>
              )}
              {txError && (
                <div className="rounded-xl border border-zion-purple/30 bg-zion-purple/10 px-4 py-3 text-sm text-red-200">
                  {txError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function PoolSection({ primary }: { primary?: PoolData }) {
  const hm = primary?.miners ?? {};
  const hhr = primary?.hashrate ?? {};
  const hsh = primary?.shares ?? {};
  const hbl = primary?.blocks ?? {};

  const totalActive = hm.active ?? 0;
  const totalMiners = hm.total ?? 0;
  const totalHR = hhr.pool ?? 0;
  const totalHR24 = hhr.pool_24h ?? 0;
  const validShares = hsh.valid ?? 0;
  const invalidShares = hsh.invalid ?? 0;
  const blocksFound = hbl.found ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
      style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
    >
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Mining</p>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
          <Pickaxe className="h-7 w-7 text-zion-purple" />
          Mining Pool — Primary Host
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Active Miners" value={String(totalActive)} sub={`total: ${totalMiners}`} color="text-zion-purple" mono />
        <Stat label="Pool Hashrate" value={fmtHash(totalHR)} sub={`24h avg: ${fmtHash(totalHR24)}`} color="text-zion-cyan" mono />
        <Stat label="Valid Shares" value={fmt(validShares)} sub={`invalid: ${invalidShares}`} color="text-zion-cyan" mono />
        <Stat label="Blocks Found" value={String(blocksFound)} color="text-zion-gold" mono />
      </div>
      <div className="grid md:grid-cols-1 gap-4 sm:gap-5 max-w-md">
        <PoolNodeCard name="Primary Pool" flag="🖥️" pool={primary} />
      </div>
    </motion.section>
  );
}

function PoolNodeCard({ name, flag, pool }: { name: string; flag: string; pool?: PoolData }) {
  if (!pool?.ok && !pool?.miners) return (
    <div className="zion-rainbow-sub p-3 sm:p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-3"><span>{flag}</span><span className="font-semibold text-sm text-white">{name}</span><span className="ml-auto inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-red-200 border border-zion-purple/30 bg-zion-purple/10 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-widest"><XCircle className="h-3 w-3" /> Offline</span></div>
    </div>
  );
  const m = pool.miners ?? {};
  const hr = pool.hashrate ?? {};
  const sh = pool.shares ?? {};
  const p = pool.pool ?? {};
  return (
    <div className="zion-rainbow-sub p-3 sm:p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
        <span className="text-lg sm:text-xl">{flag}</span><span className="font-semibold text-sm sm:text-base text-white">{name}</span>
        <span className={`ml-auto inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold border rounded-full px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-widest ${pool.blockchain?.connected ? 'text-emerald-200 bg-zion-cyan/10 border-zion-cyan/30' : 'text-red-200 bg-zion-purple/10 border-zion-purple/30'}`}>
          {pool.blockchain?.connected ? (m.active ?? 0) > 0 ? <><CircleDot className="h-3 w-3" /> Active</> : <><CircleDot className="h-3 w-3" /> Idle</> : <><XCircle className="h-3 w-3" /> Disconnected</>}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <MiniMetric label="Active / Total" value={`${m.active ?? 0} / ${m.total ?? 0}`} />
        <MiniMetric label="Hashrate" value={fmtHash(hr.pool)} color="text-zion-cyan" />
        <MiniMetric label="Valid / Invalid" value={`${fmt(sh.valid)} / ${sh.invalid ?? 0}`} />
        <MiniMetric label="PPLNS Window" value={String(pool.pplns_window_size ?? '—')} />
        <MiniMetric label="Pool Fee" value={`${p.fee ?? 0}%`} />
        <MiniMetric label="Uptime" value={fmtUptime(p.uptime_secs)} />
      </div>
    </div>
  );
}

/* ═══════════════════════ PHASE COMPONENT ═══════════════════════ */
function PhaseAccordion({ icon, title, pct, status, statusColor, children, defaultOpen }: { icon: React.ReactNode; title: string; pct: number; status: string; statusColor: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const pctColor = pct >= 100 ? 'text-zion-cyan' : pct > 0 ? 'text-zion-cyan' : 'text-gray-500';
  const barCls = pct >= 100 ? 'bg-zion-cyan' : pct > 0 ? 'bg-linear-to-r from-zion-cyan via-zion-purple to-zion-purple' : 'bg-gray-700';
  return (
    <div className="zion-section overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 p-4 sm:p-6 hover:bg-white/5 transition-colors text-left">
        <span className="shrink-0">{icon}</span>
        <span className="font-semibold text-sm sm:text-lg text-white flex-1 min-w-0 truncate sm:whitespace-normal sm:overflow-visible">{title}</span>
        <div className="hidden sm:block w-28 h-2 rounded-full bg-white/10 overflow-hidden shrink-0">
          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs sm:text-sm font-mono font-semibold ${pctColor} shrink-0`}>{pct}%</span>
        <span className={`text-[10px] sm:text-xs rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-widest ${statusColor} shrink-0`}>{status}</span>
        <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-white/5 overflow-x-auto">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SprintRow({ name, content, tests, status, highlight }: { name: string; content: string; tests?: string; status: React.ReactNode; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-zion-cyan/5' : ''}>
      <td className={`py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-l-lg whitespace-nowrap ${highlight ? 'text-zion-cyan' : 'text-white'}`}>{name}</td>
      <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-400">{content}</td>
      {tests !== undefined && <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-mono text-zion-cyan">{tests}</td>}
      <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm rounded-r-lg">{status}</td>
    </tr>
  );
}

/* ═══════════════════════ LOG CONSOLE ═══════════════════════ */
function LogConsole({ logTail }: { logTail?: string }) {
  if (!logTail) return <div className="text-gray-500 text-center py-8 text-sm">No log data</div>;
  const lines = logTail.split('\\n').filter(l => l.trim());
  return (
    <div className="zion-section p-3 sm:p-4 max-h-64 overflow-y-auto overflow-x-auto font-mono text-[10px] sm:text-[11px] leading-relaxed text-gray-500 whitespace-pre">
      {lines.map((line, i) => (
        <div key={i} className={line.includes('[') && !line.includes('| OK') ? 'text-zion-purple font-semibold' : line.includes('OK') ? '' : ''}>
          {line.includes('OK') ? <>{line.replace('OK', '')}<span className="text-zion-cyan">OK</span></> : line}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function MissionControlDashboard() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = MissionControlDashboardCopy.enUs[cs ? 'cs' : 'en'];
  const tabs = getTabs(cs);
  const serviceGroups = getServiceGroups(cs);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [v3, setV3] = useState<V3Metrics | null>(null);
  const [v3Sparks, setV3Sparks] = useState<V3Sparklines | null>(null);
  const [v3Charts, setV3Charts] = useState<V3Charts | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [stackSummary, setStackSummary] = useState<StackSummary | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('6h');
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>('all');
  const [selectedService, setSelectedService] = useState<ServiceStatus | null>(null);
  const [walletAddressInput, setWalletAddressInput] = useState('');
  const [walletQueryAddress, setWalletQueryAddress] = useState('');
  const [walletDiagnostics, setWalletDiagnostics] = useState<WalletDiagnosticsData | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletTxMethod, setWalletTxMethod] = useState<WalletSubmitMethod>('submitTransaction');
  const [walletTxPayload, setWalletTxPayload] = useState('');
  const [walletTxSubmitting, setWalletTxSubmitting] = useState(false);
  const [walletTxResult, setWalletTxResult] = useState<WalletBroadcastResult | null>(null);
  const [walletTxError, setWalletTxError] = useState<string | null>(null);
  const [g8, setG8] = useState<G8Run | null>(null);

  // wZION live price (falls back to seed price $0.0002 when pool not seeded)
  const [wZIONPriceUsd, setWZIONPriceUsd] = useState<number | null>(null);
  const [wZIONPriceSource, setWZIONPriceSource] = useState<'live' | 'seed'>('seed');

  useEffect(() => {
    let cancelled = false;
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/defi/price');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.ok) {
          const usd = data.price?.usd_per_wzion ?? 0;
          setWZIONPriceUsd(usd > 0 ? usd : SEED_PRICE_USD);
          setWZIONPriceSource(data.source === 'live' && usd > 0 ? 'live' : 'seed');
        }
      } catch { /* keep seed default */ }
    };
    void fetchPrice();
    const iv = setInterval(fetchPrice, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const loadWalletDiagnostics = useCallback(async (address?: string) => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const trimmed = address?.trim() ?? '';
      const next = await fetchWalletDiagnostics(trimmed || undefined);
      setWalletDiagnostics(next);
      setWalletQueryAddress(trimmed);
    } catch (error) {
      setWalletDiagnostics(null);
      setWalletError(error instanceof Error ? error.message : 'Wallet diagnostics failed');
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const handleWalletLoad = useCallback(async () => {
    await loadWalletDiagnostics(walletAddressInput);
  }, [loadWalletDiagnostics, walletAddressInput]);

  const handleWalletSubmit = useCallback(async () => {
    setWalletTxSubmitting(true);
    setWalletTxError(null);
    setWalletTxResult(null);
    try {
      const trimmed = walletTxPayload.trim();
      if (!trimmed) {
        throw new Error('Paste a signed transaction JSON payload first.');
      }
      const parsed: unknown = JSON.parse(trimmed);
      const result = await submitWalletBroadcast(walletTxMethod, parsed);
      setWalletTxResult(result);
    } catch (error) {
      setWalletTxError(error instanceof Error ? error.message : 'Transaction submit failed');
    } finally {
      setWalletTxSubmitting(false);
    }
  }, [walletTxMethod, walletTxPayload]);

  useEffect(() => {
    void loadWalletDiagnostics();
  }, [loadWalletDiagnostics]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/mission-data/data', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const fetchG8 = useCallback(async () => {
    try {
      const res = await fetch('/api/g8', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setG8(await res.json());
      }
    } catch { /* silent */ }
  }, []);

  usePolling(fetchG8, 30_000);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mission-data/data?t=${Date.now()}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setData(d);
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();
    // One Love Prometheus metrics
    const refreshV3 = async () => {
      try {
        const [metrics, sparks] = await Promise.all([fetchV3Metrics(), fetchV3Sparklines()]);
        setV3(metrics);
        setV3Sparks(sparks);
      } catch { /* silent */ }
    };
    const refreshCharts = async () => {
      try {
        const [charts, svc, summary] = await Promise.all([fetchV3Charts(chartRange), fetchServiceStatuses(), fetchStackSummary()]);
        setV3Charts(charts);
        setServices(svc);
        setStackSummary(summary);
      } catch { /* silent */ }
    };
    refreshV3();
    refreshCharts();
    const iv = setInterval(refresh, 30_000);
    const iv2 = setInterval(refreshV3, 15_000);
    const iv3 = setInterval(refreshCharts, 60_000);
    const clock = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(iv2); clearInterval(iv3); clearInterval(clock); };
  }, [refresh, chartRange]);

  const stabilityRun = data?.mainnet_stability_run ?? data?.launch_rehearsal ?? data?.stability_run;
  const readinessMap = data?.readiness_map;
  const environment = data?.environment;
  const primaryNode = data?.primary ?? data?.helsinki;
  const internalSeedContainers = getInternalSeedContainers(data);
  const primaryStats = primaryNode?.stats;
  const primaryHeight = primaryStats?.height ?? 0;
  const isNodeOnline = (n?: ServerNode) => {
    const s = n?.stats?.status;
    return s === 'OK' || s === 'ok' || s === 'healthy';
  };
  const onlineCount = [primaryNode, data?.usa, data?.singapore].filter(isNodeOnline).length;
  const allHealthy = onlineCount === 3;
  const anyHealthy = onlineCount > 0;
  const launchGate = environment?.public_launch_status ?? stabilityRun?.public_launch_gate ?? 'NO-GO';
  const missingCount = readinessMap?.missing?.length ?? 0;
  const rehearsalStatus = stabilityRun?.status ?? 'SCHEDULED';
  const stabilityStatus = rehearsalStatus;
  const stabilityStatusColor = stabilityStatus === 'PASS'
    ? 'text-zion-cyan'
    : stabilityStatus === 'RUNNING'
    ? 'text-zion-cyan'
    : stabilityStatus === 'DEGRADED' || stabilityStatus === 'REVIEW REQUIRED'
    ? 'text-zion-gold'
    : stabilityStatus === 'ISSUE'
    ? 'text-zion-purple'
    : 'text-gray-300';
  const tipAgreement = stabilityRun?.agreement?.tip_agreement ?? false;
  const heightSpread = stabilityRun?.agreement?.height_spread;
  const samplesCollected = stabilityRun?.collector?.samples_collected ?? 0;
  const collectorIssues = stabilityRun?.collector?.issue_count ?? 0;
  const collectorEnabled = stabilityRun?.collector?.enabled ?? false;
  const lastSampleAt = stabilityRun?.collector?.last_sample_at
    ? new Date(stabilityRun.collector.last_sample_at).toLocaleString()
    : 'No persisted samples yet';
  const poolAcceptRate = stabilityRun?.pool?.accept_rate_pct;
  const visibleServices = (serviceGroup === 'all' ? services : services.filter(service => getServiceGroup(service) === serviceGroup))
    .slice()
    .sort((left, right) => {
      const rank = getServiceSortRank(left) - getServiceSortRank(right);
      return rank !== 0 ? rank : left.name.localeCompare(right.name);
    });
  const monitoredServices = services.filter(service => service.up !== null);
  const servicesUp = monitoredServices.filter(service => service.up).length;
  const servicesDown = monitoredServices.filter(service => service.up === false).length;
  const servicesNa = services.filter(service => service.up === null).length;
  const primaryNodeWithMetrics: ServerNode | undefined = (() => {
    if (!primaryNode) return undefined;
    const memTotal = v3?.memTotal ?? null;
    const memAvail = v3?.memAvail ?? null;
    const diskTotal = v3?.diskTotal ?? null;
    const diskAvail = v3?.diskAvail ?? null;
    const fallbackMem =
      memTotal != null && memAvail != null && memTotal > 0
        ? { total: memTotal, used: Math.max(0, memTotal - memAvail) }
        : undefined;
    const fallbackDisk =
      diskTotal != null && diskAvail != null && diskTotal > 0
        ? { used_pct: Math.max(0, Math.min(100, ((diskTotal - diskAvail) / diskTotal) * 100)) }
        : undefined;
    const fallbackContainers = monitoredServices.length > 0
      ? { containers_up: servicesUp, containers_healthy: monitoredServices.length }
      : {};

    return {
      ...primaryNode,
      mem: primaryNode.mem ?? fallbackMem,
      disk: primaryNode.disk ?? fallbackDisk,
      load: primaryNode.load ?? v3?.serverLoad1 ?? undefined,
      containers_up: primaryNode.containers_up ?? fallbackContainers.containers_up,
      containers_healthy: primaryNode.containers_healthy ?? fallbackContainers.containers_healthy,
    };
  })();
  const opsAlertsRaw: Array<OpsAlert | null> = [
    servicesDown > 0 ? { id: 'targets-down', message: `${servicesDown} target${servicesDown > 1 ? 's' : ''} down`, severity: 'critical', href: '/monitoring' } : null,
    stackSummary?.prometheusReloadOk === 0 ? { id: 'prometheus-reload', message: 'Prometheus reload failed', severity: 'critical', href: '/grafana/' } : null,
    stackSummary?.prometheusQueueLength != null && stackSummary.prometheusQueueLength > 0 ? { id: 'alert-queue', message: `Alert queue ${fmt(stackSummary.prometheusQueueLength)}`, severity: stackSummary.prometheusQueueLength > 10 ? 'critical' : 'warn', href: '/grafana/' } : null,
    stackSummary?.redisUp === 0 ? { id: 'redis-unhealthy', message: 'Redis exporter path unhealthy', severity: 'warn', href: '/monitoring' } : null,
    servicesNa > 0 ? { id: 'na-services', message: `${servicesNa} service${servicesNa > 1 ? 's' : ''} without scrape`, severity: 'info', href: '/monitoring' } : null,
  ];
  const opsAlerts = opsAlertsRaw.filter((value): value is OpsAlert => value !== null);
  const effectiveReadinessMap = readinessMap ?? getFallbackReadinessMap(cs);
  const readinessPanels = [
    {
      key: 'done',
      title: MissionControlDashboardCopy.done[cs ? 'cs' : 'en'],
      badge: 'READY NOW',
      Icon: CheckCheck,
      cardClass: 'border-zion-cyan/20 bg-zion-cyan/5',
      badgeClass: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
      iconClass: 'text-zion-cyan',
      items: effectiveReadinessMap.done ?? [],
    },
    {
      key: 'missing',
      title: MissionControlDashboardCopy.missingBeforePublicLaunch[cs ? 'cs' : 'en'],
      badge: 'BLOCKERS',
      Icon: XCircle,
      cardClass: 'border-zion-purple/20 bg-zion-purple/5',
      badgeClass: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
      iconClass: 'text-zion-purple',
      items: effectiveReadinessMap.missing ?? [],
    },
    {
      key: 'not-missing',
      title: MissionControlDashboardCopy.noLongerMissing[cs ? 'cs' : 'en'],
      badge: 'CLARIFIED',
      Icon: CircleDot,
      cardClass: 'border-zion-cyan/20 bg-zion-cyan/5',
      badgeClass: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
      iconClass: 'text-zion-cyan',
      items: effectiveReadinessMap.not_missing ?? [],
    },
    {
      key: 'next-48h',
      title: MissionControlDashboardCopy.next4872h[cs ? 'cs' : 'en'],
      badge: 'REHEARSAL',
      Icon: Construction,
      cardClass: 'border-zion-gold/20 bg-zion-gold/5',
      badgeClass: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
      iconClass: 'text-zion-gold',
      items: effectiveReadinessMap.next_48h ?? [],
    },
  ];

  return (
    <div className="zion-shell min-h-screen pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-6 sm:space-y-8 lg:space-y-10">

        {/* ══════════════ HERO SECTION ══════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-5 sm:p-8 lg:p-10"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <Activity className="h-4 w-4" />
                MAINNET · LIVE · ALPHA
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{MissionControlDashboardCopy.liveTelemetry[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-gradient leading-tight">
                  {MissionControlDashboardCopy.missionControl[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Živé monitorování One Love Mainnetu. Dashboard sleduje veřejný pool a konsenzus uzel — live chain metriky, pool hashrate a síťový stav.'
                  : 'Real-time monitoring of One Love Mainnet. The dashboard tracks the public pool and consensus node — live chain metrics, pool hashrate and network status.'
                }
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" /> {MissionControlDashboardCopy.liveData30sRefresh[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Mainnet Alpha · Live
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-cyan-200">
                  <Sparkles className="h-3 w-3" /> Network · public pool + consensus
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-emerald-200">
                  <Rocket className="h-3 w-3" /> Mainnet launch countdown T-{Math.max(0, Math.ceil((new Date('2026-12-31T00:00:00Z').getTime() - Date.now()) / 86400000))} days
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Shield className="h-3 w-3 text-zion-cyan" /> {allHealthy ? (MissionControlDashboardCopy.allSystemsHealthy[cs ? 'cs' : 'en']) : anyHealthy ? (MissionControlDashboardCopy.partialSystemsUp[cs ? 'cs' : 'en']) : (MissionControlDashboardCopy.systemsMonitoring[cs ? 'cs' : 'en'])}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-3 grid-cols-2 lg:w-auto lg:min-w-[340px]">
              {[
                { label: 'Block Height', value: fmt(primaryHeight), descriptor: 'live mainnet chain tip' },
                { label: 'Pool Hashrate', value: fmtHash(v3?.minerHashrate ?? primaryNode?.pool?.hashrate?.pool ?? null), descriptor: 'current mining hashrate' },
                { label: 'Network Peers', value: fmt(primaryStats?.peers_connected ?? 0), descriptor: 'public node peers' },
                { label: 'Mainnet Status', value: 'TBD', descriptor: 'target 31 December 2026' },
              ].map((chip) => (
                <div key={chip.label} className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
              {/* wZION price chip — always visible, shows seed price until pool is seeded */}
              <div className="col-span-2 zion-rainbow-sub px-5 py-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-xs uppercase tracking-[0.3em] text-zion-gold/70">wZION Price</p>
                <div className="flex items-baseline gap-3 mt-2">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white font-mono">
                    ${(wZIONPriceUsd ?? SEED_PRICE_USD).toFixed(5)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                    wZIONPriceSource === 'live'
                      ? 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan'
                      : 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold'
                  }`}>
                    {wZIONPriceSource === 'live' ? 'LIVE' : 'SEED'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {wZIONPriceSource === 'live' ? 'Uniswap V3 wZION/USDT · Base' : 'Seed price · $0.0002 / ZION · FDV ~$28.8M'}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ══════════════ TAB NAVIGATION ══════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="zion-section p-2"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Zap className="h-4 w-4 text-zion-cyan mx-2 sm:mx-3 shrink-0" />
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-zion-cyan bg-zion-cyan/10 border border-zion-cyan/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}
              >
                <span className="inline-flex items-center gap-1.5"><tab.icon className="h-3.5 w-3.5 shrink-0" /><span className="text-[10px] sm:text-xs">{tab.label}</span></span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-zion-cyan whitespace-nowrap pr-2 sm:pr-3">
              <span className="w-2 h-2 rounded-full bg-zion-cyan animate-pulse" />
              <span className="hidden sm:inline">{MissionControlDashboardCopy.live[cs ? 'cs' : 'en']}</span>
            </div>
          </div>
        </motion.div>

        {/* ══════════════ LOADING ══════════════ */}
        {loading && !data && (
          <div className="text-center py-20 text-gray-500">
            <div className="inline-block w-8 h-8 border-2 border-zion-cyan border-t-transparent rounded-full animate-spin mb-4" />
            <p>{MissionControlDashboardCopy.loadingMissionControlData[cs ? 'cs' : 'en']}</p>
          </div>
        )}

        {/* ══════════════ API OFFLINE FALLBACK ══════════════ */}
        {!loading && !data && (
          <div className="text-center py-16 text-gray-500 zion-section border-zion-gold/20 bg-zion-gold/5">
            <Radio className="h-8 w-8 text-zion-gold mx-auto mb-3" />
            <p className="text-zion-gold font-semibold">{MissionControlDashboardCopy.liveTelemetryUnavailable[cs ? 'cs' : 'en']}</p>
            <p className="text-sm mt-1">{MissionControlDashboardCopy.nodeApiTemporarilyUnreachableR[cs ? 'cs' : 'en']}</p>
            <button onClick={refresh} className="mt-4 px-4 py-2 text-xs rounded-xl border border-zion-gold/30 text-zion-gold hover:bg-zion-gold/10 transition-colors">{MissionControlDashboardCopy.retry[cs ? 'cs' : 'en']}</button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 1: DASHBOARD
           ═══════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && data && (
          <div className="space-y-8">
            {/* Mainnet Live Status */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">One Love Mainnet</p>
                  <span className="text-[10px] uppercase tracking-widest border border-zion-cyan/40 bg-zion-cyan/10 text-zion-cyan px-2 py-0.5 rounded-full font-semibold">
                    LIVE · ALPHA
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Gauge className="h-7 w-7 text-zion-cyan" />
                  One Love Mainnet — Live Status
                </h2>
                <p className="text-sm text-gray-400">
                  {cs
                    ? 'Síťová topologie aktivní. Mainnet Alpha live, G8 30denní kontinuální běh aktivní, genesis artefakty potvrzeny. Veřejný mainnet launch countdown aktivní.'
                    : 'Network topology active. Mainnet Alpha live, G8 30-day continuous run active, genesis artifacts confirmed. Public mainnet launch countdown active.'
                  }
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                <Stat label="Chain Height" value={fmt(primaryHeight)} color="text-zion-cyan" mono />
                <Stat label="Online Nodes" value={`${onlineCount}/2`} color={anyHealthy ? 'text-zion-cyan' : 'text-zion-gold'} mono />
                <Stat label="Tip Agreement" value={tipAgreement ? 'LOCKED' : (anyHealthy ? 'SYNCING' : '—')} color={tipAgreement ? 'text-zion-cyan' : 'text-zion-gold'} />
                <Stat label="Pool Accept" value={poolAcceptRate != null ? `${poolAcceptRate}%` : (primaryNode?.pool?.ok ? '100%' : '—')} color={(poolAcceptRate ?? 100) >= 95 ? 'text-zion-cyan' : 'text-zion-gold'} mono />
                <Stat label="Security Gate" value="TBD" color="text-zion-gold" sub="audit pending" />
                <Stat label="Launch Gate" value="TBD" color="text-zion-gold" sub="31 December 2026" />
              </div>
              <div className="mt-4">
                <G8RunCard run={g8} />
              </div>
              <div className="mt-4 zion-tile px-5 py-4 text-sm text-gray-300">
                {cs
                  ? <><span className="font-semibold text-zion-gold">One Love Mainnet</span> — Mainnet Alpha v testování, G8 30denní kontinuální běh aktivní, genesis artefakty potvrzeny. Síťová topologie v testování.</>
                  : <><span className="font-semibold text-zion-gold">One Love Mainnet</span> — Mainnet Alpha in testing, G8 30-day continuous run active, genesis artifacts confirmed. Network topology in testing.</>
                }
              </div>
            </motion.section>

            {/* Network Stats */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Production Runtime</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Globe className="h-7 w-7 text-zion-cyan" />
                  One Love Mainnet — Network
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Stat label="Network" value="One Love Mainnet" color="text-zion-cyan" />
                <Stat label="Total Peers" value={fmt(primaryStats?.peers_connected ?? 0)} sub={`${onlineCount}/2 nodes online`} mono />
                <Stat label="Difficulty" value={fmt(primaryStats?.difficulty)} mono />
                <Stat label="Sync Status" value={(primaryStats?.status === 'OK' || primaryStats?.status === 'healthy') ? 'SYNCED ✓' : primaryHeight > 0 ? 'RUNNING' : '—'} color={(primaryStats?.status === 'OK' || primaryStats?.status === 'healthy') ? 'text-zion-cyan' : 'text-gray-400'} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <ServerCard node={primaryNode} name="Public pool" flag="🌐" ip="Public pool + web + RPC relay" />
                <ServerCard node={data?.primary} name="Consensus node" flag="🏠" ip="Consensus + public RPC" />
              </div>
              <div className="mt-5 zion-tile px-5 py-4 text-sm text-gray-300">
                {cs
                  ? 'Síťová topologie: veřejný uzel pro relay a pool, konsenzus uzel pro primární validaci. P2P spojení přes mainnetovou síť.'
                  : 'Network topology: public relay and pool node, consensus node for primary validation. P2P connections over mainnet mesh.'
                }
              </div>
            </motion.section>

            {/* Mining Pool */}
            <PoolSection primary={primaryNode?.pool} />

            {/* Wallet & RPC */}
            <WalletDiagnosticsSection
              diagnostics={walletDiagnostics}
              loading={walletLoading}
              error={walletError}
              addressInput={walletAddressInput}
              queriedAddress={walletQueryAddress}
              onAddressChange={setWalletAddressInput}
              onLoad={handleWalletLoad}
              txMethod={walletTxMethod}
              txPayload={walletTxPayload}
              txSubmitting={walletTxSubmitting}
              txResult={walletTxResult}
              txError={walletTxError}
              onMethodChange={setWalletTxMethod}
              onPayloadChange={setWalletTxPayload}
              onSubmit={handleWalletSubmit}
            />

            {/* Project Stats */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Build & Gate</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Database className="h-7 w-7 text-zion-cyan" />
                  Launch Snapshot
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label="Workspace" value="V31" sub="Rust monorepo · L1–L6" color="text-zion-cyan" />
                <Stat label="Tests" value="2,100+" sub="workspace passing / 0 failing" color="text-zion-cyan" />
                <Stat label="Launch Mode" value="G8 RUNNING" sub="30-day run · uptime ≥99.9%" color="text-zion-gold" />
                <Stat label="Mainnet Status" value="ALPHA LIVE" sub="public launch target 31 December 2026" color="text-zion-gold" />
              </div>
            </motion.section>

            {/* Launch Readiness — Pre-Launch Blockers */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Launch Gate</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Target className="h-7 w-7 text-zion-gold" />
                  {MissionControlDashboardCopy.launchReadinessPreLaunchBlocke[cs ? 'cs' : 'en']}
                </h2>
                <p className="text-sm text-gray-400">
                  {MissionControlDashboardCopy.currentLaunchGateStatusBasedOn[cs ? 'cs' : 'en']}
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                {readinessPanels.map((panel) => (
                  <div key={panel.key} className="zion-rainbow-sub p-4 sm:p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 mb-4">
                      <panel.Icon className={`h-5 w-5 ${panel.iconClass}`} />
                      <h3 className="font-semibold text-white text-sm">{panel.title}</h3>
                      <span className={`ml-auto text-[10px] uppercase tracking-widest border px-2 py-0.5 rounded-full font-semibold ${panel.badgeClass}`}>
                        {panel.badge}
                      </span>
                    </div>
                    {panel.items.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        {MissionControlDashboardCopy.noItems[cs ? 'cs' : 'en']}
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {panel.items.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300">
                            <span className="font-medium text-white">{item.title}</span>
                            {item.detail && (
                              <span className="text-gray-500 ml-1">— {item.detail}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Component Readiness */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Readiness</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Code2 className="h-7 w-7 text-zion-purple" />
                  Component Readiness
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Komponenta</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">LOC</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Readiness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'V31 core (blockchain)', pct: 100, loc: 'production' },
                      { name: 'Ekam Deeksha v3.2 (PoW)', pct: 100, loc: 'canonical · KAT locked' },
                      { name: 'V31 pool (PPLNS)', pct: 100, loc: 'production' },
                      { name: 'zion-miner v3.2.0', pct: 100, loc: 'public build' },
                      { name: 'V31 multichain (bridge/DEX)', pct: 95, loc: 'E4 round-trip ✅' },
                      { name: 'desktop-agent v3.2.0', pct: 95, loc: 'release workflows' },
                      { name: 'website-v2.9 (Next.js)', pct: 95, loc: 'live' },
                    ].map(c => (
                      <tr key={c.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-white">{c.name}</td>
                        <td className="py-3 px-4 text-gray-300">{c.loc}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 rounded-full bg-white/10">
                              <div
                                className={`h-2 rounded-full ${c.pct >= 85 ? 'bg-zion-cyan' : c.pct >= 70 ? 'bg-zion-gold' : 'bg-zion-purple'}`}
                                style={{ width: `${c.pct}%` }}
                              />
                            </div>
                            <span className="text-gray-300 font-mono">{c.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
            </motion.section>

            {/* Monitoring Log */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Logs</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Activity className="h-7 w-7 text-zion-cyan" />
                  Monitoring Log (primary host)
                </h2>
              </div>
              <LogConsole logTail={data.log_tail} />
            </motion.section>

            {/* Zlatý Kompas */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <a href="/terranova" className="flex flex-col sm:flex-row items-start sm:items-center gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-zion-gold/10 border border-zion-gold/30 flex items-center justify-center shrink-0 group-hover:border-zion-gold/60 transition-colors">
                  <Compass className="h-7 w-7 text-zion-gold" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-white group-hover:text-zion-gold transition-colors">
                    {MissionControlDashboardCopy.goldenCompassSevenDirectionsOf[cs ? 'cs' : 'en']}
                  </h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {MissionControlDashboardCopy.truthfulnessCareDisciplineComm[cs ? 'cs' : 'en']}
                  </p>
                </div>
              </a>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: STACK METRICS
           ═══════════════════════════════════════════════ */}
        {activeTab === 'metrics' && (
          <div className="space-y-8">

            {/* ── TEST METRICS BANNER ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="zion-section border-zion-gold/40 bg-zion-gold/10 p-3 sm:p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-zion-gold shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zion-gold">{cs ? 'Testovací metriky' : 'Test Metrics'}</p>
                <p className="text-xs text-amber-200/70">{cs ? 'Tato data pochází z testovacího provozu. Hodnoty nereprezentují produkční mainnet.' : 'These are test-environment metrics, not production mainnet data.'}</p>
              </div>
            </motion.div>

            {stackSummary && (
              <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="zion-rainbow-card p-4 sm:p-6 lg:p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className="flex flex-col gap-2 mb-5">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Ops Summary</p>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                    <Gauge className="h-6 w-6 text-zion-cyan" />
                    Cluster Snapshot
                  </h2>
                  <p className="text-xs text-gray-500">Local scrape + network target + Redis runtime health</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                  <MiniMetric label="Redis" value={stackSummary.redisUp === 1 ? 'UP' : stackSummary.redisUp === 0 ? 'DOWN' : '—'} color={stackSummary.redisUp === 1 ? 'text-zion-cyan' : 'text-zion-purple'} />
                  <MiniMetric label="Redis Clients" value={fmt(stackSummary.redisClients)} color="text-zion-cyan" />
                  <MiniMetric label="Redis Memory" value={fmtBytes(stackSummary.redisMemoryUsed)} color="text-zion-purple" />
                  <MiniMetric label="Cache Hit Rate" value={stackSummary.redisHitRatio != null ? `${stackSummary.redisHitRatio.toFixed(1)}%` : '—'} color={stackSummary.redisHitRatio != null && stackSummary.redisHitRatio > 90 ? 'text-zion-cyan' : 'text-zion-gold'} />
                  <MiniMetric label="Core Pool" value={stackSummary.corePoolUp === 1 ? 'UP' : stackSummary.corePoolUp === 0 ? 'DOWN' : '—'} color={stackSummary.corePoolUp === 1 ? 'text-zion-cyan' : 'text-zion-purple'} />
                  <MiniMetric label="Core Node" value={stackSummary.coreNodeUp === 1 ? 'UP' : stackSummary.coreNodeUp === 0 ? 'DOWN' : '—'} color={stackSummary.coreNodeUp === 1 ? 'text-zion-cyan' : 'text-zion-purple'} />
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-4">
                  <div className="zion-section p-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="uppercase tracking-[0.25em] text-gray-500">Scrape Coverage</span>
                      <span className="font-mono text-gray-300">{services.filter(s => s.up !== null).filter(s => s.up).length}/{services.filter(s => s.up !== null).length}</span>
                    </div>
                    <MetricBar value={services.filter(s => s.up !== null).filter(s => s.up).length} max={Math.max(services.filter(s => s.up !== null).length, 1)} color="bg-zion-cyan" />
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500">
                      <span>Prometheus: {stackSummary.prometheusUp === 1 ? 'up' : 'down'}</span>
                      <span>Node exporter: {stackSummary.nodeExporterUp === 1 ? 'up' : 'down'}</span>
                      <span>Redis exporter: {stackSummary.redisExporterUp === 1 ? 'up' : 'down'}</span>
                    </div>
                  </div>
                  <div className="zion-section p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Host Kernel</div>
                    <div className="text-sm text-gray-200 font-mono break-all">{stackSummary.hostKernel ?? '—'}</div>
                    <div className="mt-2 text-[10px] text-gray-500">Redis memory cap: {fmtBytes(stackSummary.redisMemoryMax)}</div>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <div className="zion-section p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Prometheus Runtime</div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="Version" value={stackSummary.prometheusVersion ?? '—'} color="text-zion-cyan" />
                      <MiniMetric label="Reload" value={stackSummary.prometheusReloadOk === 1 ? 'OK' : 'ERR'} color={stackSummary.prometheusReloadOk === 1 ? 'text-zion-cyan' : 'text-zion-purple'} />
                      <MiniMetric label="Head Series" value={fmt(stackSummary.prometheusHeadSeries)} color="text-zion-purple" />
                      <MiniMetric label="Head Chunks" value={fmt(stackSummary.prometheusHeadChunks)} color="text-zion-gold" />
                    </div>
                  </div>
                  <div className="zion-section p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Alert Pipeline</div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="Alertmanagers" value={fmt(stackSummary.alertmanagersDiscovered)} color="text-zion-cyan" />
                      <MiniMetric label="Queue Length" value={fmt(stackSummary.prometheusQueueLength)} color="text-zion-cyan" />
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">{cs ? 'Alertmanager není scrape target v tomto stacku, stav se čte přes Prometheus notification pipeline.' : 'Alertmanager is not a scrape target in this stack; status is read via the Prometheus notification pipeline.'}</div>
                  </div>
                  <div className="zion-section p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">Remote Coverage</div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="Core Pool" value={stackSummary.corePoolUp === 1 ? 'UP' : stackSummary.corePoolUp === 0 ? 'DOWN' : '—'} color={stackSummary.corePoolUp === 1 ? 'text-zion-cyan' : 'text-zion-purple'} />
                      <MiniMetric label="Core Node" value={stackSummary.coreNodeUp === 1 ? 'UP' : stackSummary.coreNodeUp === 0 ? 'DOWN' : '—'} color={stackSummary.coreNodeUp === 1 ? 'text-zion-cyan' : 'text-zion-purple'} />
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">{cs ? 'Veřejně scrapeované targety z Edge Promethea.' : 'Publicly scraped targets from Edge Prometheus.'}</div>
                  </div>
                </div>
                {opsAlerts.length > 0 && (
                  <div className="mt-4 zion-section border-zion-gold/30 bg-zion-gold/10 p-4">
                    <div className="flex items-center gap-2 mb-2 text-zion-gold text-xs uppercase tracking-[0.25em] font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Ops Alerts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opsAlerts.map(alert => {
                        const cls = alert.severity === 'critical'
                          ? 'border-zion-purple/30 bg-zion-purple/10 text-red-200'
                          : alert.severity === 'warn'
                          ? 'border-zion-gold/30 bg-zion-gold/10 text-amber-200'
                          : 'border-zion-cyan/30 bg-zion-cyan/10 text-cyan-200';
                        return alert.href ? (
                          <a key={alert.id} href={alert.href} target={alert.href.startsWith('/grafana') ? '_blank' : undefined} rel={alert.href.startsWith('/grafana') ? 'noopener noreferrer' : undefined} className={`rounded-full border px-3 py-1 text-xs transition-colors hover:brightness-110 ${cls}`}>{alert.message}</a>
                        ) : (
                          <span key={alert.id} className={`rounded-full border px-3 py-1 text-xs ${cls}`}>{alert.message}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* ── SERVICE STATUS GRID ── */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="zion-rainbow-card p-4 sm:p-6 lg:p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex flex-col gap-2 mb-5">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Docker Stack</p>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                    <Server className="h-6 w-6 text-zion-cyan" />
                    Ops Panel — public pool + consensus
                  </h2>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-1 text-zion-cyan font-semibold uppercase tracking-widest">{servicesUp} up</span>
                    <span className="rounded-full border border-zion-purple/30 bg-zion-purple/10 px-3 py-1 text-zion-purple font-semibold uppercase tracking-widest">{servicesDown} down</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300 font-semibold uppercase tracking-widest">{servicesNa} n/a</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{services.length} services/targets · zion-net Docker network · Prometheus scrape 15s</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {serviceGroups.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setServiceGroup(option.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${serviceGroup === option.value ? 'border-zion-cyan/40 bg-zion-cyan/10 text-zion-cyan' : 'border-white/10 bg-white/5 text-gray-400 hover:text-gray-200 hover:border-white/20'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleServices.map(service => <OpsServiceCard key={service.name} service={service} onOpen={setSelectedService} />)}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500">
                <span>{servicesUp} / {monitoredServices.length || services.length} monitored targets UP</span>
                <span>·</span>
                <span>{servicesNa} without Prometheus scrape</span>
                <span>·</span>
                <span>showing {visibleServices.length} in {serviceGroup}</span>
              </div>
            </motion.section>

            {/* ── TEST-MAINNET METRICS ── */}
            {v3 && v3Sparks && (
              <V3MetricsSection v3={v3} sparks={v3Sparks} nowSec={nowSec} cs={cs} locale={locale} />
            )}

            {/* ── 6H CHARTS ── */}
            {v3Charts && (
              <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="zion-rainbow-card p-4 sm:p-6 lg:p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className="flex flex-col gap-3 mb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Time Series</p>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                      <TrendingUp className="h-6 w-6 text-zion-purple" />
                      Charts — {chartRange.toUpperCase()}
                    </h2>
                    <p className="text-xs text-gray-500">Prometheus range queries · auto-refresh 60s · adaptive step by selected range</p>
                  </div>
                  <div className="inline-flex zion-section p-1 self-start">
                    {CHART_RANGES.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setChartRange(option.value)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartRange === option.value ? 'bg-zion-purple/20 text-zion-purple border border-zion-purple/30' : 'text-gray-400 hover:text-gray-200'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <AreaChart data={v3Charts.chainHeight} timestamps={v3Charts.timestamps} label={`Chain Height — ${chartRange}`} color="#fcd116" />
                  <AreaChart data={v3Charts.poolSessions} timestamps={v3Charts.timestamps} label={`Active Miners — ${chartRange}`} color="#a855f7" />
                  <AreaChart data={v3Charts.shares} timestamps={v3Charts.timestamps} label={`Accepted Shares (cumul.) — ${chartRange}`} color="#10b981" />
                  <AreaChart data={v3Charts.minerHashrate} timestamps={v3Charts.timestamps} label={`Miner Hashrate — ${chartRange}`} color="#22c55e" unit=" H/s" />
                  <AreaChart data={v3Charts.cpuLoad} timestamps={v3Charts.timestamps} label={`CPU Load (1m avg) — ${chartRange}`} color="#066928" />
                  <AreaChart data={v3Charts.memPct} timestamps={v3Charts.timestamps} label={`Memory Usage % — ${chartRange}`} color="#ec4899" unit="%" />
                  <AreaChart data={v3Charts.redisMemory} timestamps={v3Charts.timestamps} label={`Redis Memory — ${chartRange}`} color="#f97316" />
                </div>
              </motion.section>
            )}

            {/* ── DOCKER STACK ARCHITECTURE ── */}
            <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="zion-rainbow-card p-4 sm:p-6 lg:p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex flex-col gap-2 mb-5">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Infrastructure</p>
                <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Layers className="h-6 w-6 text-zion-cyan" />
                  Docker Stack Architecture
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Core Layer */}
                <div className="zion-rainbow-sub p-4 space-y-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-zion-cyan flex items-center gap-2"><Database className="h-4 w-4" /> Core Layer</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">zion-core</span><span className="text-gray-500 font-mono">:8333 :8443 :9115</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-redis</span><span className="text-gray-500 font-mono">:6379</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-seed-1</span><span className="text-gray-500 font-mono">internal</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-seed-2</span><span className="text-gray-500 font-mono">internal</span></div>
                  </div>
                  <p className="text-[10px] text-gray-500">Blockchain consensus + P2P + RPC · read-only rootfs · no-new-privileges</p>
                </div>
                {/* Mining Layer */}
                <div className="zion-rainbow-sub p-4 space-y-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-zion-purple flex items-center gap-2"><Pickaxe className="h-4 w-4" /> Mining Layer</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">zion-pool</span><span className="text-gray-500 font-mono">:8444 :8080</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">zion-miner</span><span className="text-gray-500 font-mono">—</span></div>
                  </div>
                  <p className="text-[10px] text-gray-500">Stratum pool · PPLNS engine · Cosmic Harmony PoW · internal miner</p>
                </div>
                {/* Monitoring Layer */}
                <div className="zion-rainbow-sub p-4 space-y-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-zion-cyan flex items-center gap-2"><Activity className="h-4 w-4" /> Monitoring Layer</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">prometheus</span><span className="text-gray-500 font-mono">:9090</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">grafana</span><span className="text-gray-500 font-mono">:3001</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">node-exporter</span><span className="text-gray-500 font-mono">:9100</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">redis-exporter</span><span className="text-gray-500 font-mono">:9121</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">alertmanager</span><span className="text-gray-500 font-mono">:9093</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">website</span><span className="text-gray-500 font-mono">:3000</span></div>
                  </div>
                  <p className="text-[10px] text-gray-500">Prometheus 90d retention · Grafana dashboards · alert rules</p>
                </div>
              </div>
              <div className="mt-4 zion-tile p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Globe className="h-4 w-4 text-gray-400" /> Network Topology</h3>
                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1 font-semibold">Public pool</p>
                    <p className="text-gray-500">Public relay · mining pool · web · Prometheus scrape</p>
                    <p className="text-gray-500">Public endpoint · pool + web + monitoring stack</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 font-semibold">Consensus node</p>
                    <p className="text-gray-500">Primary consensus node · public RPC · P2P</p>
                    <p className="text-gray-500">Connected via mainnet mesh · local miner</p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ── FOOTER LINKS ── */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-gray-500 pt-2 border-t border-white/10">
              <span>30+ live Prometheus metrics</span>
              <span>6h range queries · 5m resolution</span>
              <span>15s instant refresh · 60s chart refresh</span>
              <span>Redis + remote target telemetry</span>
              <a href="/monitoring" className="text-zion-cyan hover:text-zion-cyan transition-colors">Full monitoring page →</a>
              <a href="/grafana/" target="_blank" rel="noopener noreferrer" className="text-zion-cyan hover:text-zion-cyan transition-colors">Open Grafana →</a>
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedService && <ServiceDetailDrawer service={selectedService} onClose={() => setSelectedService(null)} />}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════
            TAB: EKAM DEEKSHA UPGRADE
           ═══════════════════════════════════════════════ */}
        {activeTab === 'upgrade' && (
          <div className="space-y-8">
            {/* Upgrade Overview */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{SITE_VERSION}</p>
                  <span className="text-[10px] uppercase tracking-widest border border-zion-gold/40 bg-zion-gold/10 text-zion-gold px-2 py-0.5 rounded-full font-semibold">
                    DEPLOYED · MAINNET LAUNCH COUNTDOWN
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Sparkles className="h-7 w-7 text-zion-gold" />
                  Ekam Deeksha — ASIC Resistance Upgrade
                </h2>
                <p className="text-sm text-gray-400">
                  {cs ? 'Ekam Deeksha v3.2 je kanonický ASIC-hardened PoW ZION mainnetu: 512 KiB scratchpad se sekvenčním XOR průchodem vpřed i vzad, 128 náhodných čtení na nonce a 2 AES rundy s finálním Keccak-256. Běží na všech výškách V31 chainu; CPU, CUDA, OpenCL a Metal backendy jsou bit-identické podle locknutých KAT vektorů.' : 'Ekam Deeksha v3.2 is the canonical ASIC-hardened PoW of ZION Mainnet: a 512 KiB scratchpad with forward and backward sequential XOR passes, 128 random reads per nonce, and 2 AES rounds with a Keccak-256 finalize. It runs at all heights of the V31 chain; CPU, CUDA, OpenCL and Metal backends are bit-identical against locked KAT vectors.'}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label={cs ? 'Verze' : 'Version'} value={SITE_VERSION} sub={`Ekam Deeksha v3.2 · ${SITE_RUNTIME_LABEL}`} color="text-zion-gold" />
                <Stat label="KAT vectors" value="LOCKED" sub="CPU + GPU bit-identical" color="text-zion-cyan" mono />
                <Stat label="Backends" value="4/4" sub="CPU · CUDA · OpenCL · Metal" color="text-zion-cyan" mono />
                <Stat label="Production" value="G1 CLOSED" sub="rigs E2E on Edge pool" color="text-zion-cyan" mono />
              </div>
            </motion.section>

            {/* Tier Progress */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Implementation</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Shield className="h-7 w-7 text-zion-cyan" />
                  Tier Checklist
                </h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {/* Pipeline */}
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-zion-cyan" />
                      {cs ? 'Memory-hard pipeline' : 'Memory-hard pipeline'}
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest border border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200 px-2 py-0.5 rounded-full font-semibold">CANONICAL</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { done: true, text: cs ? 'Scratchpad 512 KiB (16 384 bloků × 32 B)' : 'Scratchpad 512 KiB (16,384 blocks × 32 B)' },
                      { done: true, text: cs ? 'SHA3-512 chain fill' : 'SHA3-512 chain fill' },
                      { done: true, text: cs ? '2 sekvenční XOR průchody — vpřed + vzad' : '2 sequential XOR passes — forward + backward' },
                      { done: true, text: cs ? '128 náhodných čtení na nonce (seriální bottleneck)' : '128 random reads per nonce (serial bottleneck)' },
                      { done: true, text: cs ? 'KAT vektory locknuté — deterministika napříč backendy' : 'KAT vectors locked — determinism across backends' },
                      { done: true, text: 'Commit e56f627a8' },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-zion-cyan shrink-0" />
                        <span className="text-gray-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Finalize + backends */}
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-zion-cyan" />
                      {cs ? 'Finalizace + backend parita' : 'Finalize + backend parity'}
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest border border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200 px-2 py-0.5 rounded-full font-semibold">CANONICAL</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { done: true, text: cs ? '2 AES rundy + Keccak-256 finále' : '2 AES rounds + Keccak-256 finalize' },
                      { done: true, text: cs ? 'CPU · CUDA · OpenCL · Metal bit-identické' : 'CPU · CUDA · OpenCL · Metal bit-identical' },
                      { done: true, text: cs ? 'Apple Silicon: Metal vypnut pro v3.2 — CPU je 8–10× rychlejší' : 'Apple Silicon: Metal disabled for v3.2 — CPU is 8–10× faster' },
                      { done: true, text: cs ? 'Miner mapuje ekam_deeksha na kanonický backend automaticky' : 'Miner maps ekam_deeksha to the canonical backend automatically' },
                      { done: true, text: cs ? 'Běží na všech výškách V31 chainu od cutoveru' : 'Runs at all heights of the V31 chain since cutover' },
                      { done: true, text: 'Commits 09261d59f · 345b8fdaa · eccf43faf' },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-zion-cyan shrink-0" />
                        <span className="text-gray-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Deploy & Verification */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Deploy & Verify</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Server className="h-7 w-7 text-zion-purple" />
                  V31 Mainnet Deployment
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Krok</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Popis</th>
                      <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">Stav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { step: 'Canonicalization', desc: 'Ekam Deeksha v3.2 — jednotné pojmenování napříč core, minerem a GPU kernely', status: 'done', ref: 'e56f627a8' },
                      { step: 'KAT Lock', desc: 'KAT vektory locknuté — CPU/CUDA/OpenCL/Metal bit-identické', status: 'done', ref: 'locked' },
                      { step: 'V31 Cutover', desc: 'Ekam Deeksha v3.2 běží na všech výškách, V3 služby zastaveny a maskovány', status: 'done', ref: 'complete' },
                      { step: 'Edge Production', desc: 'node + pool + multichain + DAO + OASIS + web na Edge active', status: 'done', ref: 'live' },
                      { step: 'G1 Rigs E2E', desc: 'Produkční rigy na Edge poolu — GTX 1070 Ti + SMOS AMD rig, >99% accept', status: 'done', ref: 'closed' },
                      { step: 'G7 Chaos/Load', desc: '10k-miner pool handshake, DEX/bridge overload, P2P storm', status: 'done', ref: 'passed' },
                      { step: 'Public Build', desc: 'public_build feature — Boost branding, masked internal streams', status: 'done', ref: 'v3.2.0' },
                      { step: 'G8 30-Day Run', desc: 'Kontinuální běh 23. 8. — 22. 9. 2026, uptime cíl ≥99.9%', status: 'pending', ref: 'in progress' },
                      { step: 'G9 Security Audit', desc: 'Externí audit před public launchem', status: 'pending', ref: 'scheduled' },
                    ].map(row => (
                      <tr key={row.step} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${row.status === 'pending' ? 'bg-zion-gold/5' : ''}`}>
                        <td className="py-3 px-4 font-semibold text-white">{row.step}</td>
                        <td className="py-3 px-4 text-gray-400">{row.desc}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${row.status === 'done' ? 'text-zion-cyan' : 'text-zion-gold'}`}>
                            {row.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                            {row.ref}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
            </motion.section>

            {/* Technical Details */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Technical</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Code2 className="h-7 w-7 text-zion-cyan" />
                  {cs ? 'Ekam Deeksha — Technické parametry' : 'Ekam Deeksha — Technical Parameters'}
                </h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="text-base font-semibold text-white mb-4">Ekam Deeksha v3.2 — {cs ? 'Memory-hard pipeline' : 'Memory-hard pipeline'}</h3>
                  <div className="space-y-2">
                    {[
                      [cs ? 'Scratchpad' : 'Scratchpad', '512 KiB (524,288 B · 16,384 × 32 B)'],
                      [cs ? 'Průchody' : 'Passes', '2 (forward + backward XOR)'],
                      [cs ? 'Náhodná čtení' : 'Random reads', '128 / nonce'],
                      [cs ? 'Fill' : 'Fill', 'SHA3-512 chain fill'],
                      [cs ? 'Finále' : 'Finalize', '2 AES rounds + Keccak-256'],
                      [cs ? 'Soubor' : 'File', 'algorithm/ekam_deeksha.rs'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm border-b border-white/5 pb-1.5">
                        <span className="text-gray-400">{k}</span>
                        <span className="font-mono text-white">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="text-base font-semibold text-white mb-4">{cs ? 'Backend parita' : 'Backend Parity'}</h3>
                  <div className="space-y-2">
                    {[
                      [cs ? 'Backendy' : 'Backends', 'CPU · CUDA · OpenCL · Metal'],
                      [cs ? 'KAT vektory' : 'KAT vectors', cs ? 'locknuté — bit-identické' : 'locked — bit-identical'],
                      [cs ? 'Apple Silicon' : 'Apple Silicon', cs ? 'Metal OFF — CPU 8–10× rychlejší' : 'Metal OFF — CPU 8–10× faster'],
                      [cs ? 'Konsensus profil' : 'Consensus profile', 'Ekam Deeksha v3.2 (all heights)'],
                      [cs ? 'Block time target' : 'Block time target', '60 s · LWMA DAA'],
                      [cs ? 'KAT vector #1' : 'KAT vector #1', '6edcfb4c…7290bf'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm border-b border-white/5 pb-1.5">
                        <span className="text-gray-400">{k}</span>
                        <span className="font-mono text-white">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Affected Files */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Changed Files</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Construction className="h-7 w-7 text-zion-gold" />
                  {cs ? 'Dotčené soubory' : 'Changed Files'}
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { file: 'V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs', change: cs ? 'Kanonický v3.2 pipeline — 512 KiB, 2 passes, 128 reads, 2 AES rounds' : 'Canonical v3.2 pipeline — 512 KiB, 2 passes, 128 reads, 2 AES rounds', type: 'new' },
                  { file: 'V31/L1/cosmic-harmony/src/gpu/kernels/ekam_deeksha.cl', change: 'OpenCL kernel — bit-identical to CPU', type: 'mod' },
                  { file: 'V31/L1/cosmic-harmony/src/gpu/opencl_kernel.rs', change: 'KAT asserts — SCRATCHPAD 524288, PASSES 2, READS 128', type: 'mod' },
                  { file: 'V31/L1/cosmic-harmony/src/gpu/ (CUDA + Metal kernels)', change: 'CUDA/OpenCL/Metal backend parity + optimization', type: 'mod' },
                  { file: 'V31/L1/miner/src/gpu/*', change: cs ? 'ekam_deeksha → kanonický backend, Apple Silicon → CPU' : 'ekam_deeksha → canonical backend, Apple Silicon → CPU', type: 'mod' },
                  { file: 'V31/L1/miner/src/ext_log.rs + runtime + auxpow', change: 'public_build — Boost branding, masked internal streams', type: 'new' },
                  { file: 'V31/L1/core/src/emission.rs + genesis.rs', change: 'Ekam Deeksha v3.2 consensus profile · 16.78B premine · 89/5/5/1', type: 'mod' },
                  { file: 'V31/release/*', change: cs ? 'Build skripty pro veřejné v3.2.0 binárky' : 'Build scripts for public v3.2.0 binaries', type: 'new' },
                ].map(f => (
                  <div key={f.file} className="flex items-center gap-3 text-sm py-2.5 px-4 zion-tile">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${f.type === 'new' ? 'bg-zion-cyan/20 text-zion-cyan' : 'bg-zion-purple/20 text-zion-purple'}`}>
                      {f.type === 'new' ? 'NEW' : 'MOD'}
                    </span>
                    <div>
                      <span className="font-mono text-gray-300 text-xs">{f.file}</span>
                      <p className="text-[11px] text-gray-500">{f.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Git Commits */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Git Log</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Database className="h-7 w-7 text-zion-purple" />
                  Commity Ekam Deeksha
                </h2>
              </div>
              <div className="space-y-3">
                {[
                  { hash: 'e56f627a8', msg: 'V31: consolidate PoW algorithm naming to Ekam Deeksha v3.2', date: '2026-08-20' },
                  { hash: '09261d59f', msg: 'Optimize Metal Ekam Deeksha backend on Apple Silicon', date: '2026-08-20' },
                  { hash: '345b8fdaa', msg: 'perf(metal): port CUDA/OpenCL optimizations to Ekam Deeksha Metal backend', date: '2026-08-20' },
                  { hash: 'eccf43faf', msg: 'disable(metal): route Ekam Deeksha v3.2 to CPU on Apple Silicon M1-M5', date: '2026-08-20' },
                  { hash: 'c7787a2c7', msg: 'release(miner): zion-miner v3.2.0 public build with public_build log masking', date: '2026-08-21' },
                ].map(c => (
                  <div key={c.hash} className="flex items-center gap-3 text-sm py-2 px-4 zion-tile">
                    <span className="font-mono text-xs text-zion-gold bg-zion-gold/10 px-2 py-1 rounded">{c.hash}</span>
                    <span className="text-gray-300 flex-1">{c.msg}</span>
                    <span className="text-xs text-gray-500 shrink-0">{c.date}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 2: ROADMAP
           ═══════════════════════════════════════════════ */}
        {activeTab === 'roadmap' && (
          <div className="space-y-8">
            {/* Overall Progress */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{MissionControlDashboardCopy.progress[cs ? 'cs' : 'en']}</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Target className="h-7 w-7 text-zion-gold" />
                  Roadmap — Launch Countdown
                </h2>
                <p className="text-sm text-gray-400">{cs ? 'V31 Mainnet Alpha live. Gates G1–G5, G7 a G11 hotové, G8 30denní kontinuální běh probíhá. Veřejný launch cíl 31. prosince 2026 (Silvestr).' : 'V31 Mainnet Alpha live. Gates G1–G5, G7 and G11 complete, G8 30-day continuous run in progress. Public launch target 31 December 2026 (New Year\'s Eve).'}</p>
              </div>
              <div className="relative h-9 zion-section overflow-hidden">
                <motion.div className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-zion-gold via-zion-cyan to-zion-purple" initial={{ width: 0 }} animate={{ width: '85%' }} transition={{ duration: 1.2 }} />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md z-10">{SITE_RELEASE_LABEL} · MAINNET ALPHA LIVE · G8 30-DAY RUN · PUBLIC LAUNCH 31 DEC 2026</span>
              </div>
            </motion.section>

            {/* Phases */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="space-y-5"
            >
              <PhaseAccordion icon={<CheckCircle2 className="h-6 w-6 text-zion-cyan" />} title={cs ? 'Fáze 0 — Core & Consensus Foundation' : 'Phase 0 — Core & Consensus Foundation'} pct={100} status={MissionControlDashboardCopy.completed[cs ? 'cs' : 'en']} statusColor="border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200" defaultOpen>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {cs ? 'Genesis 1. 1. 2026 · One Love hard reset 6. 8. 2026 · V31 workspace 3.1.0-beta' : 'Genesis 1 Jan 2026 · One Love hard reset 6 Aug 2026 · V31 workspace 3.1.0-beta'}</p>
                <div className="overflow-x-auto"><table className="w-full text-left"><tbody>
                  <SprintRow name="0.1 Emission & Genesis" content="5,400.067 ZION/block · 16.78B premine (14 outputs) · Decade Decay ×4/5 / 10y" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="0.2 DAA & Consensus" content={cs ? 'LWMA · target 60 s · fork-choice · reorg lock 10' : 'LWMA · 60 s target · fork-choice · reorg lock 10'} status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="0.3 Fee Market" content="89/5/5/1 split · L1 fee burn · min fee" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="0.4 Wallet & TX" content="UTXO + Ed25519 · v2 tx format · wallet SDK + CLI aligned" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="0.5 Premine / Coinbase Soft-Fork" content="Coinbase maturity 100 · premine time-lock + 3-of-3 admin multisig · activation 13100" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} highlight />
                </tbody></table></div>
              </PhaseAccordion>

              <PhaseAccordion icon={<RefreshCw className="h-6 w-6 text-zion-cyan" />} title={cs ? 'Fáze 1 — Ekam Deeksha v3.2 & V31 Cutover' : 'Phase 1 — Ekam Deeksha v3.2 & V31 Cutover'} pct={100} status={cs ? 'DOKONČENO' : 'COMPLETED'} statusColor="border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200" defaultOpen>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {cs ? 'Srpen 2026 · kanonický PoW nasazen na všech výškách V31 chainu' : 'August 2026 · canonical PoW deployed at all heights of the V31 chain'}</p>
                <div className="overflow-x-auto"><table className="w-full text-left"><tbody>
                  <SprintRow name="1.1 Canonical PoW" content={cs ? 'Ekam Deeksha v3.2 — 512 KiB scratchpad, 2 passes, 128 reads, 2 AES rounds, KAT locked' : 'Ekam Deeksha v3.2 — 512 KiB scratchpad, 2 passes, 128 reads, 2 AES rounds, KAT locked'} status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} highlight />
                  <SprintRow name="1.2 GPU Backend Parity" content="CPU · CUDA · OpenCL · Metal bit-identical · Apple Silicon CPU routing" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="1.3 V31 Cutover" content={cs ? 'V3 služby zastaveny a maskovány, V31 node/pool/DAO/OASIS produkční' : 'V3 services stopped and masked, V31 node/pool/DAO/OASIS production'} status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="1.4 Payout Engine" content="PPLNS + payout confirmation sweep s UTXO fallback" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                  <SprintRow name="1.5 TX / Address Index" content="tx_index + output_index + address_tx_index — backfill na Edge" status={<CheckCircle2 className="h-4 w-4 text-zion-cyan" />} />
                </tbody></table></div>
              </PhaseAccordion>

              <PhaseAccordion icon={<CheckCircle2 className="h-6 w-6 text-zion-cyan" />} title={cs ? 'Fáze 2 — L2 Bridges, DeFi & Gates G1–G5/G7/G11' : 'Phase 2 — L2 Bridges, DeFi & Gates G1–G5/G7/G11'} pct={100} status={cs ? 'DOKONČENO' : 'COMPLETED'} statusColor="border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200">
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {cs ? 'Srpen 2026 · E4 bridge round-trip + chaos/load + migrace uzavřeny' : 'August 2026 · E4 bridge round-trip + chaos/load + migration closed'}</p>
                <div className="overflow-x-auto"><table className="w-full text-left"><tbody>
                  <SprintRow name="G1 GPU/Rig E2E" content={cs ? 'Produkční rigy na Edge poolu — >99 % accept rate' : 'Production rigs on Edge pool — >99% accept rate'} status={<span className="text-zion-cyan">CLOSED</span>} highlight />
                  <SprintRow name="G2 WARP Registry" content={cs ? 'Config-driven registry, non-EVM chainy gated s disabled_reason' : 'Config-driven registry, non-EVM chains gated with disabled_reason'} status={<span className="text-zion-cyan">CLOSED</span>} />
                  <SprintRow name="G3 Solver Network" content="Off-chain solvers · X-Solver-Key auth · intent→bid→settle E2E" status={<span className="text-zion-cyan">CLOSED</span>} />
                  <SprintRow name="G4 Public Subtree" content="public/ sync s v3-Mainnet:main — Everything up-to-date" status={<span className="text-zion-cyan">CLOSED</span>} />
                  <SprintRow name="G5/E8 AuxPoW Path" content="External merged-mining path validated E2E" status={<span className="text-zion-cyan">CLOSED</span>} />
                  <SprintRow name="G7 Chaos / Load" content={cs ? '10k-miner handshake, DEX/bridge overload, P2P storm, tx fuzz preview' : '10k-miner handshake, DEX/bridge overload, P2P storm, tx fuzz preview'} status={<span className="text-zion-cyan">CLOSED</span>} highlight />
                  <SprintRow name="E4 Bridge Round-Trip" content={cs ? '100 ZION lock → wZION mint → burn → 100 ZION unlock na Base mainnetu' : '100 ZION lock → wZION mint → burn → 100 ZION unlock on Base mainnet'} status={<span className="text-zion-cyan">CLOSED</span>} highlight />
                  <SprintRow name="G11 V3→V31 Migration" content="Foundry 43 tests · zion deploy/update · miner TUI · CLI build" status={<span className="text-zion-cyan">CLOSED</span>} />
                </tbody></table></div>
              </PhaseAccordion>

              <PhaseAccordion icon={<CheckCircle2 className="h-6 w-6 text-zion-cyan" />} title={cs ? 'Fáze 3 — Public Release v3.2.0 "One Love"' : 'Phase 3 — Public Release v3.2.0 "One Love"'} pct={100} status={cs ? 'DOKONČENO' : 'COMPLETED'} statusColor="border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200">
                <div className="overflow-x-auto"><table className="w-full text-left"><tbody>
                  <SprintRow name="3.1 Public Miner" content="zion-miner v3.2.0 · public_build Boost branding · masked internal streams" status={<span className="text-zion-cyan">DONE</span>} />
                  <SprintRow name="3.2 CLI + Desktop" content="zion-cli v3.2.0 · Desktop Agent — GitHub release workflows" status={<span className="text-zion-cyan">DONE</span>} />
                  <SprintRow name="3.3 Release Assets" content={cs ? 'macOS aarch64/x86_64 tar.gz + SHA256SUMS · build skripty pro všechny platformy' : 'macOS aarch64/x86_64 tar.gz + SHA256SUMS · build scripts for all platforms'} status={<span className="text-zion-cyan">DONE</span>} />
                </tbody></table></div>
              </PhaseAccordion>

              <PhaseAccordion icon={<RefreshCw className="h-6 w-6 text-zion-cyan" />} title={cs ? 'Fáze 4 — G8 30-Day Continuous Run' : 'Phase 4 — G8 30-Day Continuous Run'} pct={2} status="RUNNING" statusColor="border-zion-gold/30 bg-zion-gold/10 text-amber-200" defaultOpen>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {cs ? '23. 8. 2026 07:00 CET → 22. 9. 2026 07:00 CET · uptime cíl ≥ 99,9 %' : '23 Aug 2026 07:00 CET → 22 Sep 2026 07:00 CET · uptime target ≥ 99.9%'}</p>
                <div className="overflow-x-auto"><table className="w-full text-left"><tbody>
                  <SprintRow name="4.1 Continuous Run" content={cs ? 'Celý V31 stack pod trvalým dohledem — node, pool, bridge, web' : 'Full V31 stack under continuous watch — node, pool, bridge, web'} status={<span className={`${stabilityStatusColor} inline-flex items-center gap-1`}><RefreshCw className="h-3.5 w-3.5" /> {stabilityStatus}</span>} highlight />
                  <SprintRow name="4.2 F2 Transaction Fuzz" content={cs ? '24h transaction fuzz běží na pozadí' : '24h transaction fuzz running in background'} status={<span className="text-zion-gold inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> RUNNING</span>} />
                  <SprintRow name="4.3 Closure Report" content={cs ? 'Vyhodnocení po 22. 9. — uptime ≥ 99,9 % → G8 COMPLETE' : 'Evaluation after 22 Sep — uptime ≥ 99.9% → G8 COMPLETE'} status={<Square className="h-4 w-4 text-gray-500" />} />
                </tbody></table></div>
              </PhaseAccordion>

              <PhaseAccordion icon={<Rocket className="h-6 w-6 text-zion-gold" />} title={cs ? 'Fáze 5 — G9/G10 & Public Launch' : 'Phase 5 — G9/G10 & Public Launch'} pct={20} status="31. 12. 2026" statusColor="border-zion-purple/30 bg-zion-purple/10 text-zion-purple">
                <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">Gate</th><th className="text-[10px] uppercase tracking-wider text-gray-500 px-4 py-1">{cs ? 'Aktivita' : 'Activity'}</th></tr></thead><tbody>
                  {[
                    ['G9', cs ? 'Externí security audit (V31 L1/L2) — plánován před launchem' : 'External security audit (V31 L1/L2) — planned before launch'],
                    ['G10', cs ? 'L5/L6 rozhodnutí — treasury, humanitární fond, Issobella governance' : 'L5/L6 decision — treasury, humanitarian fund, Issobella governance'],
                    ['F2', cs ? 'Dokončení 24h transaction fuzz evidence' : '24h transaction fuzz evidence completion'],
                    ['I', cs ? 'ZIS identity service — finální public auth flows' : 'ZIS identity service — final public auth flows'],
                    ['LAUNCH', cs ? 'Public launch — One Love Mainnet · 31. prosince 2026' : 'Public launch — One Love Mainnet · 31 December 2026'],
                  ].map(([day, act]) => <tr key={day}><td className="py-2.5 px-4 text-sm font-semibold text-white rounded-l-lg">{day}</td><td className="py-2.5 px-4 text-sm text-gray-400 rounded-r-lg">{act}</td></tr>)}
                  <tr className="bg-zion-purple/5"><td className="py-2.5 px-4 text-sm font-semibold text-zion-purple rounded-l-lg"><span className="inline-flex items-center gap-1">T-0 <Rocket className="h-3.5 w-3.5" /></span></td><td className="py-2.5 px-4 text-sm font-bold text-zion-purple rounded-r-lg">PUBLIC MAINNET LAUNCH · 31 DEC 2026</td></tr>
                </tbody></table></div>
              </PhaseAccordion>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 3: LAYERS
           ═══════════════════════════════════════════════ */}
        {activeTab === 'layers' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-8">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{MissionControlDashboardCopy.architecture[cs ? 'cs' : 'en']}</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Layers className="h-7 w-7 text-zion-gold" />
                  {MissionControlDashboardCopy.layerStack[cs ? 'cs' : 'en']}
                </h2>
                <p className="text-sm text-gray-400 italic">{cs ? '&quot;Jednoduchý L1 blockchain, který funguje bezchybně, je základem pro nekonečný ekosystém nad ním.&quot;' : '&quot;A simple L1 blockchain that works flawlessly is the foundation for an infinite ecosystem above it.&quot;'}</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'L6 — ZION ISSOBELLA', color: 'border-l-rose-400 bg-zion-purple/5', title: 'Orbital Consciousness Station', desc: cs ? 'Vesmírná stanice ZION Issobella — decentralizovaný výzkum, orbital mining, 5% block reward fund' : 'ZION Issobella space station — decentralized research, orbital mining, 5% block reward fund', tags: ['Space Station', 'Orbital Mining', '5% Fund', 'Deep Research'], date: '2040+', labelColor: 'text-zion-purple', active: false, Icon: Rocket },
                  { label: 'L5 — FREE WORLD', color: 'border-l-amber-400 bg-zion-gold/5', title: 'Sovereign Governance Layer', desc: cs ? 'Plně decentralizovaná správa, komunitní governance, svobodný ekosystém bez hranic' : 'Fully decentralized governance, community governance, free ecosystem without borders', tags: ['Governance', 'Sovereignty', 'Community', 'Freedom'], date: '2030+', labelColor: 'text-zion-gold', active: false, Icon: Globe2 },
                  { label: 'L4 — ZION OASIS', color: 'border-l-pink-400 bg-zion-purple/5', title: 'Consciousness Mining as Gameplay', desc: cs ? 'UE5 open-world, XP/Consciousness levels, NFT avatary, Play-to-Mine' : 'UE5 open-world, XP/Consciousness levels, NFT avatars, Play-to-Mine', tags: ['UE5 World', 'XP System', 'NFT Avatars', 'Play-to-Mine'], date: '2029+', labelColor: 'text-zion-purple', active: false, Icon: Gamepad2 },
                  { label: 'L3 — WARP & AI NATIVE', color: 'border-l-purple-400 bg-zion-purple/5', title: 'Neural Compute Layer & AI Agents', desc: cs ? 'WARP chain registry config-driven (G2 uzavřen), non-EVM chainy gated, NCL gateway a AI Native SDK navazují' : 'WARP chain registry config-driven (G2 closed), non-EVM chains gated, NCL gateway and AI Native SDK follow', tags: ['WARP Registry', 'NCL Gateway', cs ? 'AI Orchestrátor' : 'AI Orchestrator', cs ? 'GPU za ZION' : 'GPU for ZION'], date: cs ? '2026 Q3 — gated (G2 ✅)' : '2026 Q3 — gated (G2 ✅)', labelColor: 'text-zion-purple', active: true, Icon: Brain },
                  { label: 'L2 — DEX & DeFi', color: 'border-l-blue-400 bg-zion-purple/5', title: 'Atomic Swaps, AMM & DAO', desc: cs ? 'wZION bridge live na Base mainnetu — E4 lock → mint → burn → unlock round-trip ověřen' : 'wZION bridge live on Base mainnet — E4 lock → mint → burn → unlock round-trip verified', tags: ['HTLC Swaps', 'wZION Bridge', 'Base Mainnet', 'DAO Voting'], date: '2026 Q3 — mainnet live (E4 ✅)', labelColor: 'text-zion-purple', active: true, Icon: ArrowLeftRight },
                  { label: cs ? 'L1 — ZION BLOCKCHAIN ← ZDE' : 'L1 — ZION BLOCKCHAIN ← HERE', color: 'border-l-cyan-400 bg-zion-cyan/[0.08] border-2 border-zion-cyan/20 shadow-[0_0_30px_rgba(34,211,238,0.12)]', title: 'PoW Ekam Deeksha v3.2 — Canonical', desc: cs ? 'UTXO + Ed25519, Decade Decay emise (-20%/dekádu), LWMA DAA, fee burning, Boost multi-stream mining. Ekam Deeksha v3.2: 512 KiB scratchpad, 2 sekvenční průchody, 128 náhodných čtení, 2 AES rundy — KAT-locked, CPU/CUDA/OpenCL/Metal bit-identické.' : 'UTXO + Ed25519, Decade Decay emission (-20%/decade), LWMA DAA, fee burning, Boost multi-stream mining. Ekam Deeksha v3.2: 512 KiB scratchpad, 2 sequential passes, 128 random reads, 2 AES rounds — KAT-locked, CPU/CUDA/OpenCL/Metal bit-identical.', tags: ['Ekam Deeksha v3.2', 'ASIC-resistant', 'UTXO Model', 'Ed25519', 'Decade Decay', 'Fee Burn', 'Boost Mining'], date: cs ? 'Mainnet Alpha live · public launch 31. 12. 2026' : 'Mainnet Alpha live · public launch 31 Dec 2026', labelColor: 'text-zion-cyan', active: true, Icon: Link },
                ].map((l, idx) => (
                  <motion.div
                    key={l.label}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 + idx * 0.06 }}
                    className={`rounded-3xl border-l-4 p-6 ${l.color} hover:translate-x-1 transition-transform`}
                  >
                    <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${l.labelColor}`}>{l.label}</p>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><l.Icon className="h-5 w-5" />{l.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{l.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-4">{l.tags.map(t => <span key={t} className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10">{t}</span>)}</div>
                    <p className="text-[11px] text-gray-600 mt-3 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {l.date}</p>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 4: CONSTITUTION
           ═══════════════════════════════════════════════ */}
        {activeTab === 'constitution' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="grid gap-6 lg:grid-cols-2"
            >
              {/* Constitution */}
              <div className="zion-rainbow-card p-4 sm:p-6 lg:p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="h-6 w-6 text-zion-gold" />
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Target Mainnet Constitution</h2>
                    <p className="text-xs sm:text-sm text-gray-400">{cs ? 'Plánované produkční parametry; tento dashboard sleduje Network mainnet proti nim' : 'Planned production parameters; this dashboard tracks the Network mainnet against them'}</p>
                  </div>
                </div>
                <div className="space-y-0">
                  {[
                    ['Chain ID', 'zion-mainnet-1'],
                    [MissionControlDashboardCopy.totalSupply[cs ? 'cs' : 'en'], '144,000,000,000'],
                    [MissionControlDashboardCopy.miningSupply[cs ? 'cs' : 'en'], '127,220,000,000'],
                    [MissionControlDashboardCopy.genesisPremine_2[cs ? 'cs' : 'en'], '16,780,000,000'],
                    [MissionControlDashboardCopy.blockRewardD1[cs ? 'cs' : 'en'], '5,400.067 ZION'],
                    [MissionControlDashboardCopy.emissionModel[cs ? 'cs' : 'en'], 'Decade Decay (-20%/10y)'],
                    [MissionControlDashboardCopy.tailEmission[cs ? 'cs' : 'en'], '724.785 ZION/block ∞'],
                    [MissionControlDashboardCopy.blockTime[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k60Seconds[cs ? 'cs' : 'en']],
                    ['DAA', cs ? 'LWMA · target 60 s' : 'LWMA · 60 s target'],
                    [MissionControlDashboardCopy.maxReorg[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k10Blocks[cs ? 'cs' : 'en']],
                    [MissionControlDashboardCopy.softFinality[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k60Blocks[cs ? 'cs' : 'en']],
                    [MissionControlDashboardCopy.coinbaseMaturity[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k100Blocks[cs ? 'cs' : 'en']],
                    ['Consensus', 'PoW Ekam Deeksha v3.2'],
                    [MissionControlDashboardCopy.distribution[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k89Miner5Humanitarian5Issobella[cs ? 'cs' : 'en']],
                    ['Presale', cs ? 'NEEXISTUJE' : 'NONE'],
                    [MissionControlDashboardCopy.atomicUnits[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k1mPerZion[cs ? 'cs' : 'en']],
                    [MissionControlDashboardCopy.miningHorizon[cs ? 'cs' : 'en'], MissionControlDashboardCopy.k100YearsTail[cs ? 'cs' : 'en']],
                  ].map(([param, value]) => (
                    <div key={param} className="flex items-center justify-between py-2 sm:py-2.5 border-b border-white/5 text-xs sm:text-sm gap-2">
                      <span className="text-gray-400 shrink-0">{param}</span>
                      <span className={`font-mono text-white flex items-center gap-1 sm:gap-1.5 text-right ${(value === 'NEEXISTUJE' || value === 'NONE') ? 'text-zion-purple' : ''}`}>
                        <Lock className="h-3 w-3 text-zion-gold/60" />
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premine Allocation */}
              <div className="zion-rainbow-card p-4 sm:p-6 lg:p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className="flex items-center gap-3 mb-6">
                  <Scale className="h-6 w-6 text-zion-purple" />
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Genesis Premine</h2>
                    <p className="text-xs sm:text-sm text-gray-400">{cs ? '16,780,000,000 ZION — 14 výstupů · admin-locked (3-of-3 multisig + DAO vote)' : '16,780,000,000 ZION — 14 outputs · admin-locked (3-of-3 multisig + DAO vote)'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { cat: 'ZION OASIS + Winners Golden Egg/Xp', Icon: Pickaxe, amount: '8,250,000,000', pct: 49.2, lock: cs ? 'Admin-locked · 5 slotů' : 'Admin-locked · 5 slots', lockColor: 'text-zion-cyan' },
                    { cat: 'DAO Treasury', Icon: Database, amount: '4,000,000,000', pct: 23.8, lock: cs ? 'Time-lock do bloku 144,000' : 'Time-locked until block 144,000', lockColor: 'text-zion-gold' },
                    { cat: MissionControlDashboardCopy.infrastructureDev[cs ? 'cs' : 'en'], Icon: Wrench, amount: '2,590,000,000', pct: 15.4, lock: 'Admin-locked', lockColor: 'text-zion-cyan' },
                    { cat: MissionControlDashboardCopy.humanitarianFund[cs ? 'cs' : 'en'], Icon: Heart, amount: '1,440,000,000', pct: 8.6, lock: 'Admin-locked', lockColor: 'text-zion-cyan' },
                    { cat: 'Bridge Seed + Vault', Icon: ArrowLeftRight, amount: '500,000,000', pct: 3.0, lock: cs ? 'EVM bridge likvidita' : 'EVM bridge liquidity', lockColor: 'text-zion-purple' },
                  ].map(p => (
                    <div key={p.cat} className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2"><p.Icon className="h-4 w-4 text-gray-400" />{p.cat}</h4>
                        <span className="text-xs text-zion-gold font-mono">{p.pct}%</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-gray-300">
                        <span className="font-mono">{p.amount} ZION</span>
                        <span className={`text-xs ${p.lockColor}`}>{p.lock}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full bg-linear-to-r from-zion-gold to-zion-purple"
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 5: ECONOMY
           ═══════════════════════════════════════════════ */}
        {activeTab === 'economy' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Target Economics</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Wallet className="h-7 w-7 text-zion-gold" />
                  Target Mainnet Economic Model
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Stat label={MissionControlDashboardCopy.blockRewardD1[cs ? 'cs' : 'en']} value="5,400.067" sub="ZION/block · Decade Decay" color="text-zion-cyan" mono />
                <Stat label={MissionControlDashboardCopy.tailEmission[cs ? 'cs' : 'en']} value="724.785" sub={MissionControlDashboardCopy.zionBlockFrom2126[cs ? 'cs' : 'en']} color="text-zion-cyan" mono />
                <Stat label={MissionControlDashboardCopy.distribution[cs ? 'cs' : 'en']} value="89/5/5/1" sub={MissionControlDashboardCopy.minerHumanitarianIssobellaPool[cs ? 'cs' : 'en']} color="text-zion-purple" mono />
                <Stat label={MissionControlDashboardCopy.miningHorizon[cs ? 'cs' : 'en']} value={MissionControlDashboardCopy.k100Years[cs ? 'cs' : 'en']} sub={MissionControlDashboardCopy.perpetualTail[cs ? 'cs' : 'en']} color="text-zion-gold" mono />
              </div>
            </motion.section>

            {/* L5 / L6 Treasury Allocation */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.20 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{MissionControlDashboardCopy.l5L6Treasury[cs ? 'cs' : 'en']}</p>
                <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Heart className="h-6 w-6 text-zion-gold" />
                  {MissionControlDashboardCopy.humanitarianFundSpaceStation[cs ? 'cs' : 'en']}
                </h2>
                <p className="text-sm text-gray-400">{MissionControlDashboardCopy.k5OfEveryBlockRewardGoesToTheL5[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="zion-rainbow-sub p-4 sm:p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-3">
                    <Globe2 className="h-6 w-6 text-zion-gold" />
                    <div>
                      <p className="font-semibold text-white">L5 — Free World Humanitarian</p>
                      <p className="text-xs text-zion-gold font-mono">5% block reward → ~11.7M ZION/měsíc</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{cs ? 'Fyzické komunity, humanitární projekty, Free Energy, terénní governance. 5 % z každého block rewardu jde on-chain od V31 cutoveru.' : 'Physical communities, humanitarian projects, Free Energy, on-ground governance. 5% of every block reward goes on-chain since the V31 cutover.'}</p>
                  <div className="space-y-1 text-[10px] font-mono text-gray-500">
                    <p>wallet: zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8</p>
                    <p className="text-zion-gold">~11.7M ZION / měsíc · 5 % subsidy · canonical</p>
                  </div>
                </div>
                <div className="zion-rainbow-sub p-4 sm:p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-3">
                    <Rocket className="h-6 w-6 text-zion-purple" />
                    <div>
                      <p className="font-semibold text-white">L6 — ZION Issobella Space Fund</p>
                      <p className="text-xs text-zion-purple font-mono">5% block reward → ~11.7M ZION/měsíc</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{cs ? 'Orbitální stanice, vesmírný výzkum, SETI, Overview Effect protokoly. 5 % z každého block rewardu jde on-chain od V31 cutoveru.' : 'Orbital station, space research, SETI, Overview Effect protocols. 5% of every block reward goes on-chain since the V31 cutover.'}</p>
                  <div className="space-y-1 text-[10px] font-mono text-gray-500">
                    <p>wallet: zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0</p>
                    <p className="text-zion-purple">~11.7M ZION / měsíc · 5 % subsidy · canonical</p>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="zion-cta-banner p-4 sm:p-6 lg:p-8 flex items-center gap-3 sm:gap-6"
            >
              <Flame className="h-8 w-8 sm:h-10 sm:w-10 text-zion-purple shrink-0" />
              <div>
                <p className="text-sm sm:text-lg font-bold text-white">{MissionControlDashboardCopy.allL1TransactionFees[cs ? 'cs' : 'en']}<span className="text-zion-purple">{MissionControlDashboardCopy.burned[cs ? 'cs' : 'en']}</span></p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{MissionControlDashboardCopy.sentToABurnAddressWithoutAPriv[cs ? 'cs' : 'en']}</p>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 6: SECURITY
           ═══════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{MissionControlDashboardCopy.security[cs ? 'cs' : 'en']}</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Shield className="h-7 w-7 text-zion-cyan" />
                  Mainnet Security Gate
                </h2>
                <p className="text-sm text-gray-400">{cs ? 'V31 Mainnet Alpha security stack — konsensus hardening, soft-fork, chaos testy a infra zabezpečení nasazené. Před public launchem zbývá externí audit (G9).' : 'V31 Mainnet Alpha security stack — consensus hardening, soft-fork, chaos tests, and infra security deployed. External audit (G9) remains before public launch.'}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  cs ? 'Ed25519 verifikace podpisů + UTXO ochrana proti double-spend' : 'Ed25519 signature verification + UTXO double-spend protection',
                  cs ? 'Reorg lock, anti-fork choice a 60-block soft finality' : 'Reorg lock, anti-fork choice, and 60-block soft finality',
                  cs ? 'Premine time-locky + 3-of-3 admin multisig + coinbase maturity 100 (soft-fork @ 13100)' : 'Premine time-locks + 3-of-3 admin multisig + coinbase maturity 100 (soft-fork @ 13100)',
                  cs ? 'submit_block / submit_utxo hardening — size caps, 2h timestamp cap, mempool limits' : 'submit_block / submit_utxo hardening — size caps, 2h timestamp cap, mempool limits',
                  cs ? 'Payout sweeper — skip immature coinbase/premine, 10% fee cap, txid validace' : 'Payout sweeper — skip immature coinbase/premine, 10% fee cap, txid validation',
                  cs ? 'HTLC SHA-256 secret hashing + preimage flow' : 'HTLC SHA-256 secret hashing + preimage flow',
                  cs ? 'G7 chaos/load — 10k minerů, DEX/bridge overload, P2P reconnect storm' : 'G7 chaos/load — 10k miners, DEX/bridge overload, P2P reconnect storm',
                  cs ? 'Ekam Deeksha v3.2 KAT-locked — CPU/GPU bit-identické napříč backendy' : 'Ekam Deeksha v3.2 KAT-locked — CPU/GPU bit-identical across backends',
                  cs ? 'Secrets chmod 600/640, systemd hardening (ProtectSystem=full, NoNewPrivileges)' : 'Secrets chmod 600/640, systemd hardening (ProtectSystem=full, NoNewPrivileges)',
                  cs ? 'fail2ban + ufw operator allowlists, nginx IP allowlists pro RPC/DAO' : 'fail2ban + ufw operator allowlists, nginx IP allowlists for RPC/DAO',
                  cs ? 'Wallet SDK v2 UTXO + CLI zarovnané na V31 native transaction format' : 'Wallet SDK v2 UTXO + CLI aligned to the V31 native transaction format',
                  cs ? 'Watchdog hardened — startup grace během tx_index backfillu' : 'Watchdog hardened — startup grace during tx_index backfill',
                ].map((text) => (
                  <div key={text} className="flex items-center gap-3 text-sm py-2.5 px-4 zion-tile">
                    <CheckCircle2 className="h-4 w-4 text-zion-cyan shrink-0" />
                    <span className="text-gray-300">{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                <div className="zion-rainbow-sub p-4 text-sm text-gray-300" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zion-cyan">Mainnet Alpha Active</p>
                  <p className="mt-2">{cs ? 'V31 konsensus, Ekam Deeksha v3.2, reward split 89/5/5/1 a payout sweep běží produkčně na Edge.' : 'V31 consensus, Ekam Deeksha v3.2, the 89/5/5/1 reward split, and the payout sweep run in production on Edge.'}</p>
                </div>
                <div className="zion-rainbow-sub p-4 text-sm text-gray-300" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zion-gold">Launch Gate · G8 Running</p>
                  <p className="mt-2">{cs ? 'G8 30denní kontinuální běh probíhá (23. 8. — 22. 9. 2026). Po uzavření následuje G9 externí audit a G10 L5/L6 rozhodnutí.' : 'The G8 30-day continuous run is in progress (23 Aug — 22 Sep 2026). G9 external audit and G10 L5/L6 decision follow after closure.'}</p>
                </div>
                <div className="zion-rainbow-sub p-4 text-sm text-gray-300" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zion-cyan">Pre-Launch</p>
                  <p className="mt-2">{cs ? 'Před public launchem: G9 externí security audit, G10 governance rozhodnutí a F2 24h fuzz evidence.' : 'Before public launch: G9 external security audit, G10 governance decision, and F2 24h fuzz evidence.'}</p>
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 7: TIMELINE
           ═══════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-8">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{MissionControlDashboardCopy.timeline[cs ? 'cs' : 'en']}</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <CalendarDays className="h-7 w-7 text-zion-gold" />
                  Master Timeline — Test Mainnet To Production
                </h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="zion-rainbow-sub p-4 sm:p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="font-semibold text-white text-base sm:text-lg mb-4 sm:mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-zion-gold" /> 2026 — One Love Mainnet & Launch</h3>
                  <div className="relative pl-6 sm:pl-8 border-l-2 border-white/20 space-y-4 sm:space-y-6">
                    {[
                      { done: true, date: cs ? '1. ledna 2026' : '1 January 2026', title: 'MAINNET GENESIS', desc: cs ? 'Genesis block (timestamp 1767225600) — chain start' : 'Genesis block (timestamp 1767225600) — chain start', color: 'text-zion-cyan' },
                      { done: true, date: cs ? '6. srpna 2026' : '6 August 2026', title: 'v3.2.0 ONE LOVE RESET', desc: cs ? 'Nová genesis, kompletní rotace klíčů (BIP39), V31 cutover' : 'New genesis, full key rotation (BIP39), V31 cutover', color: 'text-zion-cyan' },
                      { done: true, date: cs ? '22. srpna 2026' : '22 August 2026', title: 'GATES G1–G5/G7/G11 + E4', desc: cs ? 'Rigy E2E, chaos/load, bridge round-trip, V3→V31 migrace uzavřeny' : 'Rigs E2E, chaos/load, bridge round-trip, V3→V31 migration closed', color: 'text-zion-cyan' },
                      { active: true, date: cs ? '23. 8. — 22. 9. 2026' : '23 Aug — 22 Sep 2026', title: 'G8 30-DAY RUN', desc: cs ? 'Kontinuální běh V31 stacku — uptime cíl ≥ 99,9 %' : 'Continuous run of the V31 stack — uptime target ≥ 99.9%', color: 'text-zion-gold' },
                      { active: true, date: cs ? '31. prosince 2026' : '31 December 2026', title: 'PUBLIC LAUNCH', desc: cs ? 'One Love Mainnet public GO — po uzavření G8/G9/G10' : 'One Love Mainnet public GO — after G8/G9/G10 closure', color: 'text-zion-cyan' },
                    ].map((item, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[21px] sm:-left-[25px] top-1.5 w-3 h-3 rounded-full border-2 ${item.done ? 'bg-zion-cyan border-zion-cyan' : item.active ? 'bg-zion-cyan border-zion-cyan shadow-[0_0_12px_var(--color-cyan-400)]' : 'bg-black border-gray-600'}`} />
                        <p className="text-[11px] text-gray-500">{item.date}</p>
                        <p className={`text-sm font-semibold ${item.color ?? 'text-white'}`}>{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="zion-rainbow-sub p-4 sm:p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <h3 className="font-semibold text-white text-base sm:text-lg mb-4 sm:mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-zion-gold" /> Post-Launch Queue — Not Blocking Today</h3>
                  <div className="relative pl-6 sm:pl-8 border-l-2 border-gray-700 space-y-4 sm:space-y-6">
                    {[
                      { date: cs ? 'Po public genesis' : 'After public genesis', title: 'Post-Launch Ops', desc: 'Longer canaries, exchange onboarding, public binaries', color: 'text-white' },
                      { date: cs ? 'Po L1 gate' : 'After L1 gate', title: 'L2 — DEX & DeFi', desc: cs ? 'wZION bridge a další DeFi vrstvy nejsou dnešní launch blockers' : 'wZION bridge and further DeFi layers are not today\'s launch blockers', color: 'text-zion-purple' },
                      { date: cs ? 'Po L1 gate' : 'After L1 gate', title: 'L3 — Warp & AI Native', desc: cs ? 'NCL a AI runtime navazují po stabilním L1 základu' : 'NCL and AI runtime follow after a stable L1 foundation', color: 'text-zion-purple' },
                      { date: '2029+', title: 'L4 — ZION Oasis', desc: 'UE5 World, XP System, Play-to-Mine', color: 'text-zion-purple' },
                      { date: '2030+', title: 'L5 — Free World', desc: cs ? 'Sovereignty, decentralizovaná governance' : 'Sovereignty, decentralized governance', color: 'text-zion-gold' },
                      { date: '2040+', title: 'L6 — ZION Issobella', desc: 'Orbital station, 5% block reward fund', color: 'text-zion-purple' },
                    ].map((item, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] sm:-left-[25px] top-1.5 w-3 h-3 rounded-full border-2 bg-black border-gray-600" />
                        <p className="text-[11px] text-gray-500">{item.date}</p>
                        <p className={`text-sm font-semibold ${item.color}`}>{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Gantt-like chart */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="space-y-3 sm:space-y-4 overflow-x-auto">
                {[
                  { layer: 'L1 Blockchain', period: '2026', phases: 'Genesis · v3.2.0 One Love · G8 Run · Public Launch', color: 'from-zion-cyan to-zion-cyan', width: '48%', offset: '0%' },
                  { layer: 'L2 DEX & DeFi', period: '2026 Q3', phases: 'wZION Bridge · Base Mainnet live', color: 'from-zion-purple to-zion-cyan', width: '22%', offset: '50%' },
                  { layer: 'L3 WARP & AI', period: 'Post-L1', phases: 'WARP Registry · NCL · AI', color: 'from-zion-purple to-zion-purple', width: '22%', offset: '60%' },
                  { layer: 'L4 Oasis', period: '2029+', phases: 'UE5 · Play-to-Mine · Beta', color: 'from-zion-gold to-zion-gold', width: '18%', offset: '68%' },
                  { layer: 'L5 Free World', period: '2030+', phases: 'Governance · Sovereignty', color: 'from-zion-gold to-zion-gold', width: '18%', offset: '72%' },
                  { layer: 'L6 Issobella', period: '2040+', phases: 'Orbital Station · Fund', color: 'from-zion-purple to-zion-purple', width: '12%', offset: '88%' }
                ].map((row) => (
                  <div key={row.layer} className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <div className="w-24 sm:w-28 md:w-36 shrink-0 text-right">
                      <p className="text-xs sm:text-sm font-semibold text-white">{row.layer}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">{row.period}</p>
                    </div>
                    <div className="flex-1 h-8 sm:h-10 rounded-xl bg-white/5 relative overflow-hidden">
                      <div
                        className={`absolute top-0 bottom-0 rounded-xl bg-linear-to-r ${row.color} opacity-60 flex items-center px-2 sm:px-3`}
                        style={{ width: row.width, left: row.offset }}
                      >
                        <span className="text-[9px] sm:text-[11px] text-white font-medium truncate">{row.phases}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 sm:gap-4 mt-2 min-w-0">
                  <div className="w-24 sm:w-28 md:w-36 shrink-0" />
                  <div className="flex-1 flex justify-between text-[8px] sm:text-[10px] text-gray-600 px-1">
                    {['2026 Q1', 'Q2', 'Q3', 'Q4', '2027 Q1', 'Q2', 'Q3', 'Q4', '2028'].map((q) => (
                      <span key={q}>{q}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 8: PRIORITY
           ═══════════════════════════════════════════════ */}
        {activeTab === 'priority' && (
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="zion-rainbow-card p-4 sm:p-6 lg:p-8"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{MissionControlDashboardCopy.priorities[cs ? 'cs' : 'en']}</p>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white flex items-center gap-2 sm:gap-3">
                  <Zap className="h-7 w-7 text-zion-gold" />
                  Launch Priority Map
                </h2>
                <p className="text-sm text-gray-400">{cs ? 'Jedna tabulka pro hotovo, blockers a věci, které dnes nejsou launch gate.' : 'One table for completed items, blockers, and things that are not launch gate today.'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">Prio</th>
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">{cs ? 'Úkol' : 'Task'}</th>
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">{cs ? 'Fáze' : 'Phase'}</th>
                      <th className="text-xs uppercase tracking-[0.3em] text-gray-400 font-medium px-4 py-3">{cs ? 'Stav' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: cs ? 'On-chain reward split 89/5/5/1 — humanitární + Issobella + pool fee' : 'On-chain reward split 89/5/5/1 — humanitarian + Issobella + pool fee', phase: 'RUNTIME', status: 'VERIFIED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'PPLNS payout + confirmation sweep (UTXO fallback)', phase: 'POOL', status: 'VERIFIED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'V31 cutover + premine/coinbase soft-fork (@13100)', phase: 'L1', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'G1 — GPU/rig E2E (>99% accept)', phase: 'MINING', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'G7 — chaos/load tests (10k miners, overload, P2P storm)', phase: 'OPS', status: 'PASSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'G11 — V3→V31 migration (Foundry, CLI, miner TUI)', phase: 'L1/L2', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'E4 — wZION bridge round-trip na Base mainnetu', phase: 'L2', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'G3 — solver network + G2 WARP registry gating', phase: 'L2/L3', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'G4 — public subtree sync s v3-Mainnet', phase: 'DOCS', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'DONE', prioColor: 'text-zion-cyan font-bold', task: 'Public releases v3.2.0 — miner, CLI, Desktop Agent', phase: 'RELEASE', status: 'CLOSED', sColor: 'text-zion-cyan' },
                      { prio: 'BLOCKER', prioColor: 'text-zion-purple font-bold', task: 'G8 — 30-day continuous run (23. 8. — 22. 9. 2026)', phase: 'G8', status: 'RUNNING', sColor: 'text-zion-gold' },
                      { prio: 'BLOCKER', prioColor: 'text-zion-purple font-bold', task: 'F2 — 24h transaction fuzz evidence', phase: 'F2', status: 'RUNNING', sColor: 'text-zion-gold' },
                      { prio: 'BLOCKER', prioColor: 'text-zion-purple font-bold', task: cs ? 'G9 — externí security audit' : 'G9 — external security audit', phase: 'G9', status: 'SCHEDULED', sColor: 'text-zion-gold' },
                      { prio: 'BLOCKER', prioColor: 'text-zion-purple font-bold', task: 'G10 — L5/L6 governance decision', phase: 'G10', status: 'PENDING', sColor: 'text-zion-purple' },
                      { prio: 'NB', prioColor: 'text-zion-cyan font-semibold', task: cs ? 'L2/L3 rozšíření, exchange onboarding a mobile polish' : 'L2/L3 expansion, exchange onboarding, and mobile polish', phase: 'POST-L1', status: 'NOT BLOCKING', sColor: 'text-zion-cyan' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className={`px-4 py-3 rounded-l-lg ${row.prioColor}`}>{row.prio}</td>
                        <td className="px-4 py-3 font-semibold text-white">{row.task}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{row.phase}</td>
                        <td className={`px-4 py-3 rounded-r-lg ${row.sColor}`}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
            </motion.section>
          </div>
        )}

        {/* ══════════════ FOOTER ══════════════ */}
        <div className="text-center text-xs text-gray-600 pt-8 border-t border-white/10">
          ZION TerraNova {SITE_RELEASE_LABEL} · runtime {SITE_RUNTIME_LABEL} · One Love Mainnet · launch countdown · 31 December 2026<br />
          <em>6-layer architecture · operations-first web shell</em><br /><br />
          Last update: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'} · Auto-refresh: 30s
        </div>
      </div>
    </div>
  );
}
