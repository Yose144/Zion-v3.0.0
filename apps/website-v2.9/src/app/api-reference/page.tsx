'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';
import {
  Activity,
  ArrowUpRight,
  Database,
  PlugZap,
  SatelliteDish,
  Server,
  Shield,
  Sparkles,
} from 'lucide-react';

const ApiReferenceCopy = {
  explorerTelemetry: { cs: `Explorer / telemetry`, en: `Explorer / telemetry` },
  startWithNetworkAndExplorerLiv: { cs: `Začni na /network a /explorer — z živých endpointů uvidíš výšku chainu, peers a hashrate.`, en: `Start with /network and /explorer — live endpoints expose chain height, peers, and hashrate.` },
  poolApi: { cs: `Pool API`, en: `Pool API` },
  poolStatsHashrateSessionsPplns: { cs: `Pool statistiky (hashrate, sessions, PPLNS) jsou dostupné přes /api/pool/stats.`, en: `Pool stats (hashrate, sessions, PPLNS) are available via /api/pool/stats.` },
  health: { cs: `Health`, en: `Health` },
  oneEndpointForDependencyChecks: { cs: `Jeden endpoint pro rychlé ověření závislostí webu: /api/health.`, en: `One endpoint for dependency checks: /api/health.` },
  quickstart: { cs: `Quickstart`, en: `Quickstart` },
  basicPanelsToGetStartedWithThe: { cs: `Základní panely pro rychlé zapojení do runtime surface.`, en: `Basic panels to get started with the runtime surface.` },
  open: { cs: `Otevřít`, en: `Open` },
  coreEnvironment: { cs: `Core prostředí`, en: `Core environment` },
  controlledRehearsalLine: { cs: `kontrolovaná mainnet rehearsal linka`, en: `controlled rehearsal line` },
  apiPort: { cs: `API port`, en: `API Port` },
  jsonRpcRest: { cs: `JSON-RPC + REST`, en: `JSON-RPC + REST` },
  poolPort: { cs: `Pool port`, en: `Pool Port` },
  statsEndpoint: { cs: `stats endpoint`, en: `stats endpoint` },
  blockchainCore: { cs: `Blockchainové jádro`, en: `Blockchain Core` },
  statsBlocksAndRpcForExplorersW: { cs: `Statistiky, bloky a RPC pro explorery, peněženky a validátory.`, en: `Stats, blocks, and RPC for explorers, wallets, and validators.` },
  networkHeightSupplyFeeWindowAn: { cs: `Snapshot výšky sítě, zásoby, fee okna a hashratu.`, en: `Network height, supply, fee window, and hash rate snapshot.` },
  paginatedBlockFeedWithMinerRew: { cs: `Stránkovaný tok bloků s metadaty o těžaři, odměně a obtížnosti.`, en: `Paginated block feed with miner, reward, and difficulty metadata.` },
  recentTransactionsForExplorers: { cs: `Poslední transakce pro explorery a monitoring pipeline.`, en: `Recent transactions for explorers and monitoring pipelines.` },
  miningPool: { cs: `Těžba a pool`, en: `Mining & Pool` },
  stratumTelemetryWorkerBalanceQ: { cs: `Stratum telemetrie, dotazy na worker balance a historie výplat.`, en: `Stratum telemetry, worker balance queries, and payout history.` },
  poolHealthSnapshotMinersHashra: { cs: `Snapshot zdraví poolu: mineři, hashrate a obtížnost.`, en: `Pool health snapshot: miners, hashrate, and difficulty.` },
  minerWorkerStatsBalancesAndPay: { cs: `Statistiky workeru, balance a stav výplat pro peněženku.`, en: `Miner worker stats, balances, and payout state for a wallet.` },
  observabilityAi: { cs: `Observabilita a AI`, en: `Observability & AI` },
  healthAiSelectorRecommendation: { cs: `Health, doporučení AI selektoru a alert hooky.`, en: `Health, AI selector recommendations, and alert hooks.` },
  fullServiceHeartbeatWithVersio: { cs: `Kompletní heartbeat služeb s verzi, block lagem a dependency kontrolami.`, en: `Full service heartbeat with version, block lag, and dependency checks.` },
  networkStatusIncludingConnecti: { cs: `Stav sítě včetně konektivity, uzlů a core služeb.`, en: `Network status including connectivity, nodes, and core services.` },
  bestPoolSelectionBasedOnCurren: { cs: `Výběr nejlepšího poolu podle aktuálních podmínek (read-only).`, en: `Best pool selection based on current conditions (read-only).` },
  listingsCoingeckoCmc: { cs: `Listingy (CoinGecko / CMC)`, en: `Listings (CoinGecko / CMC)` },
  machineReadableProjectSupplyAn: { cs: `Strojově čitelné feedy projektu, zásoby a on-chain metadat pro listing review.`, en: `Machine-readable project, supply, and on-chain metadata feeds for listing review.` },
  coingeckoReadyPayloadLinksSupp: { cs: `CoinGecko-ready payload: odkazy, zásoba, tokenomika a živá chain telemetrie.`, en: `CoinGecko-ready payload: links, supply, tokenomics, and live chain telemetry.` },
  coinmarketcapStylePayloadWithP: { cs: `Payload ve stylu CoinMarketCap s URL projektu, supply metrikami a on-chain snapshotem.`, en: `CoinMarketCap-style payload with project URLs, supply metrics, and on-chain snapshot.` },
  apiCommandDeck: { cs: `API velitelský panel`, en: `API Command Deck` },
  oneSurfaceForWalletsExplorersA: { cs: `Jedno místo pro peněženky, explorery, AI orchestrátory a monitoring stacky. Stabilní schémata, velkorysé rate limity a hotové šablony pro cURL / TypeScript.`, en: `One surface for wallets, explorers, AI orchestrators, and monitoring stacks. Stable schemas, generous rate limits, and ready-to-use cURL / TypeScript templates.` },
  liveHealth: { cs: `Živé health`, en: `Live health` },
  fullDocs: { cs: `Plná dokumentace`, en: `Full docs` },
  readyToWireTheMesh: { cs: `Připraven zapojit mesh?`, en: `Ready to wire the mesh?` },
  deployTheSdksFromGithubWatchLi: { cs: `Nasaďte SDK z GitHubu, sledujte živé health a ozvěte se týmu v docs, pokud potřebujete další scopes.`, en: `Deploy the SDKs from GitHub, watch live health, and ping the team in docs if you need additional scopes.` },
  openGithubRepo: { cs: `Otevřít GitHub repozitář`, en: `Open GitHub repo` },
  exploreDocumentation: { cs: `Projít dokumentaci`, en: `Explore documentation` },
};

