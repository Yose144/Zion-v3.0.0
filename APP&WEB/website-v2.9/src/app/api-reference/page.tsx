'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
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

function ApiQuickstartPanels({ cs, lang }: { cs: boolean; lang: Lang }) {
  const panels = [
    {
      title: tr('apiReference', 'explorer_telemetry', lang),
      body: cs
        ? 'Začni na /network a /explorer — z živých endpointů uvidíš výšku chainu, peers a hashrate.'
        : 'Start with /network and /explorer — live endpoints expose chain height, peers, and hashrate.',
      href: '/network',
      icon: Activity,
    },
    {
      title: tr('apiReference', 'pool_api', lang),
      body: cs
        ? 'Pool statistiky (hashrate, sessions, PPLNS) jsou dostupné přes /api/pool/stats.'
        : 'Pool stats (hashrate, sessions, PPLNS) are available via /api/pool/stats.',
      href: '/pool',
      icon: Server,
    },
    {
      title: tr('apiReference', 'health', lang),
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
        {tr('apiReference', 'quickstart', lang)}
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
              <span>{tr('apiReference', 'open', lang)}</span>
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
    label: tr('apiReference', 'core_environment', lang),
    value: 'V3 Test Mainnet',
    detail: tr('apiReference', 'controlled_rehearsal_line', lang),
    icon: Shield,
  },
  {
    label: tr('apiReference', 'api_port', lang),
    value: '8443',
    detail: tr('apiReference', 'json_rpc_rest', lang),
    icon: Activity,
  },
  {
    label: tr('apiReference', 'pool_port', lang),
    value: '8080',
    detail: tr('apiReference', 'stats_endpoint', lang),
    icon: Server,
  },
];

const getEndpointGroups = (cs: boolean) => [
  {
    title: tr('apiReference', 'blockchain_core', lang),
    description: tr('apiReference', 'stats_blocks_and_rpc_for_explorers_wallets_an', lang),
    icon: Database,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/blockchain/stats',
        description: tr('apiReference', 'network_height_supply_fee_window_and_hash_rat', lang),
        latency: '45 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/blocks?limit=50',
        description: tr('apiReference', 'paginated_block_feed_with_miner_reward_and_di', lang),
        latency: '65 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/transactions?limit=50',
        description: tr('apiReference', 'recent_transactions_for_explorers_and_monitor', lang),
        latency: '70 ms avg'
      }
    ]
  },
  {
    title: tr('apiReference', 'mining_pool', lang),
    description: tr('apiReference', 'stratum_telemetry_worker_balance_queries_and_', lang),
    icon: PlugZap,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/pool/stats',
        description: tr('apiReference', 'pool_health_snapshot_miners_hashrate_and_diff', lang),
        latency: '58 ms avg'
      },
      {
        method: 'GET',
        path: '/pool/miner/{wallet}',
        description: tr('apiReference', 'miner_worker_stats_balances_and_payout_state_', lang),
        latency: '62 ms avg'
      }
    ]
  },
  {
    title: tr('apiReference', 'observability_ai', lang),
    description: tr('apiReference', 'health_ai_selector_recommendations_and_alert_', lang),
    icon: SatelliteDish,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: tr('apiReference', 'full_service_heartbeat_with_version_block_lag', lang),
        latency: '30 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network',
        description: tr('apiReference', 'network_status_including_connectivity_nodes_a', lang),
        latency: '48 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network/best-pool',
        description: tr('apiReference', 'best_pool_selection_based_on_current_conditio', lang),
        latency: '90 ms avg'
      }
    ]
  },
  {
    title: tr('apiReference', 'listings_coingecko_cmc', lang),
    description: tr('apiReference', 'machine_readable_project_supply_and_on_chain_', lang),
    icon: Sparkles,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/listing/coingecko',
        description: tr('apiReference', 'coingecko_ready_payload_links_supply_tokenomi', lang),
        latency: '55 ms avg'
      },
      {
        method: 'GET',
        path: '/api/listing/coinmarketcap',
        description: tr('apiReference', 'coinmarketcap_style_payload_with_project_urls', lang),
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
          <h1 className="mt-4 text-4xl md:text-5xl font-bold text-gradient">{tr('apiReference', 'api_command_deck', lang)}</h1>
          <p className="mt-4 text-gray-300 max-w-3xl">
            {tr('apiReference', 'one_surface_for_wallets_explorers_ai_orchestr', lang)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/health"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-zion-gold/60"
            >
              <Server className="h-4 w-4 text-zion-gold" /> {tr('apiReference', 'live_health', lang)}
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-zion-gold/60"
            >
              <ArrowUpRight className="h-4 w-4 text-zion-gold" /> {tr('apiReference', 'full_docs', lang)}
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

        <ApiQuickstartPanels cs={cs} lang={lang} />

        <section className="rounded-[36px] border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-8 text-center">
          <h3 className="text-3xl font-semibold text-white">{tr('apiReference', 'ready_to_wire_the_mesh', lang)}</h3>
          <p className="mt-3 text-gray-50">
            {tr('apiReference', 'deploy_the_sdks_from_github_watch_live_health', lang)}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20"
            >
              {tr('apiReference', 'open_github_repo', lang)}
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold to-zion-purple px-6 py-3 text-sm font-semibold text-black"
            >
              {tr('apiReference', 'explore_documentation', lang)}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
