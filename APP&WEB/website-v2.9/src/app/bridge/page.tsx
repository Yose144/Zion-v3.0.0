'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeftRight,
  Zap,
  Shield,
  Clock,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Lock,
  Flame,
  Activity,
  Copy,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import {
  getBridgeStatus,
  formatUptime,
  bridgeEfficiency,
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from '@/lib/bridge-api';

// ─── How it works steps ───────────────────────────────────────────────────────

const lockMintSteps = [
  {
    icon: Lock,
    title: 'Lock ZION on L1',
    desc: 'Send native ZION to the bridge escrow address on the ZION L1 blockchain.',
  },
  {
    icon: Shield,
    title: 'Relay detects & verifies',
    desc: 'The Rust relay monitors L1 blocks, confirms 12 block finality, validates Guardian threshold.',
  },
  {
    icon: Zap,
    title: 'Receive wZION on Base',
    desc: 'The ZIONBridge contract mints wrapped wZION (ERC-20) to your EVM wallet on Base.',
  },
];

const burnUnlockSteps = [
  {
    icon: Flame,
    title: 'Burn wZION on Base',
    desc: 'Call burn() on the wZION ERC-20 contract, specifying your ZION L1 recipient address.',
  },
  {
    icon: Shield,
    title: 'Relay verifies burn',
    desc: 'EVM watcher detects the burn event, confirms EVM finality, submits unlock memo to L1.',
  },
  {
    icon: CheckCircle2,
    title: 'Receive ZION on L1',
    desc:
      'L1 unlock endpoint processes the memo and releases escrowed ZION.',
  },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BridgePage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getBridgeStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  function copyAddr(addr: string) {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const efficiency = status ? bridgeEfficiency(status) : 0;

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-7xl space-y-12">

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 p-6 md:p-10 backdrop-blur-xl"
        >
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-cyan-400 uppercase">
              <ArrowLeftRight className="h-4 w-4" />
              L1 ↔ EVM · Cross-chain Bridge
            </div>

            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                ZION ↔ wZION · Base Sepolia Testnet
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                Bridge native ZION<br className="hidden sm:block" /> to the EVM world
              </h1>
            </div>

            <p className="text-lg text-gray-300 max-w-3xl">
              Lock ZION on L1 → receive wZION on Base. Rust relay with Guardian
              multi-sig, 12-block finality confirmation, Prometheus monitoring.
            </p>

            {/* Live status pill */}
            <div className="flex flex-wrap items-center gap-4">
              {status ? (
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                    status.online
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
                  />
                  {status.online ? 'Relay online' : 'Relay offline'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-semibold text-gray-400">
                  <span className="h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
                  Checking status…
                </span>
              )}

              {status?.online && (
                <>
                  <span className="text-sm text-gray-400">
                    Uptime: <span className="text-white font-mono">{formatUptime(status.uptime_seconds)}</span>
                  </span>
                  <span className="text-sm text-gray-400">
                    L1 block: <span className="text-white font-mono">{status.last_l1_height.toLocaleString()}</span>
                  </span>
                  <span className="text-sm text-gray-400">
                    EVM block: <span className="text-white font-mono">{status.last_evm_block.toLocaleString()}</span>
                  </span>
                </>
              )}

              <button
                onClick={load}
                disabled={loading}
                className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </motion.section>

        {/* ── TWO DIRECTIONS ─────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* L1 → EVM: Lock & Mint */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-[28px] border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-black/60 p-6 md:p-8 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Direction A</p>
                <h2 className="text-2xl font-semibold text-white">Lock &amp; Mint</h2>
                <p className="text-sm text-gray-400 mt-1">ZION (L1) → wZION (Base)</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Available
              </span>
            </div>

            <ol className="space-y-4 mb-8">
              {lockMintSteps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                    <step.icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Step {i + 1} — {step.title}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            {status && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-white">
                    {status.l1_locks_detected.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Locks detected</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">
                    {status.evm_mints_confirmed.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Mints confirmed</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* EVM → L1: Burn & Unlock */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-[28px] border border-orange-500/20 bg-gradient-to-b from-orange-500/5 to-black/60 p-6 md:p-8 backdrop-blur-xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-orange-400">Direction B</p>
                <h2 className="text-2xl font-semibold text-white">Burn &amp; Unlock</h2>
                <p className="text-sm text-gray-400 mt-1">wZION (Base) → ZION (L1)</p>
              </div>
            </div>

            <ol className="space-y-4 mb-8">
              {burnUnlockSteps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10">
                    <step.icon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Step {i + 1} — {step.title}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            {status && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-white">
                    {status.evm_burns_detected.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Burns detected</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-orange-400">
                    {status.l1_unlocks_confirmed.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Unlocks done</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RELAY STATS ────────────────────────────────────────────────── */}
        {status && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <Activity className="h-5 w-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Relay statistics</h2>
              <span className="ml-auto text-xs text-gray-500">
                Updated {new Date(status.fetched_at).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: 'Efficiency',
                  value: `${efficiency}%`,
                  color: efficiency >= 95 ? 'text-emerald-400' : efficiency >= 80 ? 'text-yellow-400' : 'text-red-400',
                },
                {
                  label: 'Errors total',
                  value: status.errors_total,
                  color: status.errors_total === 0 ? 'text-emerald-400' : 'text-red-400',
                },
                {
                  label: 'Unlocks submitted',
                  value: status.l1_unlocks_submitted,
                  color: 'text-white',
                },
                {
                  label: 'Uptime',
                  value: formatUptime(status.uptime_seconds),
                  color: 'text-cyan-300',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4 text-center"
                >
                  <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── CONTRACT ADDRESSES ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8"
        >
          <h2 className="text-xl font-semibold text-white mb-2">Contract addresses</h2>
          <p className="text-sm text-gray-400 mb-6">
            {BRIDGE_CONTRACTS.network} · Chain ID {BRIDGE_CONTRACTS.chain_id}
          </p>

          <div className="space-y-3">
            {[
              { label: 'wZION (ERC-20)', addr: BRIDGE_CONTRACTS.wzion_address },
              { label: 'ZIONBridge (relay escrow)', addr: BRIDGE_CONTRACTS.bridge_address },
            ].map(({ label, addr }) => (
              <div
                key={addr}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="font-mono text-sm text-white break-all">{addr}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyAddr(addr)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors"
                    title="Copy address"
                  >
                    <Copy className="h-4 w-4 text-gray-400" />
                  </button>
                  <Link
                    href={`${BRIDGE_CONTRACTS.explorer_base}${addr}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors"
                    title="View on BaseScan"
                  >
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </Link>
                </div>
                {copied === addr && (
                  <span className="text-xs text-emerald-400 font-semibold">Copied!</span>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SECURITY NOTES ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="rounded-[28px] border border-yellow-500/20 bg-yellow-500/5 p-6 md:p-8"
        >
          <div className="flex items-start gap-4">
            <Shield className="h-6 w-6 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">Security &amp; testnet notice</h2>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">12-block finality</strong> — L1 locks require 12 confirmations before minting. EVM burns require 64 blocks.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Guardian multi-sig</strong> — All treasury operations require ≥3/5 Guardian signatures.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Testnet only</strong> — This bridge operates on Base Sepolia. Do
                    NOT send mainnet ETH/ZION. Mainnet launch pending audit.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ── LINKS ──────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="rounded-[28px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/20 via-zion-gold/10 to-zion-purple/20 p-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">Resources</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: 'Bridge architecture docs',
                href: '/docs',
                desc: 'Relay design, Guardian flow, Prometheus metrics, security model.',
              },
              {
                label: 'wZION contract (BaseScan)',
                href: `${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`,
                desc: 'Verify wZION ERC-20 source code on Base Sepolia explorer.',
                external: true,
              },
              {
                label: 'L2 DEX — swap wZION',
                href: '/roadmap',
                desc: 'Uniswap V3 pool coming in DEX-03. wZION/WETH 0.3% fee tier.',
              },
            ].map((link) => (
              <div
                key={link.label}
                className="rounded-2xl border border-white/10 bg-black/40 p-5 hover:bg-black/60 transition-colors"
              >
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-2 text-sm text-gray-300">{link.desc}</p>
                <Link
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noreferrer' : undefined}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </motion.section>

      </div>
    </div>
  );
}
