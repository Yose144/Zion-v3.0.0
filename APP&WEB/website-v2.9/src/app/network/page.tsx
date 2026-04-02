'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Globe,
  Globe2,
  Layers,
  MapPin,
  Orbit,
  Radio,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import {
  SITE_NETWORK_TOPOLOGY,
  SITE_POOL_PRIMARY,
  SITE_PRIMARY_HOST,
  SITE_PRIMARY_RPC_URL,
  SITE_RELEASE_LABEL,
  SITE_RUNTIME_LABEL,
} from '@/lib/site';

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

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Redesigned to match Roadmap visual language
   ═══════════════════════════════════════════════════════════ */

const getHeroStats = (cs: boolean) => [
  {
    label: cs ? 'Verejne nody' : 'Public Nodes',
    value: '1',
    descriptor: cs ? 'Prazsky verejny host + interni linky USA/Singapur' : 'Prague public host + USA/Singapore internal lanes',
  },
  {
    label: cs ? 'P2P sit' : 'P2P Mesh',
    value: cs ? 'Rizena' : 'Controlled',
    descriptor: cs ? 'Verejny host + interni validacni linky' : 'Public host + internal validator lanes',
  },
  {
    label: cs ? 'Telemetrie' : 'Telemetry',
    value: '30s',
    descriptor: cs ? 'Interval automaticke obnovy' : 'Auto-refresh interval',
  },
  {
    label: cs ? 'Topologie' : 'Topology',
    value: cs ? 'Nacvik' : 'Rehearsal',
    descriptor: cs ? 'Zkusebni test-mainnet topologie ve 3 regionech' : '3-region test-mainnet rehearsal topology',
  },
  {
    label: cs ? 'Sit' : 'Network',
    value: 'V3 Test Mainnet',
    descriptor: cs ? 'Verejna zkusebni linka v2.9.9 · runtime v2.9.8' : 'Public rehearsal line v2.9.9 · runtime v2.9.8',
  },
];

