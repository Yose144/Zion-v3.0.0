"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  Cog,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Github,
  Globe,
  HardDrive,
  Layers,
  Monitor,
  Network,
  Pickaxe,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { useLang } from '@/contexts/LanguageContext';
import { SITE_RELEASE_LABEL, SITE_POOL_PRIMARY, SITE_PRIMARY_HOST } from '@/lib/site';

const MiningUnifiedCopy = {
  cpuMining: { cs: `CPU tezba`, en: `CPU Mining` },
  gpuMining: { cs: `GPU tezba`, en: `GPU Mining` },
  poolMining: { cs: `Pool tezba`, en: `Pool Mining` },
  soloMining: { cs: `Solo tezba`, en: `Solo Mining` },
  quickStart: { cs: `Rychly start`, en: `Quick Start` },
  algorithms: { cs: `Algoritmy`, en: `Algorithms` },
  miningGuides: { cs: `Tezebni navody`, en: `Mining Guides` },
  hardware: { cs: `Hardware`, en: `Hardware` },
  nodeSetup: { cs: `Nastaveni nodu`, en: `Node Setup` },
  createWallet: { cs: `Vytvorte penezenku`, en: `Create Wallet` },
  startMining: { cs: `Spustte tezbu`, en: `Start Mining` },
  checkBalance: { cs: `Zkontrolujte zustatek`, en: `Check Balance` },
  disk: { cs: `Disk`, en: `Disk` },
  network: { cs: `Sit`, en: `Network` },
  miningNodeGuide: { cs: `Pruvodce tezbou a nodem`, en: `Mining & Node Guide` },
  cpuGpuPoolSolo: { cs: `CPU / GPU / Pool / Solo tezba`, en: `CPU / GPU / Pool / Solo` },
  everythingYouNeedFromFirstWall: { cs: `Vse, co potrebujete - od prvni penezenky az po vlastni full node. Nativni Rust binarky pro Linux x86_64, macOS a Windows z GitHub Releases. ARM64 build ze zdroju.`, en: `Everything you need — from first wallet to running a full node. Native Rust binaries for Linux x86_64, macOS, and Windows from GitHub Releases. ARM64: build from source.` },
  downloadBinaries: { cs: `Stahnout binarky`, en: `Download Binaries` },
  githubReleases: { cs: `GitHub Releases`, en: `GitHub Releases` },
  poolDashboard: { cs: `Pool dashboard`, en: `Pool Dashboard` },
  quickStart3Steps: { cs: `Rychly start - 3 kroky`, en: `Quick Start — 3 Steps` },
  fromZeroToMiningInUnder5Minute: { cs: `Od nuly ke spustene tezbe za mene nez 5 minut.`, en: `From zero to mining in under 5 minutes.` },
  quickInstallLinuxX8664: { cs: `Rychla instalace (Linux x86_64)`, en: `Quick install (Linux x86_64)` },
  zionCliIsAUnifiedBinaryMinerNo: { cs: `ZION CLI je unifikovaná binárka — miner, node, wallet, pool, bridge, dao jsou subpříkazy. Nebo stahnte zion-all pro všechny binárky.`, en: `ZION CLI is a unified binary — miner, node, wallet, pool, bridge, dao are subcommands. Or download zion-all for all binaries.` },
  supportedAlgorithms: { cs: `Podporovane algoritmy`, en: `Supported Algorithms` },
  ekamDeekshaIsADualAlgoPowConse: { cs: `Ekam Deeksha je dual-algo PoW konsensus: BLAKE3 (primarni, rychly, ASIC-resistant) + RandomNPU (sekundarni, GPU NPU kernel). Obe bezi na CPU i GPU. Algoritmus pouziva 256 KiB scratchpad s nahodnymi cteni pro memory-hardness.`, en: `Ekam Deeksha is a dual-algo PoW consensus: BLAKE3 (primary, fast, ASIC-resistant) + RandomNPU (secondary, GPU NPU kernel). Both run on CPU and GPU. The algorithm uses a 256 KiB scratchpad with random reads for memory-hardness.` },
  algorithm: { cs: `Algoritmus`, en: `Algorithm` },
  type: { cs: `Typ`, en: `Type` },
  memory: { cs: `Pamet`, en: `Memory` },
  bestFor: { cs: `Vhodne pro`, en: `Best For` },
  stepByStepForAnyHardwareFromRa: { cs: `Krok za krokem pro jakykoli hardware - od Raspberry Pi po GPU rig.`, en: `Step-by-step for any hardware — from Raspberry Pi to a GPU rig.` },
  cpuMiningWithZionNativeMiner: { cs: `CPU tezba se ZION Native Minerem`, en: `CPU Mining with ZION Native Miner` },
  worksOnAnyX8664OrArm64CpuAlgor: { cs: `Funguje na libovolnem x86_64 nebo ARM64 CPU. Algoritmus:`, en: `Works on any x86_64 or ARM64 CPU. Algorithm:` },
  primaryHashLowMemoryFast: { cs: `(primarni hash, nizka pamet, rychly).`, en: `(primary hash, low memory, fast).` },
  optionAPreCompiledBinaryRecomm: { cs: `Moznost A - predkompilovana binarka (doporuceno)`, en: `Option A — Pre-compiled binary (recommended)` },
  optionBBuildFromSource: { cs: `Moznost B - build ze zdroje`, en: `Option B — Build from source` },
  startMiningPool: { cs: `Spusteni tezby (pool)`, en: `Start mining (pool)` },
  ekamDeekshaBlake3IsFastAndLowM: { cs: `Ekam Deeksha BLAKE3 je rychly a nizko-pametovy — funguje i na slabych CPU`, en: `Ekam Deeksha BLAKE3 is fast and low-memory — works on weak CPUs too` },
  leave12CoresFreeForSystemIfMin: { cs: `Nechte 1-2 jadra volna pro system pri tezbe 24/7`, en: `Leave 1–2 cores free for system if mining 24/7` },
  monitorTemperatureKeepBelow85C: { cs: `Sledujte teplotu: drzte pod 85°C`, en: `Monitor temperature: keep below 85°C` },
  arm64RaspberryPi45BuildFromSou: { cs: `ARM64 (Raspberry Pi 4/5): build ze zdroje, BLAKE3 bezi efektivne`, en: `ARM64 (Raspberry Pi 4/5): build from source, BLAKE3 runs efficiently` },
  gpuMiningMetalCudaOpencl: { cs: `GPU tezba - Metal, CUDA a OpenCL`, en: `GPU Mining — Metal, CUDA & OpenCL` },
  appleMetalM1M4NvidiaCudaGtxRtx: { cs: `Apple Metal (M1-M4), NVIDIA CUDA (GTX/RTX), AMD OpenCL (RX/Vega). Ekam Deeksha dual-algo: BLAKE3 + RandomNPU kernel.`, en: `Apple Metal (M1–M4), NVIDIA CUDA (GTX/RTX), AMD OpenCL (RX/Vega). Ekam Deeksha dual-algo: BLAKE3 + RandomNPU kernel.` },
  ekamDeekshaUses256KibScratchpa: { cs: `Ekam Deeksha pouziva 256 KiB scratchpad s nahodnymi cteni — memory-hard, ASIC-resistant`, en: `Ekam Deeksha uses 256 KiB scratchpad with random reads — memory-hard, ASIC-resistant` },
  blake3HashIsPrimaryFastRandomn: { cs: `BLAKE3 hash je primarni (rychly), RandomNPU kernel je sekundarni (GPU-optimalizovany)`, en: `BLAKE3 hash is primary (fast), RandomNPU kernel is secondary (GPU-optimized)` },
  undervoltFor2030PowerSaving: { cs: `Undervolt pro 20-30 % uspory energie`, en: `Undervolt for 20–30% power saving` },
  keepGpu80CVram95C: { cs: `Drzte GPU pod 80°C a VRAM pod 95°C`, en: `Keep GPU < 80°C, VRAM < 95°C` },
  forDesktopUseWhileMining: { cs: `pro soubezne pouziti desktopu pri tezbe`, en: `for desktop use while mining` },
  benchmark: { cs: `Benchmark: `, en: `Benchmark: ` },
  poolMiningSteadyRewards: { cs: `Pool tezba - stabilni odmeny`, en: `Pool Mining — Steady Rewards` },
  combinesHashrateFromManyMiners: { cs: `Spojuje hashrate vice mineru pro caste a predvidatelne payouty. Nejlepsi volba pro vetsinu mineru.`, en: `Combines hashrate from many miners for frequent, predictable payouts. Best for most miners.` },
  zionOfficialPoolEndpoints: { cs: `Oficialni ZION pool endpointy`, en: `ZION Official Pool Endpoints` },
  quickStartPoolMining: { cs: `Rychly start - pool tezba`, en: `Quick start — Pool mining` },
  fee: { cs: `Fee`, en: `Fee` },
  lowestInClass: { cs: `Jedna z nejnižších v třídě`, en: `Lowest in class` },
  payout: { cs: `Payout`, en: `Payout` },
  payPerLastNShares: { cs: `Pay-per-last-N-shares`, en: `Pay-per-last-N-shares` },
  minPayout: { cs: `Min. payout`, en: `Min Payout` },
  automaticTransfer: { cs: `Automaticky`, en: `Automatic transfer` },
  interval: { cs: `Interval`, en: `Interval` },
  every2h: { cs: `Kazde 2 h`, en: `Every 2h` },
  whenThresholdMet: { cs: `Po dosazeni prahu`, en: `When threshold met` },
  monitorYourMiner: { cs: `Sledujte sveho minera`, en: `Monitor Your Miner` },
  trackHashrateSharesAndPayoutsO: { cs: `Sledujte hashrate, shares a payouty v `, en: `Track hashrate, shares, and payouts on the ` },
  poolDashboard_2: { cs: `pool dashboardu`, en: `Pool Dashboard` },
  soloMiningFullBlockRewards: { cs: `Solo tezba - plne blokove odmeny`, en: `Solo Mining — Full Block Rewards` },
  mineDirectlyAgainstTheBlockcha: { cs: `Tezte primo proti blockchainu. Ziskavate celou aktualni blokovou odmenu a fees za nalezeny blok, ale payouty jsou mene pravidelne nez u poolu.`, en: `Mine directly against the blockchain. You get the full current block reward and fees when you find a block, but payouts are less frequent than with pool mining.` },
  whoShouldSoloMine: { cs: `Kdo by mel tezit solo?`, en: `Who should solo mine?` },
  recommendedIfYouHaveSignifican: { cs: `Doporuceno, pokud mate vyznamny hashrate (>10 % site). Jinak dava pool tezba stabilnejsi payouty.`, en: `Recommended if you have significant hashrate (>10% of network). Otherwise, pool mining gives more consistent payouts.` },
  step2MineAgainstYourNode: { cs: `Krok 2 - tezba proti vlastnimu nodu`, en: `Step 2 — Mine against your node` },
  pros: { cs: `Vyhody`, en: `Pros` },
  fullCurrentBlockRewardFees: { cs: `Plna aktualni blokova odmena + fees`, en: `Full current block reward + fees` },
  noPoolFees: { cs: `Bez pool fee`, en: `No pool fees` },
  maximumDecentralization: { cs: `Maximalni decentralizace`, en: `Maximum decentralization` },
  privacyNoPoolKnowsYourAddress: { cs: `Soukromi - zadny pool nezna vasu adresu`, en: `Privacy — no pool knows your address` },
  cons: { cs: `Nevyhody`, en: `Cons` },
  irregularPayoutsLuckBased: { cs: `Nepravidelne payouty (zalozene na stesti)`, en: `Irregular payouts (luck-based)` },
  needToRunAFullNode: { cs: `Nutnost provozovat full node`, en: `Need to run a full node` },
  highVarianceWithLowHashrate: { cs: `Vysoka variance pri nizkem hashratu`, en: `High variance with low hashrate` },
  noPartialShareRewards: { cs: `Zadne dilci share odmeny`, en: `No partial share rewards` },
  hardwareComparison: { cs: `Srovnani hardwaru`, en: `Hardware Comparison` },
  realEkamDeekshaBenchmarksBlake: { cs: `Realne benchmarky Ekam Deeksha (BLAKE3 + RandomNPU) — commit 9e307c4d, TPB=48, --use_fast_math.`, en: `Real Ekam Deeksha benchmarks (BLAKE3 + RandomNPU) — commit 9e307c4d, TPB=48, --use_fast_math.` },
  power: { cs: `Spotreba`, en: `Power` },
  efficiency: { cs: `Efektivita`, en: `Efficiency` },
  runAFullNode: { cs: `Spustte full node`, en: `Run a Full Node` },
  strengthenTheNetworkByValidati: { cs: `Posilte sit validaci transakci a relayem bloku. Z nuly do synchronizace asi za 10 minut - bez specialniho hardwaru.`, en: `Strengthen the network by validating transactions and relaying blocks. 10 minutes from zero to synced — no special hardware required.` },
  systemRequirements: { cs: `Systemove pozadavky`, en: `System Requirements` },
  installation: { cs: `Instalace`, en: `Installation` },
  preCompiledBinaryRecommended: { cs: `Predkompilovana binarka (doporuceno)`, en: `Pre-compiled Binary (recommended)` },
  buildFromSource: { cs: `Build ze zdrojoveho kodu`, en: `Build from Source` },
  zionCliUnifiedBinary: { cs: `ZION CLI (unifikovaná binárka)`, en: `ZION CLI (unified binary)` },
  networkConfiguration: { cs: `Sitova konfigurace`, en: `Network Configuration` },
  config: { cs: `config`, en: `config` },
  portsFirewall: { cs: `Porty a firewall`, en: `Ports & Firewall` },
  protocol: { cs: `Protokol`, en: `Protocol` },
  purpose: { cs: `Ucel`, en: `Purpose` },
  required: { cs: `Povinne`, en: `Required` },
  optional: { cs: `Volitelne`, en: `Optional` },
  nodeCliReference: { cs: `Reference pro Node CLI`, en: `Node CLI Reference` },
  verifyYourNode: { cs: `Overte svuj node`, en: `Verify Your Node` },
  successCriteria: { cs: `Kriteria uspechu`, en: `Success criteria` },
  blockHeightMatches: { cs: `Vyska bloku odpovida `, en: `Block height matches ` },
  explorer: { cs: `Exploreru`, en: `Explorer` },
  k2PeersConnected: { cs: `2+ pripojene peery`, en: `2+ peers connected` },
  newBlocksEvery60Seconds: { cs: `Nove bloky kazdych asi 60 sekund`, en: `New blocks every ~60 seconds` },
  rpcRespondsToQueries: { cs: `RPC odpovida na dotazy`, en: `RPC responds to queries` },
  faqTroubleshooting: { cs: `FAQ a troubleshooting`, en: `FAQ & Troubleshooting` },
  readyToMineZion: { cs: `Pripraveni tezit ZION?`, en: `Ready to mine ZION?` },
  joinTheCommunityEveryHashStren: { cs: `Pripojte se ke komunite. Kazdy hash posiluje sit.`, en: `Join the community. Every hash strengthens the network.` },
  explorer_2: { cs: `Explorer`, en: `Explorer` },
};

