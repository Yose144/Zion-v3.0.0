'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Check,
  Copy,
  Database,
  PlugZap,
  SatelliteDish,
  Server,
  Shield,
  Sparkles,
  Terminal
} from 'lucide-react';

const apiStats = [
  { label: 'Core uptime', value: 'TestNet', detail: '2 nodes synced', icon: Shield },
  { label: 'API Port', value: '8444', detail: 'JSON-RPC + REST', icon: Activity },
  { label: 'Pool Port', value: '8080', detail: 'stats endpoint', icon: Server },
];

const endpointGroups = [
  {
    title: 'Blockchain Core',
    description: 'Stats, blocks, and RPC for explorers, wallets, and validators.',
    icon: Database,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/blockchain/stats',
        description: 'Network height, supply, fee window, and hash rate snapshot.',
        latency: '45 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/blocks?limit=50',
        description: 'Paginated block feed with miner, reward, and difficulty metadata.',
        latency: '65 ms avg'
      },
      {
        method: 'GET',
        path: '/api/blockchain/transactions?limit=50',
        description: 'Recent transactions for explorers and monitoring pipelines.',
        latency: '70 ms avg'
      }
    ]
  },
  {
    title: 'Mining & Pool',
    description: 'Stratum telemetry, worker balance queries, and payout history.',
    icon: PlugZap,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/pool/stats',
        description: 'Pool health snapshot: miners, hashrate, and difficulty.',
        latency: '58 ms avg'
      },
      {
        method: 'GET',
        path: '/pool/miner/{wallet}',
        description: 'Miner worker stats, balances, and payout state for a wallet.',
        latency: '62 ms avg'
      }
    ]
  },
  {
    title: 'Observability & AI',
    description: 'Health, AI selector recommendations, and alert hooks.',
    icon: SatelliteDish,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: 'Full service heartbeat with version, block lag, and dependency checks.',
        latency: '30 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network',
        description: 'Network status including connectivity, nodes, and core services.',
        latency: '48 ms avg'
      },
      {
        method: 'GET',
        path: '/api/network/best-pool',
        description: 'Best pool selection based on current conditions (read-only).',
        latency: '90 ms avg'
      }
    ]
  },
  {
    title: 'Listings (CoinGecko / CMC)',
    description: 'Machine-readable project, supply, and on-chain metadata feeds for listing review.',
    icon: Sparkles,
    port: '443',
    endpoints: [
      {
        method: 'GET',
        path: '/api/listing/coingecko',
        description: 'CoinGecko-ready payload: links, supply, tokenomics, and live chain telemetry.',
        latency: '55 ms avg'
      },
      {
        method: 'GET',
        path: '/api/listing/coinmarketcap',
        description: 'CoinMarketCap-style payload with project URLs, supply metrics, and on-chain snapshot.',
        latency: '55 ms avg'
      }
    ]
  }
];

const onboardingSteps = [
  {
    title: '1 · Authenticate',
    detail: 'GET routes are open. For POST/PUT include x-zion-key in headers; rotate keys every 30 days.'
  },
  {
    title: '2 · Choose transport',
    detail: 'HTTPS for RPC/REST, WebSockets for stratum + metrics. All servers support HTTP/2.'
  },
  {
    title: '3 · Pin environment',
    detail: 'Sandbox mirrors production at https://api-sandbox.zionterranova.com with testnet data.'
  }
];

const codeSamples = [
  {
    id: 'curl',
    label: 'cURL quick ping',
    snippet: `curl -X GET \
  https://zionterranova.com/api/blockchain/stats \
  -H 'Accept: application/json'`
  },
  {
    id: 'ts',
    label: 'TypeScript fetch',
    snippet: `const res = await fetch('https://zionterranova.com/api/blockchain/stats', {
  headers: {
    'Accept': 'application/json',
  },
});
const data = await res.json();`
  }
];

export default function ApiReferencePage() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="zion-shell min-h-screen pt-32 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-6xl space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[36px] border border-white/10 bg-black/60 p-8 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.5)]"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-zion-gold">
            <Sparkles className="h-4 w-4" /> API v2.9 · Orion Mesh
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold text-gradient">API Command Deck</h1>
          <p className="mt-4 text-gray-300 max-w-3xl">
            One surface for wallets, explorers, AI orchestrators, and monitoring stacks. Stable schemas, generous
            rate limits, and ready-to-use cURL / TypeScript templates.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/health"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-zion-gold/60"
            >
              <Server className="h-4 w-4 text-zion-gold" /> Live health
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-zion-gold/60"
            >
              <ArrowUpRight className="h-4 w-4 text-zion-gold" /> Full docs
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-3"
        >
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
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {endpointGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="rounded-[32px] border border-white/10 bg-black/50 p-6 backdrop-blur">
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
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="rounded-[32px] border border-white/10 bg-black/50 p-6 backdrop-blur">
            <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Terminal className="h-6 w-6 text-zion-gold" /> Quickstart snippets
            </h3>
            <div className="mt-4 space-y-4">
              {codeSamples.map((sample) => (
                <div key={sample.id} className="rounded-2xl border border-white/10 bg-black/70 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
                    <span>{sample.label}</span>
                    <button
                      onClick={() => handleCopy(sample.id, sample.snippet)}
                      className="inline-flex items-center gap-1 text-xs text-zion-gold"
                    >
                      {copied === sample.id ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-sm text-zion-cyan">
                    <code>{sample.snippet}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-black/50 p-6 backdrop-blur">
            <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Server className="h-6 w-6 text-zion-gold" /> Onboarding checklist
            </h3>
            <div className="mt-4 space-y-4">
              {onboardingSteps.map((step) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{step.title}</p>
                  <p className="text-sm text-gray-300 mt-2">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[36px] border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-8 text-center"
        >
          <h3 className="text-3xl font-semibold text-white">Ready to wire the mesh?</h3>
          <p className="mt-3 text-gray-50">
            Deploy the SDKs from GitHub, watch live health, and ping the team in docs if you need additional scopes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20"
            >
              Open GitHub repo
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold to-zion-purple px-6 py-3 text-sm font-semibold text-black"
            >
              Explore documentation
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
