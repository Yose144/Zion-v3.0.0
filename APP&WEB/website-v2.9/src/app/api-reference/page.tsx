'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
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

function ApiQuickstartPanels({ cs }: { cs: boolean }) {
  const panels = [
    {
      title: cs ? 'Explorer / telemetry' : 'Explorer / telemetry',
      body: cs
        ? 'Začni na /network a /explorer — z živých endpointů uvidíš výšku chainu, peers a hashrate.'
        : 'Start with /network and /explorer — live endpoints expose chain height, peers, and hashrate.',
      href: '/network',
      icon: Activity,
    },
    {
      title: cs ? 'Pool API' : 'Pool API',
      body: cs
        ? 'Pool statistiky (hashrate, sessions, PPLNS) jsou dostupné přes /api/pool/stats.'
        : 'Pool stats (hashrate, sessions, PPLNS) are available via /api/pool/stats.',
      href: '/pool',
      icon: Server,
    },
    {
      title: cs ? 'Health' : 'Health',
      body: cs
        ? 'Jeden endpoint pro rychlé ověření závislostí webu: /api/health.'
        : 'One endpoint for dependency checks: /api/health.',
      href: '/api/health',
      icon: Shield,
    },
  ] as const;

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <h3 className="text-2xl font-semibold text-white">
        {cs ? 'Quickstart' : 'Quickstart'}
      </h3>
      <p className="mt-2 text-sm text-gray-400">
        {cs
          ? 'Základní panely pro první zapojení do runtime surface.'
          : 'Basic panels to get started with the runtime surface.'}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {panels.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="group rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition-colors"
          >
            <div className="flex items-center gap-3">
              <p.icon className="h-5 w-5 text-zion-gold" />
              <div className="font-semibold text-white">{p.title}</div>
            </div>
            <p className="mt-3 text-sm text-white/55 leading-relaxed">
              {p.body}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-zion-gold/70 group-hover:text-zion-gold">
              <span>{cs ? 'Otevřít' : 'Open'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const getApiStats = (cs: boolean) => [
  {
    label: cs ? 'Prostředí core' : 'Core environment',
    value: 'V3 Test Mainnet',
    detail: cs ? 'kontrolovaná mainnet rehearsal linka' : 'controlled rehearsal line',
    icon: Shield,
  },
  {
    label: cs ? 'API port' : 'API Port',
    value: '8443',
    detail: cs ? 'JSON-RPC + REST' : 'JSON-RPC + REST',
    icon: Activity,
  },
  {
    label: cs ? 'Pool port' : 'Pool Port',
    value: '8080',
    detail: cs ? 'stats endpoint' : 'stats endpoint',
    icon: Server,
  },
];

const getEndpointGroups = (cs: boolean) => [
  {
    title: cs ? 'Blockchainové jádro' : 'Blockchain Core',
    description: cs ? 'Statistiky, bloky a RPC pro explorery, penezenky a validatory.' : 'Stats, blocks, and RPC for explorers, wallets, and validators.',
    icon: Database,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/blockchain/stats',
        description: cs ? 'Snapshot vysky site, zasoby, fee okna a hashratu.' : 'Network height, supply, fee window, and hash rate snapshot.',
        latency: '45 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/blocks?limit=50',
        description: cs ? 'Strankovany tok bloku s metadaty o tezari, odmene a obtiznosti.' : 'Paginated block feed with miner, reward, and difficulty metadata.',
        latency: '65 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/transactions?limit=50',
        description: cs ? 'Posledni transakce pro explorery a monitoring pipeline.' : 'Recent transactions for explorers and monitoring pipelines.',
        latency: '70 ms avg'
      }
    ]
  },
  {
    title: cs ? 'Tezba a pool' : 'Mining & Pool',
    description: cs ? 'Stratum telemetrie, dotazy na worker balance a historie vyplat.' : 'Stratum telemetry, worker balance queries, and payout history.',
    icon: PlugZap,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/pool/stats',
        description: cs ? 'Snapshot zdravi poolu: mineri, hashrate a obtiznost.' : 'Pool health snapshot: miners, hashrate, and difficulty.',
        latency: '58 ms avg'
      },
      {
        method: 'GET',
        path: '/pool/miner/{wallet}',
        description: cs ? 'Statistiky workeru, balance a stav vyplat pro penezenku.' : 'Miner worker stats, balances, and payout state for a wallet.',
        latency: '62 ms avg'
      }
    ]
  },
  {
    title: cs ? 'Observabilita a AI' : 'Observability & AI',
    description: cs ? 'Health, doporuceni AI selectoru a alert hooky.' : 'Health, AI selector recommendations, and alert hooks.',
    icon: SatelliteDish,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: cs ? 'Kompletni heartbeat sluzeb s verzi, block lagem a dependency kontrolami.' : 'Full service heartbeat with version, block lag, and dependency checks.',
        latency: '30 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network',
        description: cs ? 'Stav site vcetne konektivity, nodu a core sluzeb.' : 'Network status including connectivity, nodes, and core services.',
        latency: '48 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network/best-pool',
        description: cs ? 'Vyber nejlepsiho poolu podle aktualnich podminek (read-only).' : 'Best pool selection based on current conditions (read-only).',
        latency: '90 ms avg'
      }
    ]
  },
  {
    title: cs ? 'Listingy (CoinGecko / CMC)' : 'Listings (CoinGecko / CMC)',
    description: cs ? 'Strojově čitelné feedy projektu, zásoby a on-chain metadat pro listing review.' : 'Machine-readable project, supply, and on-chain metadata feeds for listing review.',
    icon: Sparkles,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/listing/coingecko',
        description: cs ? 'CoinGecko-ready payload: odkazy, zasoba, tokenomika a ziva chain telemetrie.' : 'CoinGecko-ready payload: links, supply, tokenomics, and live chain telemetry.',
        latency: '55 ms avg'
      },
      {
        method: 'GET',
        path: '/api/listing/coinmarketcap',
        description: cs ? 'Payload ve stylu CoinMarketCap s URL projektu, supply metrikami a on-chain snapshotem.' : 'CoinMarketCap-style payload with project URLs, supply metrics, and on-chain snapshot.',
        latency: '55 ms avg'
      }
    ]
  }
];