function ApiQuickstartPanels({ cs, lang }: { cs: boolean; lang: Lang }) {
  const panels = [
    {
      title: tx5(ApiReferenceCopy.explorerTelemetry, lang),
      body: tx5(ApiReferenceCopy.startWithNetworkAndExplorerLiv, lang),
      href: '/network',
      icon: Activity,
    },
    {
      title: tx5(ApiReferenceCopy.poolApi, lang),
      body: tx5(ApiReferenceCopy.poolStatsHashrateSessionsPplns, lang),
      href: '/pool',
      icon: Server,
    },
    {
      title: tx5(ApiReferenceCopy.health, lang),
      body: tx5(ApiReferenceCopy.oneEndpointForDependencyChecks, lang),
      href: '/api/health',
      icon: Shield,
    },
  ] as const;

  return (
    <section className="zion-section">
      <h3 className="text-2xl font-semibold text-white">
        {tx5(ApiReferenceCopy.quickstart, lang)}
      </h3>
      <p className="mt-2 text-sm text-gray-400">
        {tx5(ApiReferenceCopy.basicPanelsToGetStartedWithThe, lang)}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {panels.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="group zion-rainbow-sub p-5"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <p.icon className="h-5 w-5 text-zion-gold" />
              <div className="font-semibold text-white">{p.title}</div>
            </div>
            <p className="mt-3 text-sm text-white/55 leading-relaxed">
              {p.body}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-zion-gold/70 group-hover:text-zion-gold">
              <span>{tx5(ApiReferenceCopy.open, lang)}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const getApiStats = (cs: boolean, lang: Lang) => [
  {
    label: tx5(ApiReferenceCopy.coreEnvironment, lang),
    value: 'V3 Test Mainnet',
    detail: tx5(ApiReferenceCopy.controlledRehearsalLine, lang),
    icon: Shield,
  },
  {
    label: tx5(ApiReferenceCopy.apiPort, lang),
    value: '8443',
    detail: tx5(ApiReferenceCopy.jsonRpcRest, lang),
    icon: Activity,
  },
  {
    label: tx5(ApiReferenceCopy.poolPort, lang),
    value: '8080',
    detail: tx5(ApiReferenceCopy.statsEndpoint, lang),
    icon: Server,
  },
];

const getEndpointGroups = (cs: boolean, lang: Lang) => [
  {
    title: tx5(ApiReferenceCopy.blockchainCore, lang),
    description: tx5(ApiReferenceCopy.statsBlocksAndRpcForExplorersW, lang),
    icon: Database,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/blockchain/stats',
        description: tx5(ApiReferenceCopy.networkHeightSupplyFeeWindowAn, lang),
        latency: '45 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/blocks?limit=50',
        description: tx5(ApiReferenceCopy.paginatedBlockFeedWithMinerRew, lang),
        latency: '65 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/transactions?limit=50',
        description: tx5(ApiReferenceCopy.recentTransactionsForExplorers, lang),
        latency: '70 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/consensus',
        description: cs ? 'Parametry konsensu, decade decay a difficulty graf.' : t5('Consensus parameters, decade decay schedule and difficulty chart.', lang),
        latency: '120 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/miners',
        description: cs ? 'Live těžební leaderboard z poolu.' : t5('Live mining leaderboard from the pool.', lang),
        latency: '80 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/richlist',
        description: cs ? 'Top držitelé ZION včetně premine a pool adres.' : t5('Top ZION holders including premine and pool addresses.', lang),
        latency: '90 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/bridge/status',
        description: cs ? 'Stav L1↔Base bridge a relay metriky.' : t5('L1↔Base bridge status and relay metrics.', lang),
        latency: '60 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/sse',
        description: cs ? 'Server-Sent Events stream nových bloků a mempoolu.' : t5('Server-Sent Events stream for new blocks and mempool.', lang),
        latency: 'live'
      },
    ]
  },
  {
    title: tx5(ApiReferenceCopy.miningPool, lang),
    description: tx5(ApiReferenceCopy.stratumTelemetryWorkerBalanceQ, lang),
    icon: PlugZap,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/pool/stats',
        description: tx5(ApiReferenceCopy.poolHealthSnapshotMinersHashra, lang),
        latency: '58 ms avg'
      },
      {
        method: 'GET',
        path: '/pool/miner/{wallet}',
        description: tx5(ApiReferenceCopy.minerWorkerStatsBalancesAndPay, lang),
        latency: '62 ms avg'
      }
    ]
  },
  {
    title: tx5(ApiReferenceCopy.observabilityAi, lang),
    description: tx5(ApiReferenceCopy.healthAiSelectorRecommendation, lang),
    icon: SatelliteDish,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: tx5(ApiReferenceCopy.fullServiceHeartbeatWithVersio, lang),
        latency: '30 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network',
        description: tx5(ApiReferenceCopy.networkStatusIncludingConnecti, lang),
        latency: '48 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network/best-pool',
        description: tx5(ApiReferenceCopy.bestPoolSelectionBasedOnCurren, lang),
        latency: '90 ms avg'
      }
    ]
  },
  {
    title: tx5(ApiReferenceCopy.listingsCoingeckoCmc, lang),
    description: tx5(ApiReferenceCopy.machineReadableProjectSupplyAn, lang),
    icon: Sparkles,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/listing/coingecko',
        description: tx5(ApiReferenceCopy.coingeckoReadyPayloadLinksSupp, lang),
        latency: '55 ms avg'
      },
      {
        method: 'GET',
        path: '/api/listing/coinmarketcap',
        description: tx5(ApiReferenceCopy.coinmarketcapStylePayloadWithP, lang),
        latency: '55 ms avg'
      }
    ]
  }
];