/* ═══════════════════════════════════════════════════════════
   SHARED HELPERS
   ═══════════════════════════════════════════════════════════ */

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      {title && (
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
          {title}
        </div>
      )}
      <pre className="bg-black/60 border border-white/10 rounded-xl p-4 pr-12 text-sm text-zion-cyan/80 font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-white/70 transition-all"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-28" />;
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const GH_REPO = "https://github.com/Zion-TerraNova/v3-Mainnet";
const GH_RELEASES_PAGE = `${GH_REPO}/releases`;
const POOL = SITE_PRIMARY_HOST;

/* ── Algorithms ── */
const algorithms = [
  {
    name: "Ekam Deeksha — BLAKE3",
    type: "CPU + GPU",
    memory: "Low",
    bestFor: "Primary PoW hash — fast, ASIC-resistant",
    stratum: `stratum+tcp://${POOL}:8444`,
  },
  {
    name: "Ekam Deeksha — RandomNPU",
    type: "GPU",
    memory: "VRAM-dependent",
    bestFor: "Secondary PoW hash — NPU kernel, GPU-optimized",
    stratum: `stratum+tcp://${POOL}:8444`,
  },
];

/* ── Mining guide tabs ── */
type GuideTab = "cpu" | "gpu" | "pool" | "solo";