const getInfraFeatures = (cs: boolean) => [
  {
    icon: Server,
    title: cs ? 'Praha (EU)' : 'Prague (EU)',
    detail: cs ? 'Primarni seed node: chain, pool, web, explorer' : 'Primary seed node: chain, pool, web, explorer',
    ip: '91.98.122.165',
    status: cs ? 'Primarni' : 'Primary',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
  {
    icon: Server,
    title: 'USA (Hillsboro)',
    detail: cs ? 'Interni validacni linka: chain, pool' : 'Internal validator lane: chain, pool',
    ip: '5.78.194.94',
    status: cs ? 'Interni' : 'Internal',
    color: 'text-zion-cyan',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
  {
    icon: Server,
    title: 'Singapore (APAC)',
    detail: cs ? 'Interni validacni linka: chain, pool' : 'Internal validator lane: chain, pool',
    ip: '5.223.84.191',
    status: cs ? 'Interni' : 'Internal',
    color: 'text-zion-purple',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
  },
];

const getRuntimePanels = (cs: boolean) => [
  {
    icon: Radio,
    label: cs ? 'Verejny stratum' : 'Public Stratum',
    value: SITE_POOL_PRIMARY,
    detail: cs ? 'Aktualni primarni tezebni vstup na Zion2' : 'Current primary mining ingress on Zion2',
    accent: 'text-zion-gold',
  },
  {
    icon: Terminal,
    label: 'RPC Endpoint',
    value: SITE_PRIMARY_RPC_URL,
    detail: cs ? 'Nativni Rust JSON-RPC pro explorer a tooling' : 'Native Rust JSON-RPC for explorers and tooling',
    accent: 'text-zion-cyan',
  },
  {
    icon: Globe,
    label: 'P2P Peer',
    value: `${SITE_PRIMARY_HOST}:8333`,
    detail: cs ? 'Primarni verejny peer s internimi linkami do USA a Singapuru' : 'Primary public peer with internal lanes to USA + Singapore',
    accent: 'text-emerald-400',
  },
  {
    icon: BookOpen,
    label: cs ? 'Kontext releasu' : 'Release Context',
    value: SITE_RELEASE_LABEL,
    detail: cs
      ? `Verejna linka nad ${SITE_RUNTIME_LABEL}; archivovane nasazeni 2.9.8 zustava v dokumentaci`
      : `Public line over ${SITE_RUNTIME_LABEL}; archived 2.9.8 rollout retained in docs`,
    accent: 'text-zion-purple',
  },
];

const getGuideBlocks = (cs: boolean) => [
  {
    icon: Zap,
    title: cs ? 'Tezba' : 'Mining',
    description: cs ? 'Pripojte jakykoli Cosmic Harmony / CPU miner k aktualnimu verejnemu poolu na Zion2.' : 'Connect any Cosmic Harmony / CPU miner to the current public pool on Zion2.',
    items: [
      `Pool: ${SITE_POOL_PRIMARY} ${cs ? '(aktualni primarni)' : '(current primary)'}`,
      'Wallet: YOUR_ZION_ADDRESS',
      'Password: x',
    ],
  },
  {
    icon: Terminal,
    title: 'RPC API',
    description: cs
      ? 'Nativni Rust JSON-RPC endpoint pro explorer a tooling. Historicka 3-host sit je archivovana v release reportech.'
      : 'Native Rust JSON-RPC endpoint for explorers and tooling. Historical 3-host mesh is archived in release reports.',
    items: [
      `Primary: ${SITE_PRIMARY_RPC_URL}`,
      `Scope: ${cs ? 'verejny runtime endpoint' : 'public runtime endpoint'}`,
      `Archive: ${cs ? 'docs/2.9.8 + breznovy status report' : 'docs/2.9.8 + March status reports'}`,
      'Method: POST',
    ],
  },
  {
    icon: Globe,
    title: cs ? 'P2P vrstva' : 'P2P Layer',
    description: cs ? 'Nativni libp2p sit pro synchronizaci blockchainu na aktualni zkusebni topologii.' : 'Native libp2p network for blockchain synchronization on the current rehearsal topology.',
    items: [
      `${cs ? 'Verejny peer' : 'Public peer'}: ${SITE_PRIMARY_HOST}:8333`,
      `${cs ? 'Interni linky' : 'Internal lanes'}: 5.78.194.94:8333, 5.223.84.191:8333`,
      cs ? '1 verejny host + 2 interni validacni linky' : '1 public host + 2 internal validator lanes',
    ],
  },
];

const getNetworkFacts = (cs: boolean) => [
  { text: cs ? 'Nativni Rust P2P - libp2p sit' : 'Native Rust P2P - libp2p mesh', done: true },
  { text: cs ? '1 verejny host + 2 interni validacni linky' : '1 public host + 2 internal validator lanes', done: true },
  { text: cs ? 'Primarni stratum endpoint v Praze' : 'Primary stratum endpoint on Prague', done: true },
  { text: cs ? 'JSON-RPC endpointy online (port 8443)' : 'JSON-RPC endpoints live (port 8443)', done: true },
  { text: cs ? 'Docker kontejnery 24/7 s auto-restartem' : '24/7 Docker containers with auto-restart', done: true },
  { text: cs ? 'LWMA DAA - cil 60s na blok' : 'LWMA DAA - target 60s block time', done: true },
  { text: cs ? 'Archivovane dukazy o 3-region relay topologii zachovany' : 'Archived 3-region relay evidence retained', done: true },
  { text: cs ? 'Prometheus + Grafana monitoring' : 'Prometheus + Grafana monitoring', done: true },
  { text: cs ? 'Geo-distribuovana zkusebni topologie aktivni' : 'Geo-distributed rehearsal topology active', done: true },
];

export default function NetworkPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const heroStats = getHeroStats(cs);
  const infraFeatures = getInfraFeatures(cs);
  const runtimePanels = getRuntimePanels(cs);
  const guideBlocks = getGuideBlocks(cs);
  const networkFacts = getNetworkFacts(cs);
  const factsDone = networkFacts.filter((f) => f.done).length;
  const factsTotal = networkFacts.length;

  const primaryPool = SITE_POOL_PRIMARY;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Subtle background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ HERO ═══════ */}
        <section className="rounded-3xl md:rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
                <Radio className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? 'Sit' : 'Network'}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'Zivy stav' : 'Live Status'}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'P2P Sit' : 'P2P Network'}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Telemetrie v realnem case z aktualniho verejneho runtime na Zion2. Drivejsi multi-host validace zustava zachovana v archivovanem deployi 2.9.8 a breznovych status reportech, ale uz nepredstavuje zivou topologii.'
                  : 'Real-time telemetry from the current public runtime on Zion2. Earlier multi-host validation remains preserved in archived 2.9.8 deploy and March status reports, but is no longer the live topology.'}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {cs ? 'Nativni Rust' : 'Native Rust'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Runtime: {SITE_RUNTIME_LABEL}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {cs ? '1 verejny host · 2 interni seedy' : '1 Public Host · 2 Internal Seeds'}
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
        </section>

        {/* ═══════ RUNTIME SNAPSHOT ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Runtime prehled' : 'Runtime Snapshot'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Verejny povrch site' : 'Public Network Surface'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Aktualni zivy footprint zredukovany na endpointy a role, ktere operatori potrebuji jako prvni.' : 'The current live footprint distilled to the endpoints and roles operators actually need first.'}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
            {runtimePanels.map((panel) => (
              <div
                key={panel.label}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
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

        {/* ═══════ INFRASTRUCTURE ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Infrastruktura' : 'Infrastructure'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-gold" />
              {cs ? 'Aktualni runtime' : 'Current Runtime'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Aktualni verejny runtime je jeden primarni host. Drivejsi multi-host validace zustava zdokumentovana jako archivovana historie validace.' : 'Current public runtime is a single primary host. Earlier multi-host validation remains documented as archived validation history.'}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-1 lg:max-w-2xl">
            {infraFeatures.map((node) => (
              <div
                key={node.title}
                className={`relative overflow-hidden rounded-3xl border ${node.border} ${node.bg} p-6`}
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
                    <span>{cs ? 'Stratum: port 3333' : 'Stratum: port 3333'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Terminal className="w-3.5 h-3.5 text-gray-500" />
                    <span>RPC: port 8443</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <span>P2P: port 8333</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ LIVE TELEMETRY ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Ziva telemetrie' : 'Live Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? 'Stav nodu' : 'Node Status'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Zdravi, vyska chainu, hashrate a sync stav v realnem case z aktualniho runtime na primarnim hostu.' : 'Real-time health, block height, hashrate, and sync status from the current primary-host runtime.'}</p>
          </div>
          <NetworkStatus className="max-w-none" />
        </section>

        {/* ═══════ MONITORING SNAPSHOT ═══════ */}
        <NetworkMonitoringSnapshot cs={cs} locale={locale} />

        {/* ═══════ NETWORK MAP + POOL FINDER ═══════ */}
        <section>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Geografie' : 'Geography'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Mapa site a vyhledavac poolu' : 'Network Map & Pool Finder'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Vizualizujte aktualni topologii a porovnejte ji s archivovanym multi-host rolloutem zachovanym v release dokumentaci.' : 'Visualize the current topology and compare it with the archived multi-host rollout preserved in release documentation.'}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <NetworkMap />
            </div>
            <PoolFinder />
          </div>
        </section>

        {/* ═══════ CONNECTION GUIDES ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Pripojeni' : 'Connect'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              {cs ? 'Pripojovaci navody' : 'Connection Guides'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Vse, co potrebujete k pripojeni minera, dotazovani RPC API nebo synchronizaci nodu.' : 'Everything you need to connect a miner, query the RPC API, or sync a node.'}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {guideBlocks.map((block) => (
              <div
                key={block.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <block.icon className="h-5 w-5 text-zion-gold" />
                  <h3 className="text-lg font-semibold text-white">{block.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{block.description}</p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-1">
                  {block.items.map((line) => (
                    <code key={line} className="block text-sm font-mono text-zion-gold">{line}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ NETWORK CHECKLIST ═══════ */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Stav' : 'Status'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              {cs ? 'Pripravenost site' : 'Network Readiness'}
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
            <span>{cs ? 'dokonceno' : 'completed'}</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(factsDone / factsTotal) * 100}%` }} />
            </div>
          </div>
        </section>

        {/* ═══════ OPERATOR TOOLKIT ═══════ */}
        <NetworkOperatorToolkit cs={cs} primaryPool={primaryPool} />

        {/* ═══════ CTA ═══════ */}
        <section className="rounded-4xl border border-emerald-400/30 bg-linear-to-r from-emerald-500/20 via-zion-cyan/10 to-emerald-500/20 p-10 text-center">
          <Radio className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? 'Pripojte se k siti ZION' : 'Join the ZION Network'}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? 'Nativni Rust infrastruktura bezi 24/7 z aktualniho primarniho hostu s podporou interniho kvora. Pripojte svuj miner, spustte vlastni node nebo prozkoumejte blockchain, zatimco historicky kontext rollouta zustava zachovany v dokumentaci.'
              : 'Native Rust infrastructure running 24/7 from the current primary host with internal quorum support. Connect your miner, run your own node, or explore the blockchain while historical rollout context stays preserved in docs.'}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {cs ? '89 % miner · 5 % humanitarian · 5 % fond Issobella · 1 % pool fee · Cil verejneho launch 31.12.2026' : '89% miner · 5% humanitarian · 5% Issobella fund · 1% pool fee · Public launch target 31.12.2026'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {[
              'Cosmic Harmony PoW',
              cs ? 'Primarni host online' : 'Primary host live',
              cs ? 'Interni seedy' : 'Internal seeds',
              cs ? 'Docker nativne' : 'Docker native',
              cs ? 'Archivovana multi-host historie' : 'Archived multi-host history',
            ].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Activity className="h-4 w-4" /> {cs ? 'Explorer' : 'Explorer'}
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-emerald-400 to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
              <Rocket className="h-4 w-4" /> {cs ? 'Roadmapa' : 'Roadmap'}
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
        </section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} - P2P Sit Pro · ${SITE_NETWORK_TOPOLOGY} · Archivovany multi-host rollout zachovan v dokumentaci`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} - P2P Network Pro · ${SITE_NETWORK_TOPOLOGY} · Archived multi-host rollout preserved in docs`}
        </p>
      </div>
    </div>
  );
}

function SurfaceSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
      <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 w-full rounded bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}