export default function ApiReferencePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const apiStats = getApiStats(cs, lang);
  const endpointGroups = getEndpointGroups(cs, lang);

  return (
    <div className="pt-28 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-6xl space-y-12">
        <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-zion-gold">
            <Sparkles className="h-4 w-4" /> API v2.9 · Orion Mesh
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold text-gradient">{tx5(ApiReferenceCopy.apiCommandDeck, lang)}</h1>
          <p className="mt-4 text-gray-300 max-w-3xl">
            {tx5(ApiReferenceCopy.oneSurfaceForWalletsExplorersA, lang)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="zion-button-primary"
            >
              <Server className="h-4 w-4 text-zion-gold" /> {tx5(ApiReferenceCopy.liveHealth, lang)}
            </a>
            <Link
              href="/docs"
              className="zion-button-secondary"
            >
              <ArrowUpRight className="h-4 w-4 text-zion-gold" /> {tx5(ApiReferenceCopy.fullDocs, lang)}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {apiStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <Icon className="h-5 w-5 text-zion-gold" />
                <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label} · {stat.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="space-y-6">
          {endpointGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="zion-section">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 text-zion-gold" />
                      <h2 className="text-2xl font-semibold text-white">{group.title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{group.description}</p>
                  </div>
                  <span className="zion-badge">
                    Port {group.port}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {group.endpoints.map((endpoint) => (
                    <div
                      key={`${group.title}-${endpoint.path}`}
                      className="zion-rainbow-sub p-4"
                      style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="zion-rainbow-sub px-3 py-1 text-xs font-semibold text-zion-gold" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm text-white/90">{endpoint.path}</code>
                        <span className="text-xs text-gray-400">{endpoint.latency}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-400">{endpoint.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <ApiQuickstartPanels cs={cs} lang={lang} />

        <section className="zion-cta-banner">
          <h3 className="text-3xl font-semibold text-white">{tx5(ApiReferenceCopy.readyToWireTheMesh, lang)}</h3>
          <p className="mt-3 text-gray-50">
            {tx5(ApiReferenceCopy.deployTheSdksFromGithubWatchLi, lang)}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary"
            >
              {tx5(ApiReferenceCopy.openGithubRepo, lang)}
            </a>
            <Link
              href="/docs"
              className="zion-button-primary"
            >
              {tx5(ApiReferenceCopy.exploreDocumentation, lang)}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
