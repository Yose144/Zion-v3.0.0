'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Coins,
  Landmark,
  ShieldCheck,
  Sprout,
  BarChart3,
  ExternalLink,
  Loader2,
  Activity,
  Layers,
  Vote,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useLang } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DefiStatus {
  ok: boolean;
  network: string;
  chainId: number;
  contracts: Record<string, string>;
  data: {
    wZION: { totalSupply: string };
    staking: { totalStaked: string; apr: string; cooldownDays: number };
    farm: { poolCount: number; rewardPerSecond: string };
    governance: { proposalCount: number };
    bridge: { threshold: number; validatorCount: number };
  };
  fetchedAt: number;
}

// ─── Products ─────────────────────────────────────────────────────────────────

const products = [
  {
    key: 'bridge',
    icon: ArrowLeftRight,
    title: { cs: 'ZION Bridge', en: 'ZION Bridge' },
    desc: {
      cs: 'Převod ZION ↔ wZION mezi L1 a Base. Zamkni na L1, mintni na Base, spálíš na Base, odemkneš na L1.',
      en: 'Transfer ZION ↔ wZION between L1 and Base. Lock on L1, mint on Base, burn on Base, unlock on L1.',
    },
    href: '/bridge',
    tags: ['L1↔L2', 'ERC-20'],
    contract: 'ZIONBridge',
    stat: (d: DefiStatus) => `${d.data.bridge.validatorCount}/${d.data.bridge.threshold} validators`,
  },
  {
    key: 'staking',
    icon: Coins,
    title: { cs: 'Staking wZION', en: 'wZION Staking' },
    desc: {
      cs: 'Stakuj wZION tokeny a získej odměny. 7denní cooldown, ~12% APR.',
      en: 'Stake wZION tokens and earn rewards. 7-day cooldown, ~12% APR.',
    },
    href: '/defi#staking',
    tags: ['DeFi', 'Yield'],
    contract: 'ZIONStaking',
    stat: (d: DefiStatus) => `${d.data.staking.totalStaked} staked · ${d.data.staking.apr} APR`,
  },
  {
    key: 'farm',
    icon: Sprout,
    title: { cs: 'Yield Farm', en: 'Yield Farm' },
    desc: {
      cs: 'Poskytuj likviditu v LP poolech a farmuj odměny. Dual token rewards.',
      en: 'Provide liquidity in LP pools and farm rewards. Dual token rewards.',
    },
    href: '/defi#farm',
    tags: ['DeFi', 'LP'],
    contract: 'ZIONFarm',
    stat: (d: DefiStatus) => `${d.data.farm.poolCount} pools`,
  },
  {
    key: 'swap',
    icon: RefreshCw,
    title: { cs: 'Atomic Swap', en: 'Atomic Swap' },
    desc: {
      cs: 'Cross-chain atomic swap s HTLC smart kontrakty. Trustless výměna.',
      en: 'Cross-chain atomic swap with HTLC smart contracts. Trustless exchange.',
    },
    href: '/defi#swap',
    tags: ['Cross-chain', 'HTLC'],
    contract: 'ZIONAtomicSwap',
    stat: () => 'HTLC · Trustless',
  },
  {
    key: 'dex',
    icon: BarChart3,
    title: { cs: 'wZION/WETH Pool', en: 'wZION/WETH Pool' },
    desc: {
      cs: 'Uniswap V3 pool na Base. Poskytuj likviditu a obchoduj wZION za WETH.',
      en: 'Uniswap V3 pool on Base. Provide liquidity and trade wZION for WETH.',
    },
    href: '/defi#dex',
    tags: ['UniV3', 'AMM'],
    contract: 'UniV3Pool',
    stat: () => 'Uniswap V3 · 0.3%',
  },
  {
    key: 'governance',
    icon: Vote,
    title: { cs: 'Governance', en: 'Governance' },
    desc: {
      cs: 'On-chain DAO governance. Vytváření návrhů, hlasování, správa treasury.',
      en: 'On-chain DAO governance. Create proposals, vote, manage treasury.',
    },
    href: '/dao',
    tags: ['DAO', 'Treasury'],
    contract: 'ZIONGovernance',
    stat: (d: DefiStatus) => `${d.data.governance.proposalCount} proposals`,
  },
];

// ─── Explorer base ────────────────────────────────────────────────────────────

const EXPLORER = 'https://sepolia.basescan.org/address/';

// ─── Component ────────────────────────────────────────────────────────────────