const guideTabs: {
  id: GuideTab;
  label: string;
  icon: typeof Cpu;
  color: string;
}[] = [
  { id: "cpu", label: "CPU Mining", icon: Cpu, color: "text-zion-cyan" },
  { id: "gpu", label: "GPU Mining", icon: Monitor, color: "text-zion-gold" },
  { id: "pool", label: "Pool Mining", icon: Users, color: "text-zion-purple" },
  {
    id: "solo",
    label: "Solo Mining",
    icon: Sparkles,
    color: "text-emerald-400",
  },
];

/* ── Hardware comparison (real Ekam Deeksha benchmarks) ── */
const hardware = [
  { hw: "GTX 1060 3GB", hr: "5.9 KH/s", power: "120W", eff: "49 H/W" },
  { hw: "GTX 1080 8GB", hr: "9.5 KH/s", power: "180W", eff: "53 H/W" },
  { hw: "AMD RX 5600 XT", hr: "10.0 KH/s", power: "150W", eff: "67 H/W" },
  { hw: "AMD RX 5700 XT", hr: "19.25 KH/s", power: "225W", eff: "86 H/W" },
  { hw: "RTX 3060 12GB", hr: "16.5 KH/s", power: "170W", eff: "97 H/W" },
  { hw: "RTX 5070 Ti 16GB", hr: "21.0 KH/s", power: "270W", eff: "78 H/W" },
  { hw: "A100 SXM4 40GB", hr: "38.5 KH/s", power: "400W", eff: "96 H/W" },
  { hw: "H100 SXM 80GB", hr: "81.7 KH/s", power: "700W", eff: "117 H/W" },
];

/* ── Node setup data ── */
const nodeRequirements = [
  { icon: Cpu, label: "CPU", value: "2+ cores (ARM64 or x86_64)", color: "text-zion-cyan" },
  { icon: HardDrive, label: "RAM", value: "4 GB minimum (8 GB rec.)", color: "text-zion-gold" },
  { icon: Database, label: "Disk", value: "20 GB SSD (grows ~2 GB/yr)", color: "text-zion-purple" },
  { icon: Wifi, label: "Network", value: "Stable broadband, 10 Mbps+", color: "text-emerald-400" },
  { icon: Monitor, label: "OS", value: "Linux, macOS, Windows (WSL2)", color: "text-blue-400" },
];

const ports = [
  { port: "8333", protocol: "TCP", purpose: "P2P peer-to-peer", required: true },
  { port: "8443", protocol: "TCP", purpose: "JSON-RPC API", required: false },
  { port: "8444", protocol: "TCP", purpose: "Stratum mining", required: false },
  { port: "8080", protocol: "TCP", purpose: "Pool API", required: false },
];

