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
import { usePolling } from '@/hooks/usePolling';

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

  usePolling(fetchStatus, 30_000);

  const cs = lang === 'cs';

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white pt-24 pb-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>
      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-4 flex items-center gap-3">
            <Layers className="h-5 w-5 text-zion-gold" />
            <span className="text-xs uppercase tracking-[0.35em] text-gray-400">
              ZION L2 · Base {status?.network === 'base-mainnet' ? 'Mainnet' : 'Sepolia Testnet'}
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">
            <span className="text-gradient">
              DeFi Hub
            </span>
          </h1>

          <p className="mb-6 max-w-2xl text-lg leading-relaxed text-gray-300">
            {cs
              ? 'Kompletní L2 DeFi ekosystém na Base. Bridge, staking, farming, swap, DEX pool a governance — vše s wZION tokenem.'
              : 'Complete L2 DeFi ecosystem on Base. Bridge, staking, farming, swap, DEX pool, and governance — all powered by wZION.'}
          </p>

          {/* Live stats bar */}
          <div className="flex flex-wrap gap-3 text-sm">
            {status && (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-gray-300">wZION Supply:</span>
                  <span className="font-mono text-white">{status.data.wZION.totalSupply}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <Coins className="h-3.5 w-3.5 text-zion-gold" />
                  <span className="text-gray-300">Staked:</span>
                  <span className="font-mono text-white">{status.data.staking.totalStaked}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-zion-cyan" />
                  <span className="text-gray-300">Chain:</span>
                  <span className="font-mono text-white">{status.network}</span>
                </div>
              </>
            )}
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                <span className="text-gray-400">{cs ? 'Načítání…' : 'Loading…'}</span>
              </div>
            )}
            {error && (
              <div className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Product Cards ── */}
      <section className="zion-container relative z-10 mb-20">
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
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/45 backdrop-blur-xl transition-all duration-300 hover:border-zion-cyan/30"
              >
                {/* Gradient accent top */}
                <div className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-zion-gold/55 to-transparent" />

                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-zion-gold/10 p-2">
                        <Icon className="h-5 w-5 text-zion-gold" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {cs ? p.title.cs : p.title.en}
                      </h3>
                    </div>
                    <Link
                      href={p.href}
                      className="text-white/30 transition-colors hover:text-zion-cyan"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  {/* Description */}
                  <p className="mb-4 text-sm leading-relaxed text-gray-300">
                    {cs ? p.desc.cs : p.desc.en}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Live stat */}
                  {status && (
                    <div className="mb-3 font-mono text-xs text-zion-gold/80">
                      {p.stat(status)}
                    </div>
                  )}

                  {/* Contract link */}
                  {contractAddr && (
                    <a
                      href={`${EXPLORER}${contractAddr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-mono text-gray-400 transition-colors hover:text-gray-200"
                    >
                      {contractAddr.slice(0, 6)}…{contractAddr.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Hover glow */}
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-b from-zion-purple/[0.08] via-transparent to-zion-cyan/[0.04] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Contract Addresses ── */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="mb-6 text-2xl font-bold">
            {cs ? 'Nasazené kontrakty' : 'Deployed Contracts'}
          </h2>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/45 backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2">
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Kontrakt' : 'Contract'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Adresa' : 'Address'}</th>
                    <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Síť' : 'Network'}</th>
                  </tr>
                </thead>
                <tbody>
                  {status &&
                    Object.entries(status.contracts).map(([name, addr]) => (
                      <tr key={name} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-4 font-mono text-gray-200">{name}</td>
                        <td className="p-4">
                          <a
                            href={`${EXPLORER}${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-zion-gold/80 transition-colors hover:text-zion-gold"
                          >
                            {addr}
                          </a>
                        </td>
                        <td className="p-4 text-xs text-gray-400">{status.network}</td>
                      </tr>
                    ))}
                  {!status && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-400">
                        {loading ? (
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
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
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="mb-6 text-2xl font-bold">
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
                  className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur-xl"
                >
                  <Icon className="mb-4 h-8 w-8 text-zion-cyan" />
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-300">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="zion-container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="rounded-2xl border border-zion-gold/25 bg-linear-to-br from-zion-gold/10 via-zion-purple/10 to-zion-cyan/10 p-8"
        >
          <h2 className="text-2xl font-bold mb-3">
            {cs ? 'Připraven na DeFi?' : 'Ready for DeFi?'}
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-gray-300">
            {cs
              ? 'Začni přemostěním ZION na Base a prozkoumej celý L2 DeFi ekosystém.'
              : 'Start by bridging ZION to Base and explore the full L2 DeFi ecosystem.'}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/bridge"
              className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 font-semibold text-white shadow-[0_12px_35px_rgba(147,51,234,0.35)] transition-shadow hover:shadow-[0_18px_45px_rgba(147,51,234,0.45)]"
            >
              {cs ? 'Přemostit ZION' : 'Bridge ZION'}
            </Link>
            <Link
              href="/dao"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-white transition-colors hover:border-zion-cyan/45"
            >
              {cs ? 'DAO Governance' : 'DAO Governance'}
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