export default function ApiReferencePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const apiStats = getApiStats(cs);
  const endpointGroups = getEndpointGroups(cs);

  return (
    <div className="pt-28 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-6xl space-y-12">
        <section className="rounded-[36px] border border-white/10 bg-black/60 p-8 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-zion-gold">
            <Sparkles className="h-4 w-4" /> API v2.9 · Orion Mesh
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold text-gradient">{cs ? 'API velitelsky panel' : 'API Command Deck'}</h1>
          <p className="mt-4 text-gray-300 max-w-3xl">
            {cs ? 'Jedno místo pro peněženky, explorery, AI orchestrátory a monitoring stacky. Stabilní schémata, velkorysé rate limity a hotové šablony pro cURL / TypeScript.' : 'One surface for wallets, explorers, AI orchestrators, and monitoring stacks. Stable schemas, generous rate limits, and ready-to-use cURL / TypeScript templates.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/health"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-zion-gold/60"
            >
              <Server className="h-4 w-4 text-zion-gold" /> {cs ? 'Živé health' : 'Live health'}
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-zion-gold/60"
            >
              <ArrowUpRight className="h-4 w-4 text-zion-gold" /> {cs ? 'Plná dokumentace' : 'Full docs'}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {apiStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
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
              <div key={group.title} className="rounded-4xl border border-white/10 bg-black/50 p-6 backdrop-blur">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 text-zion-gold" />
                      <h2 className="text-2xl font-semibold text-white">{group.title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{group.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1 text-xs text-gray-300">
                    Port {group.port}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {group.endpoints.map((endpoint) => (
                    <div
                      key={`${group.title}-${endpoint.path}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-zion-gold">
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

        <ApiQuickstartPanels cs={cs} />

        <section className="rounded-[36px] border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-8 text-center">
          <h3 className="text-3xl font-semibold text-white">{cs ? 'Připraven zapojit mesh?' : 'Ready to wire the mesh?'}</h3>
          <p className="mt-3 text-gray-50">
            {cs ? 'Nasaďte SDK z GitHubu, sledujte živé health a ozvěte se týmu v docs, pokud potřebujete další scopes.' : 'Deploy the SDKs from GitHub, watch live health, and ping the team in docs if you need additional scopes.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20"
            >
              {cs ? 'Otevřít GitHub repozitář' : 'Open GitHub repo'}
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold to-zion-purple px-6 py-3 text-sm font-semibold text-black"
            >
              {cs ? 'Projít dokumentaci' : 'Explore documentation'}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