export default function DefiPage() {
  const { lang } = useLang();
  const [status, setStatus] = useState<DefiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/defi/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Unknown error');
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 30_000);
    return () => clearInterval(i);
  }, [fetchStatus]);

  const cs = lang === 'cs';

  return (
    <main className="min-h-screen bg-black text-white pt-24 pb-16">
      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Layers className="w-5 h-5 text-yellow-400" />
            <span className="text-xs tracking-widest text-white/50 uppercase">
              ZION L2 · Base {status?.network === 'base-mainnet' ? 'Mainnet' : 'Sepolia Testnet'}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              DeFi Hub
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mb-6">
            {cs
              ? 'Kompletní L2 DeFi ekosystém na Base. Bridge, staking, farming, swap, DEX pool a governance — vše s wZION tokenem.'
              : 'Complete L2 DeFi ecosystem on Base. Bridge, staking, farming, swap, DEX pool, and governance — all powered by wZION.'}
          </p>

          {/* Live stats bar */}
          <div className="flex flex-wrap gap-4 text-sm">
            {status && (
              <>
                <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-white/70">wZION Supply:</span>
                  <span className="text-white font-mono">{status.data.wZION.totalSupply}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-white/70">Staked:</span>
                  <span className="text-white font-mono">{status.data.staking.totalStaked}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-white/70">Chain:</span>
                  <span className="text-white font-mono">{status.network}</span>
                </div>
              </>
            )}
            {loading && (
              <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />
                <span className="text-white/40">{cs ? 'Načítání…' : 'Loading…'}</span>
              </div>
            )}
            {error && (
              <div className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Product Cards ── */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p, i) => {
            const Icon = p.icon;
            const contractAddr = status?.contracts?.[p.contract];
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group relative rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 overflow-hidden"
              >
                {/* Gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />

                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-400/10">
                        <Icon className="w-5 h-5 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {cs ? p.title.cs : p.title.en}
                      </h3>
                    </div>
                    <Link
                      href={p.href}
                      className="text-white/30 hover:text-yellow-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-white/50 mb-4 leading-relaxed">
                    {cs ? p.desc.cs : p.desc.en}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Live stat */}
                  {status && (
                    <div className="text-xs font-mono text-yellow-400/70 mb-3">
                      {p.stat(status)}
                    </div>
                  )}

                  {/* Contract link */}
                  {contractAddr && (
                    <a
                      href={`${EXPLORER}${contractAddr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors"
                    >
                      {contractAddr.slice(0, 6)}…{contractAddr.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Hover glow */}
                <div className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-yellow-400/[0.03] to-transparent" />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Contract Addresses ── */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-2xl font-bold mb-6">
            {cs ? 'Nasazené kontrakty' : 'Deployed Contracts'}
          </h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-white/40 font-medium">{cs ? 'Kontrakt' : 'Contract'}</th>
                    <th className="text-left p-4 text-white/40 font-medium">{cs ? 'Adresa' : 'Address'}</th>
                    <th className="text-left p-4 text-white/40 font-medium">{cs ? 'Síť' : 'Network'}</th>
                  </tr>
                </thead>
                <tbody>
                  {status &&
                    Object.entries(status.contracts).map(([name, addr]) => (
                      <tr key={name} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="p-4 font-mono text-white/70">{name}</td>
                        <td className="p-4">
                          <a
                            href={`${EXPLORER}${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors"
                          >
                            {addr}
                          </a>
                        </td>
                        <td className="p-4 text-white/40 text-xs">{status.network}</td>
                      </tr>
                    ))}
                  {!status && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-white/30">
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                          error ?? (cs ? 'Žádná data' : 'No data')
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-2xl font-bold mb-6">
            {cs ? 'Jak L2 DeFi funguje' : 'How L2 DeFi Works'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: ArrowLeftRight,
                title: cs ? '1. Přemosti ZION' : '1. Bridge ZION',
                desc: cs
                  ? 'Zamkni ZION na L1 a dostaneš wZION na Base. 1:1 peg, žádné poplatky.'
                  : 'Lock ZION on L1 and receive wZION on Base. 1:1 peg, no fees.',
              },
              {
                icon: Coins,
                title: cs ? '2. Stakuj & Farmuj' : '2. Stake & Farm',
                desc: cs
                  ? 'Stakuj wZION pro ~12% APR nebo poskytni LP likviditu pro farming odměny.'
                  : 'Stake wZION for ~12% APR or provide LP liquidity for farming rewards.',
              },
              {
                icon: Landmark,
                title: cs ? '3. Governance' : '3. Governance',
                desc: cs
                  ? 'Hlasuj o návrzích a spravuj DAO treasury. On-chain rozhodování.'
                  : 'Vote on proposals and manage DAO treasury. On-chain decision making.',
              },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-white/10 bg-white/[0.02]"
                >
                  <Icon className="w-8 h-8 text-yellow-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-white/50">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="p-8 rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-yellow-400/[0.05] to-transparent"
        >
          <h2 className="text-2xl font-bold mb-3">
            {cs ? 'Připraven na DeFi?' : 'Ready for DeFi?'}
          </h2>
          <p className="text-white/50 mb-6 max-w-lg mx-auto">
            {cs
              ? 'Začni přemostěním ZION na Base a prozkoumej celý L2 DeFi ekosystém.'
              : 'Start by bridging ZION to Base and explore the full L2 DeFi ecosystem.'}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/bridge"
              className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-colors"
            >
              {cs ? 'Přemostit ZION' : 'Bridge ZION'}
            </Link>
            <Link
              href="/dao"
              className="px-6 py-3 rounded-lg border border-white/20 text-white hover:border-white/40 transition-colors"
            >
              {cs ? 'DAO Governance' : 'DAO Governance'}
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