const networkConfigs = [
  { name: "Mainnet", file: "mainnet.toml", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", description: "Mainnet Beta — live since July 2026" },
  { name: "Testnet", file: "testnet.toml", badge: "bg-zion-gold/10 text-zion-gold border-zion-gold/20", description: "Testing with free test coins" },
  { name: "Devnet", file: "devnet.toml", badge: "bg-zion-purple/10 text-zion-purple border-zion-purple/20", description: "Local development network" },
];

const cliCommands = [
  { cmd: "zion node status", desc: "Check node status" },
  { cmd: "zion --version", desc: "Check installed version" },
  { cmd: "zion node start --network mainnet", desc: "Start mainnet node" },
  { cmd: `zion node start --peers ${POOL}:8333`, desc: "Start with manual peer list" },
  { cmd: "zion node start --log-level debug", desc: "Verbose logging" },
  { cmd: "zion node start --data-dir /custom/path", desc: "Custom data directory" },
];

/* ── In-page nav ── */
const sections = [
  { id: "quick-start", label: "Quick Start" },
  { id: "algorithms", label: "Algorithms" },
  { id: "guides", label: "Mining Guides" },
  { id: "hardware", label: "Hardware" },
  { id: "node-setup", label: "Node Setup" },
  { id: "faq", label: "FAQ" },
];

/* ── FAQ ── */
const faqItems = [
  { q: "Do I need a Node to mine?", a: `No. Connect your miner to the public pool (${SITE_POOL_PRIMARY}). The pool handles blockchain communication. A node is only needed for solo mining or if you want to verify transactions yourself.` },
  { q: "Windows Defender blocks the binary?", a: 'Click "More info" → "Run anyway". The binaries are open-source (MIT license) but unsigned. You can also add C:\\ZION\\ to exclusions in Windows Security.' },
  { q: "macOS says 'cannot be opened'?", a: "Run: xattr -d com.apple.quarantine zion-miner — or go to System Settings → Privacy & Security → Allow Anyway." },
  { q: "What is Ekam Deeksha?", a: "Ekam Deeksha is ZION's dual-algo PoW consensus: BLAKE3 (primary, fast, ASIC-resistant) + RandomNPU (secondary, GPU-optimized NPU kernel). Both run on CPU and GPU. The algorithm uses a 256 KiB scratchpad with random reads for memory-hardness." },
  { q: "Node won't start / No peers connecting?", a: `Check Rust ≥ 1.75 (rustc --version). Ensure port 8333 is free (lsof -i :8333). Verify firewall allows TCP 8333. Try manual peers: --peers ${SITE_PRIMARY_HOST}:8333.` },
  { q: "Can I mine on Raspberry Pi?", a: "Yes! Build from source for linux-arm64. RPi 4/5 works well for CPU mining with the BLAKE3 hash." },
  { q: "Where are the binaries?", a: "Latest release: v3.0.6-beta Triple Stream Miner (Linux x86_64, GPU+CPU). For macOS (Apple Silicon + Intel) and Windows x86_64 use v3.0.5-beta Community CLI. For ARM64 (Raspberry Pi), build from source: git clone https://github.com/Zion-TerraNova/v3-Mainnet.git && cargo build --release -p zion-public" },
];

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function MiningUnifiedClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [activeTab, setActiveTab] = useState<GuideTab>("cpu");
  const [activeNetwork, setActiveNetwork] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const guideTabLabels: Record<GuideTab, string> = {
    cpu: MiningUnifiedCopy.cpuMining[cs ? 'cs' : 'en'],
    gpu: MiningUnifiedCopy.gpuMining[cs ? 'cs' : 'en'],
    pool: MiningUnifiedCopy.poolMining[cs ? 'cs' : 'en'],
    solo: MiningUnifiedCopy.soloMining[cs ? 'cs' : 'en'],
  };

  const sectionLabels: Record<string, string> = {
    'quick-start': MiningUnifiedCopy.quickStart[cs ? 'cs' : 'en'],
    algorithms: MiningUnifiedCopy.algorithms[cs ? 'cs' : 'en'],
    guides: MiningUnifiedCopy.miningGuides[cs ? 'cs' : 'en'],
    hardware: MiningUnifiedCopy.hardware[cs ? 'cs' : 'en'],
    'node-setup': MiningUnifiedCopy.nodeSetup[cs ? 'cs' : 'en'],
    faq: 'FAQ',
  };

  const algorithmsView = algorithms.map((algo, index) => ({
    ...algo,
    type:
      index === 0
        ? 'CPU + GPU'
        : 'GPU',
    bestFor: cs
      ? [
          'Primarni PoW hash — rychly, ASIC-resistant',
          'Sekundarni PoW hash — NPU kernel, GPU-optimalizovany',
        ][index]
      : algo.bestFor,
  }));

  const quickStartSteps = [
    {
      step: '1',
      title: MiningUnifiedCopy.createWallet[cs ? 'cs' : 'en'],
      color: 'text-zion-cyan border-zion-cyan/20 bg-zion-cyan/10',
      items: cs
        ? [
            'Stahnete ZION CLI z GitHub Releases (Linux, macOS, Windows)',
            'Spustte: zion wallet new --mnemonic --out my-wallet.json --print',
            'Zapiste si 24 slov na papir jako zalohu',
          ]
        : [
            'Download ZION CLI from GitHub Releases (Linux, macOS, Windows)',
            'Run: zion wallet new --mnemonic --out my-wallet.json --print',
            'Write down 24 words on paper — your backup!',
          ],
    },
    {
      step: '2',
      title: MiningUnifiedCopy.startMining[cs ? 'cs' : 'en'],
      color: 'text-zion-gold border-zion-gold/20 bg-zion-gold/10',
      items: cs
        ? [
            'Stahnte zion-miner z GitHub Releases nebo pouzijte zion-all',
            `Spustte: zion mine start --pool stratum+tcp://${POOL}:8444 --wallet YOUR_ADDRESS`,
            'Sledujte hashrate a prijate shares',
          ]
        : [
            'Download zion-miner from GitHub Releases or use zion-all',
            `Run: zion mine start --pool stratum+tcp://${POOL}:8444 --wallet YOUR_ADDRESS`,
            'Watch hashrate & accepted shares',
          ],
    },
    {
      step: '3',
      title: MiningUnifiedCopy.checkBalance[cs ? 'cs' : 'en'],
      color: 'text-zion-purple border-zion-purple/20 bg-zion-purple/10',
      items: cs
        ? [
            'Spustte: zion wallet balance --address YOUR_ADDRESS',
            'Otevrete Explorer na zionterranova.com/explorer',
            'Odeslani: zion wallet send --to RECIPIENT --amount 100',
          ]
        : [
            'Run: zion wallet balance --address YOUR_ADDRESS',
            'Visit Explorer at zionterranova.com/explorer',
            'Send: zion wallet send --to RECIPIENT --amount 100',
          ],
    },
  ];

  const nodeRequirementsView = [
    { ...nodeRequirements[0], value: cs ? '2+ jadra (ARM64 nebo x86_64)' : nodeRequirements[0].value },
    { ...nodeRequirements[1], label: 'RAM', value: cs ? '4 GB minimum (8 GB doporuceno)' : nodeRequirements[1].value },
    { ...nodeRequirements[2], label: MiningUnifiedCopy.disk[cs ? 'cs' : 'en'], value: cs ? '20 GB SSD (roste asi 2 GB/rok)' : nodeRequirements[2].value },
    { ...nodeRequirements[3], label: MiningUnifiedCopy.network[cs ? 'cs' : 'en'], value: cs ? 'Stabilni broadband, 10 Mbps+' : nodeRequirements[3].value },
    { ...nodeRequirements[4], label: 'OS', value: cs ? 'Linux, macOS, Windows (WSL2)' : nodeRequirements[4].value },
  ];

  const networkConfigsView = networkConfigs.map((net, index) => ({
    ...net,
    description: cs
      ? [
          'Mainnet Beta — live od cervence 2026',
          'Testovani s bezplatnymi test coinami',
          'Lokalni vyvojova sit',
        ][index]
      : net.description,
  }));

  const portsView = ports.map((port, index) => ({
    ...port,
    purpose: cs
      ? ['P2P komunikace mezi peery', 'JSON-RPC API', 'Stratum tezba', 'Pool API'][index]
      : port.purpose,
  }));

  const cliCommandsView = cliCommands.map((command, index) => ({
    ...command,
    desc: cs
      ? [
          'Kontrola nainstalovane verze',
          'Spusteni s config souborem',
          'Prepsani RPC portu',
          'Manualni seznam peeru',
          'Podrobne logovani',
          'Vlastni datovy adresar',
        ][index]
      : command.desc,
  }));

  const faqItemsView = cs
    ? [
        { q: 'Potrebuji pro tezbu node?', a: `Ne. Pripojte miner do verejneho poolu (${SITE_POOL_PRIMARY}). Pool zajistuje komunikaci s blockchainem. Node je potreba jen pro solo tezbu nebo pokud chcete transakce overovat sami.` },
        { q: 'Windows Defender blokuje binarku?', a: 'Kliknete na "More info" a potom "Run anyway". Binarky jsou open-source (MIT), ale nepodepsane. Pripadne pridejte C:\\ZION\\ do vyjimek ve Windows Security.' },
        { q: 'macOS hlasi, ze aplikaci nelze otevrit?', a: 'Spustte: xattr -d com.apple.quarantine zion-miner nebo v System Settings → Privacy & Security zvolte Allow Anyway.' },
        { q: 'Co je Ekam Deeksha?', a: 'Ekam Deeksha je dual-algo PoW konsensus ZIONu: BLAKE3 (primarni, rychly, ASIC-resistant) + RandomNPU (sekundarni, GPU NPU kernel). Obe bezi na CPU i GPU. Algoritmus pouziva 256 KiB scratchpad s nahodnymi cteni pro memory-hardness.' },
        { q: 'Node se nespusti / nepripojuji se peery?', a: `Zkontrolujte Rust ≥ 1.75 (rustc --version). Ujistete se, ze port 8333 je volny (lsof -i :8333). Overte firewall pro TCP 8333. Zkuste manualni peery: --peers ${SITE_PRIMARY_HOST}:8333.` },
        { q: 'Muzu tezit na Raspberry Pi?', a: 'Ano. Build ze zdroje pro linux-arm64. RPi 4/5 funguje dobre pro CPU tezbu s BLAKE3 hashem.' },
        { q: 'Kde jsou binarky?', a: 'Nejnovější release: v3.0.6-beta Triple Stream Miner (Linux x86_64, GPU+CPU). Pro macOS (Apple Silicon + Intel) a Windows x86_64 použij v3.0.5-beta Community CLI. Pro ARM64 (Raspberry Pi) build ze zdroje: git clone https://github.com/Zion-TerraNova/v3-Mainnet.git && cargo build --release' },
      ]
    : faqItems;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-16">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative zion-rainbow-card p-8 md:p-12 overflow-hidden"
          style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          <div className="absolute inset-0 bg-linear-to-br from-zion-gold/5 via-transparent to-zion-purple/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-zion-gold/10 border border-zion-gold/20">
                <Pickaxe className="w-7 h-7 text-zion-gold" />
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-bold text-gradient">
                  {MiningUnifiedCopy.miningNodeGuide[cs ? 'cs' : 'en']}
                </h1>
                <p className="text-white/40 text-sm mt-0.5">
                  {SITE_RELEASE_LABEL} · Ekam Deeksha dual-algo · {MiningUnifiedCopy.cpuGpuPoolSolo[cs ? 'cs' : 'en']}
                </p>
              </div>
            </div>
            <p className="text-white/50 max-w-2xl text-lg mt-4">
              {MiningUnifiedCopy.everythingYouNeedFromFirstWall[cs ? 'cs' : 'en']}
            </p>

            {/* In-page nav */}
            <div className="mt-6 flex flex-wrap gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="px-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  {sectionLabels[s.id] ?? s.label}
                </a>
              ))}
            </div>

            {/* CTA links */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/download"
                className="inline-flex items-center gap-2 rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zion-gold/30 transition-colors"
              >
                <ArrowDownToLine className="h-4 w-4" />
                {MiningUnifiedCopy.downloadBinaries[cs ? 'cs' : 'en']}
              </Link>
              <Link
                href={GH_RELEASES_PAGE}
                target="_blank"
                rel="noreferrer"
                className="zion-rainbow-sub inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <Github className="h-4 w-4" />
                {MiningUnifiedCopy.githubReleases[cs ? 'cs' : 'en']}
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/pool"
                className="zion-rainbow-sub inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <Globe className="h-4 w-4" />
                {MiningUnifiedCopy.poolDashboard[cs ? 'cs' : 'en']}
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ═══════ QUICK START ═══════ */}
        <SectionAnchor id="quick-start" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-zion-gold" />
            {MiningUnifiedCopy.quickStart3Steps[cs ? 'cs' : 'en']}
          </h2>
          <p className="text-white/40 text-sm mb-6">{MiningUnifiedCopy.fromZeroToMiningInUnder5Minute[cs ? 'cs' : 'en']}</p>

          <div className="grid gap-6 md:grid-cols-3">
            {quickStartSteps.map((s) => (
              <div key={s.step} className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border ${s.color}`}>
                  {s.step}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">{s.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {s.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-zion-gold mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* One-line install */}
          <div className="mt-6 zion-rainbow-sub p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">
              {MiningUnifiedCopy.quickInstallLinuxX8664[cs ? 'cs' : 'en']}
            </p>
            <div className="zion-rainbow-sub p-3 bg-black/40 font-mono text-xs text-gray-300 overflow-x-auto" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <span className="text-gray-500">$</span>{" "}
              wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
            </div>
            <div className="zion-rainbow-sub p-3 bg-black/40 font-mono text-xs text-gray-300 overflow-x-auto mt-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <span className="text-gray-500">$</span>{" "}
              tar xzf zion-miner-linux-x86_64.tar.gz && chmod +x zion-miner && ./zion-miner --version
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {MiningUnifiedCopy.zionCliIsAUnifiedBinaryMinerNo[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══════ ALGORITHMS ═══════ */}
        <SectionAnchor id="algorithms" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Layers className="w-6 h-6 text-zion-purple" />
            {MiningUnifiedCopy.supportedAlgorithms[cs ? 'cs' : 'en']}
          </h2>
          <p className="text-white/40 text-sm mb-5">
            {MiningUnifiedCopy.ekamDeekshaIsADualAlgoPowConse[cs ? 'cs' : 'en']}
          </p>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="grid grid-cols-[1fr_80px_80px_1fr] gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02] hidden md:grid">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.algorithm[cs ? 'cs' : 'en']}</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.type[cs ? 'cs' : 'en']}</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.memory[cs ? 'cs' : 'en']}</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.bestFor[cs ? 'cs' : 'en']}</span>
            </div>
            {algorithmsView.map((algo, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_1fr] gap-2 px-6 py-4 border-b border-white/[0.04] last:border-0"
              >
                <div>
                  <span className="text-sm font-medium text-white/80">{algo.name}</span>
                  <span className="block text-[10px] text-zion-cyan/60 font-mono mt-0.5">
                    {algo.stratum}
                  </span>
                </div>
                <span className="text-sm text-white/50 hidden md:block">{algo.type}</span>
                <span className="text-sm text-white/50 hidden md:block">{algo.memory}</span>
                <span className="text-sm text-white/40">{algo.bestFor}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ MINING GUIDES (tabs) ═══════ */}
        <SectionAnchor id="guides" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-zion-gold" />
            {MiningUnifiedCopy.miningGuides[cs ? 'cs' : 'en']}
          </h2>
          <p className="text-white/40 text-sm mb-5">
            {MiningUnifiedCopy.stepByStepForAnyHardwareFromRa[cs ? 'cs' : 'en']}
          </p>

          {/* Tab selector */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {guideTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "zion-rainbow-sub border-zion-gold text-zion-gold font-medium"
                    : "bg-black/60 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/60"
                }`}
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ""}`}
                />
                {guideTabLabels[tab.id]}
              </button>
            ))}
          </div>

          {/* ── CPU Mining ── */}
          {activeTab === "cpu" && (
            <motion.div key="cpu" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-zion-cyan" />
                  {MiningUnifiedCopy.cpuMiningWithZionNativeMiner[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  {MiningUnifiedCopy.worksOnAnyX8664OrArm64CpuAlgor[cs ? 'cs' : 'en']}{" "}
                  <strong className="text-white/60">Ekam Deeksha — BLAKE3</strong>{" "}
                  {MiningUnifiedCopy.primaryHashLowMemoryFast[cs ? 'cs' : 'en']}
                </p>
                <div className="space-y-4">
                  <CodeBlock
                    title={MiningUnifiedCopy.optionAPreCompiledBinaryRecomm[cs ? 'cs' : 'en']}
                    code={`# Download ZION CLI from GitHub Releases (Linux, macOS, Windows)
# → https://github.com/Zion-TerraNova/v3-Mainnet/releases

wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner
./zion-miner --version`}
                  />
                  <CodeBlock
                    title={MiningUnifiedCopy.optionBBuildFromSource[cs ? 'cs' : 'en']}
                    code={`git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public
ls -la target/release/zion-miner`}
                  />
                  <CodeBlock
                    title={MiningUnifiedCopy.startMiningPool[cs ? 'cs' : 'en']}
                    code={`zion mine start \\
  --pool stratum+tcp://${POOL}:8444 \\
  --wallet YOUR_ZION_ADDRESS \\
  --threads $(nproc)`}
                  />
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <h4 className="text-sm font-medium text-zion-cyan mb-2">💡 CPU Tips</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• {MiningUnifiedCopy.ekamDeekshaBlake3IsFastAndLowM[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.leave12CoresFreeForSystemIfMin[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.monitorTemperatureKeepBelow85C[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.arm64RaspberryPi45BuildFromSou[cs ? 'cs' : 'en']}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── GPU Mining ── */}
          {activeTab === "gpu" && (
            <motion.div key="gpu" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-zion-gold" />
                  {MiningUnifiedCopy.gpuMiningMetalCudaOpencl[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  {MiningUnifiedCopy.appleMetalM1M4NvidiaCudaGtxRtx[cs ? 'cs' : 'en']}
                </p>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-white/50">Apple Silicon</span>
                    <h4 className="text-sm font-medium text-white/80">Metal (macOS)</h4>
                  </div>
                  <CodeBlock
                    code={`# Build from source with Metal backend
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public --features metal

./target/release/zion-miner \\
  --pool stratum+tcp://${POOL}:8444 \\
  --wallet YOUR_ZION_ADDRESS \\
  --gpu metal --gpu-intensity 80`}
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">NVIDIA</span>
                    <h4 className="text-sm font-medium text-white/80">CUDA (Linux/Windows)</h4>
                  </div>
                  <CodeBlock
                    code={`# Requires NVIDIA Driver ≥ 535 + CUDA ≥ 12.0
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public --features cuda

./target/release/zion-miner \\
  --pool stratum+tcp://${POOL}:8444 \\
  --wallet YOUR_ZION_ADDRESS \\
  --gpu cuda --gpu-devices 0,1`}
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">AMD</span>
                    <h4 className="text-sm font-medium text-white/80">OpenCL (Linux/Windows)</h4>
                  </div>
                  <CodeBlock
                    code={`# Requires AMD ROCm ≥ 5.0 or AMDGPU-PRO
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public --features gpu-opencl

./target/release/zion-miner \\
  --pool stratum+tcp://${POOL}:8444 \\
  --wallet YOUR_ZION_ADDRESS \\
  --gpu opencl`}
                  />
                </div>

                <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <h4 className="text-sm font-medium text-zion-gold mb-2">⚡ GPU Tips</h4>
                  <ul className="text-sm text-white/40 space-y-1">
                    <li>• {MiningUnifiedCopy.ekamDeekshaUses256KibScratchpa[cs ? 'cs' : 'en']}</li>
                    <li>• {MiningUnifiedCopy.blake3HashIsPrimaryFastRandomn[cs ? 'cs' : 'en']}</li>
                    <li>• {MiningUnifiedCopy.undervoltFor2030PowerSaving[cs ? 'cs' : 'en']}</li>
                    <li>• {MiningUnifiedCopy.keepGpu80CVram95C[cs ? 'cs' : 'en']}</li>
                    <li>• <code className="text-zion-gold/60 text-xs">--gpu-intensity 60-80</code> {MiningUnifiedCopy.forDesktopUseWhileMining[cs ? 'cs' : 'en']}</li>
                    <li>• {MiningUnifiedCopy.benchmark[cs ? 'cs' : 'en']}<code className="text-zion-gold/60 text-xs">zion-miner --gpu-benchmark-all</code></li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Pool Mining ── */}
          {activeTab === "pool" && (
            <motion.div key="pool" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-zion-purple" />
                  {MiningUnifiedCopy.poolMiningSteadyRewards[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  {MiningUnifiedCopy.combinesHashrateFromManyMiners[cs ? 'cs' : 'en']}
                </p>

                <div className="zion-rainbow-sub p-5 mb-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <h4 className="text-sm font-medium text-white/60 mb-3">{MiningUnifiedCopy.zionOfficialPoolEndpoints[cs ? 'cs' : 'en']}</h4>
                  <div className="space-y-2">
                    {algorithmsView.map((algo, i) => (
                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-1 py-2 border-b border-white/[0.04] last:border-0">
                        <span className="text-sm text-white/70">{algo.name}</span>
                        <code className="text-xs font-mono text-zion-cyan/70">{algo.stratum}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <CodeBlock
                  title={MiningUnifiedCopy.quickStartPoolMining[cs ? 'cs' : 'en']}
                  code={`zion mine start \\
  --pool stratum+tcp://${POOL}:8444 \\
  --wallet YOUR_ZION_ADDRESS \\
  --worker-name my-rig-01 \\
  --threads $(nproc)`}
                />

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: MiningUnifiedCopy.fee[cs ? 'cs' : 'en'], value: '1%', desc: MiningUnifiedCopy.lowestInClass[cs ? 'cs' : 'en'] },
                    { label: MiningUnifiedCopy.payout[cs ? 'cs' : 'en'], value: 'PPLNS', desc: MiningUnifiedCopy.payPerLastNShares[cs ? 'cs' : 'en'] },
                    { label: MiningUnifiedCopy.minPayout[cs ? 'cs' : 'en'], value: '10 ZION', desc: MiningUnifiedCopy.automaticTransfer[cs ? 'cs' : 'en'] },
                    { label: MiningUnifiedCopy.interval[cs ? 'cs' : 'en'], value: MiningUnifiedCopy.every2h[cs ? 'cs' : 'en'], desc: MiningUnifiedCopy.whenThresholdMet[cs ? 'cs' : 'en'] },
                  ].map((feat, i) => (
                    <div key={i} className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-white/30 uppercase tracking-wider">{feat.label}</span>
                        <span className="text-sm font-medium text-white/80">{feat.value}</span>
                      </div>
                      <span className="text-[11px] text-white/25">{feat.desc}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <h4 className="text-sm font-medium text-zion-purple mb-2">📊 {MiningUnifiedCopy.monitorYourMiner[cs ? 'cs' : 'en']}</h4>
                  <p className="text-sm text-white/40">
                    {MiningUnifiedCopy.trackHashrateSharesAndPayoutsO[cs ? 'cs' : 'en']}
                    <Link href="/pool" className="text-zion-purple underline hover:text-white transition-colors">{MiningUnifiedCopy.poolDashboard_2[cs ? 'cs' : 'en']}</Link>.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Solo Mining ── */}
          {activeTab === "solo" && (
            <motion.div key="solo" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  {MiningUnifiedCopy.soloMiningFullBlockRewards[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  {MiningUnifiedCopy.mineDirectlyAgainstTheBlockcha[cs ? 'cs' : 'en']}
                </p>

                <div className="zion-rainbow-sub p-4 mb-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <h4 className="text-sm font-medium text-amber-400 mb-1">⚠️ {MiningUnifiedCopy.whoShouldSoloMine[cs ? 'cs' : 'en']}</h4>
                  <p className="text-sm text-white/40">
                    {MiningUnifiedCopy.recommendedIfYouHaveSignifican[cs ? 'cs' : 'en']}
                  </p>
                </div>

                <CodeBlock
                  title="Step 1 — Run your own full node"
                  code={`zion node start --network mainnet --rpc-port 8443`}
                />
                <div className="mt-4">
                  <CodeBlock
                    title={MiningUnifiedCopy.step2MineAgainstYourNode[cs ? 'cs' : 'en']}
                    code={`zion mine start \\
  --node http://127.0.0.1:8443 \\
  --wallet YOUR_ZION_ADDRESS \\
  --threads $(nproc) \\
  --solo`}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">✅ {MiningUnifiedCopy.pros[cs ? 'cs' : 'en']}</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• {MiningUnifiedCopy.fullCurrentBlockRewardFees[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.noPoolFees[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.maximumDecentralization[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.privacyNoPoolKnowsYourAddress[cs ? 'cs' : 'en']}</li>
                    </ul>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <h4 className="text-sm font-medium text-red-400 mb-2">❌ {MiningUnifiedCopy.cons[cs ? 'cs' : 'en']}</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• {MiningUnifiedCopy.irregularPayoutsLuckBased[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.needToRunAFullNode[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.highVarianceWithLowHashrate[cs ? 'cs' : 'en']}</li>
                      <li>• {MiningUnifiedCopy.noPartialShareRewards[cs ? 'cs' : 'en']}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.section>

        {/* ═══════ HARDWARE COMPARISON ═══════ */}
        <SectionAnchor id="hardware" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-6 h-6 text-zion-gold" />
            {MiningUnifiedCopy.hardwareComparison[cs ? 'cs' : 'en']}
          </h2>
          <p className="text-white/40 text-sm mb-5">{MiningUnifiedCopy.realEkamDeekshaBenchmarksBlake[cs ? 'cs' : 'en']}</p>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="grid grid-cols-[1fr_100px_80px_100px] gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02] hidden md:grid">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.hardware[cs ? 'cs' : 'en']}</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Hashrate</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.power[cs ? 'cs' : 'en']}</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.efficiency[cs ? 'cs' : 'en']}</span>
            </div>
            {hardware.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-2 md:grid-cols-[1fr_100px_80px_100px] gap-2 px-6 py-3 border-b border-white/[0.04] last:border-0"
              >
                <div>
                  <span className="text-sm text-white/80">{row.hw}</span>
                  <span className="block md:hidden text-[10px] text-white/25 mt-0.5">{row.hr} · {row.power}</span>
                </div>
                <span className="text-sm font-mono text-zion-cyan/70 hidden md:block">{row.hr}</span>
                <span className="text-sm text-white/40 hidden md:block">{row.power}</span>
                <span className="text-sm text-white/50 hidden md:block">{row.eff}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ NODE SETUP ═══════ */}
        <SectionAnchor id="node-setup" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-10"
        >
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Server className="w-6 h-6 text-zion-cyan" />
              {MiningUnifiedCopy.runAFullNode[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-white/50 text-sm">
              {MiningUnifiedCopy.strengthenTheNetworkByValidati[cs ? 'cs' : 'en']}
            </p>
          </div>

          {/* System Requirements */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Cog className="w-5 h-5 text-zion-gold" />
              {MiningUnifiedCopy.systemRequirements[cs ? 'cs' : 'en']}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodeRequirementsView.map((req, i) => (
                <div key={i} className="zion-rainbow-sub p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <div className="flex items-center gap-2 mb-2">
                    <req.icon className={`w-4 h-4 ${req.color}`} />
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">{req.label}</span>
                  </div>
                  <span className="text-sm text-white/80">{req.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Installation */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-zion-cyan" />
              {MiningUnifiedCopy.installation[cs ? 'cs' : 'en']}
            </h3>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-gold/10 border border-zion-gold/20 text-zion-gold text-xs font-bold">1</span>
                <h4 className="text-white font-medium">{MiningUnifiedCopy.preCompiledBinaryRecommended[cs ? 'cs' : 'en']}</h4>
              </div>
              <CodeBlock
                code={`# Download ZION CLI from GitHub Releases (Linux, macOS, Windows)
# → https://github.com/Zion-TerraNova/v3-Mainnet/releases

wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner
./zion-miner --version`}
              />
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-cyan/10 border border-zion-cyan/20 text-zion-cyan text-xs font-bold">2</span>
                <h4 className="text-white font-medium">{MiningUnifiedCopy.buildFromSource[cs ? 'cs' : 'en']}</h4>
              </div>
              <CodeBlock
                code={`git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public
# Binary → target/release/zion`}
              />
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-purple/10 border border-zion-purple/20 text-zion-purple text-xs font-bold">3</span>
                <h4 className="text-white font-medium">{MiningUnifiedCopy.zionCliUnifiedBinary[cs ? 'cs' : 'en']}</h4>
              </div>
              <CodeBlock
                code={`# ZION v3.0.6-beta Triple Stream Miner (Linux x86_64)
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner
./zion-miner --pool ${SITE_POOL_PRIMARY} --wallet zion1YOUR_ADDR --gpu opencl --profile pool`}
              />
            </div>
          </div>

          {/* Network Configuration */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Network className="w-5 h-5 text-zion-purple" />
              {MiningUnifiedCopy.networkConfiguration[cs ? 'cs' : 'en']}
            </h3>

            <div className="flex items-center gap-2 mb-4">
              {networkConfigsView.map((net, i) => (
                <button
                  key={i}
                  onClick={() => setActiveNetwork(i)}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                    activeNetwork === i
                      ? net.badge + " font-medium"
                      : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {net.name}
                </button>
              ))}
            </div>

            <div className="zion-rainbow-sub p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <p className="text-white/50 text-sm mb-4">
                {networkConfigsView[activeNetwork].description} - {MiningUnifiedCopy.config[cs ? 'cs' : 'en']}:{" "}
                <code className="text-zion-cyan/80 bg-zion-cyan/5 px-2 py-0.5 rounded text-xs">
                  config/{networkConfigsView[activeNetwork].file}
                </code>
              </p>
              <CodeBlock
                title={networkConfigsView[activeNetwork].file}
                code={`[network]
name = "${networkConfigs[activeNetwork].name.toLowerCase()}"
p2p_port = 8333
rpc_port = 8443
max_peers = 128

[consensus]
algorithm = "ekam_deeksha"
block_time = 60
difficulty_adjustment = "per-block"

[mining]
stratum_port = 8444
reward_address = "YOUR_ZION_ADDRESS"

[storage]
data_dir = "~/.zion/${networkConfigsView[activeNetwork].name.toLowerCase()}"

[peers]
bootstrap = [
  "${POOL}:8333"
]`}
              />
            </div>
          </div>

          {/* Ports & Firewall */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              {MiningUnifiedCopy.portsFirewall[cs ? 'cs' : 'en']}
            </h3>

            <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
                <span className="text-[11px] text-white/30 uppercase tracking-wider">Port</span>
                <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.protocol[cs ? 'cs' : 'en']}</span>
                <span className="text-[11px] text-white/30 uppercase tracking-wider">{MiningUnifiedCopy.purpose[cs ? 'cs' : 'en']}</span>
                <span className="text-[11px] text-white/30 uppercase tracking-wider text-right">{MiningUnifiedCopy.required[cs ? 'cs' : 'en']}</span>
              </div>
              {portsView.map((p, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-white/[0.04] last:border-0">
                  <span className="font-mono text-sm text-zion-cyan/80">{p.port}</span>
                  <span className="text-sm text-white/50">{p.protocol}</span>
                  <span className="text-sm text-white/70">{p.purpose}</span>
                  <span className="text-right">
                    {p.required ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{MiningUnifiedCopy.required[cs ? 'cs' : 'en']}</span>
                    ) : (
                      <span className="text-[10px] bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">{MiningUnifiedCopy.optional[cs ? 'cs' : 'en']}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <CodeBlock
                title="UFW Firewall (Ubuntu/Debian)"
                code={`sudo ufw allow 8333/tcp comment "ZION P2P"
sudo ufw allow from 127.0.0.1 to any port 8443 proto tcp comment "ZION RPC"
sudo ufw status`}
              />
            </div>
          </div>

          {/* CLI Reference */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-zion-gold" />
              {MiningUnifiedCopy.nodeCliReference[cs ? 'cs' : 'en']}
            </h3>

            <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              {cliCommandsView.map((c, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-6 py-3.5 border-b border-white/[0.04] last:border-0">
                  <code className="text-sm font-mono text-zion-cyan/80 break-all">{c.cmd}</code>
                  <span className="text-xs text-white/30 md:text-right shrink-0">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verify Node */}
          <div className="zion-rainbow-sub p-6 space-y-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-emerald-400" />
              {MiningUnifiedCopy.verifyYourNode[cs ? 'cs' : 'en']}
            </h3>
            <CodeBlock
              title="Check sync status"
              code={`curl -s http://localhost:8443 \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getBlockchainInfo"}' | jq .`}
            />
            <CodeBlock
              title="Check peers"
              code={`curl -s http://localhost:8443 \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getPeerCount"}' | jq .`}
            />
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm text-white/60">
                  <p className="font-medium text-emerald-400 mb-1">{MiningUnifiedCopy.successCriteria[cs ? 'cs' : 'en']}</p>
                  <ul className="space-y-1 text-white/40">
                    <li>• {MiningUnifiedCopy.blockHeightMatches[cs ? 'cs' : 'en']}<Link href="/explorer" className="text-zion-cyan/60 hover:text-zion-cyan underline">{MiningUnifiedCopy.explorer[cs ? 'cs' : 'en']}</Link></li>
                    <li>• {MiningUnifiedCopy.k2PeersConnected[cs ? 'cs' : 'en']}</li>
                    <li>• {MiningUnifiedCopy.newBlocksEvery60Seconds[cs ? 'cs' : 'en']}</li>
                    <li>• {MiningUnifiedCopy.rpcRespondsToQueries[cs ? 'cs' : 'en']}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ FAQ ═══════ */}
        <SectionAnchor id="faq" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-400" />
            {MiningUnifiedCopy.faqTroubleshooting[cs ? 'cs' : 'en']}
          </h2>

          <div className="space-y-3">
            {faqItemsView.map((faq, idx) => (
              <div key={idx} className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm font-semibold text-white/80 pr-4">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-zion-gold shrink-0 transition-transform ${openFaqIndex === idx ? "rotate-180" : ""}`} />
                </button>
                {openFaqIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="zion-cta-banner"
        >
          <Pickaxe className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{MiningUnifiedCopy.readyToMineZion[cs ? 'cs' : 'en']}</h2>
          <p className="mt-4 text-gray-100 max-w-2xl mx-auto">
            {MiningUnifiedCopy.joinTheCommunityEveryHashStren[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-gold/80 px-6 py-3 text-sm font-semibold text-black border border-zion-gold hover:brightness-110 transition-all"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {MiningUnifiedCopy.downloadBinaries[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="/pool"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-purple/70 px-6 py-3 text-sm font-semibold text-white border border-zion-purple"
            >
              <Globe className="h-4 w-4" />
              {MiningUnifiedCopy.poolDashboard[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href={GH_RELEASES_PAGE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              <Github className="h-4 w-4" />
              {MiningUnifiedCopy.githubReleases[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-6 py-3 text-sm font-semibold text-gray-300"
            >
              {MiningUnifiedCopy.explorer_2[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
