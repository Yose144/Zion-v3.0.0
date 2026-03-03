'use client';

import { motion, AnimatePresence } from 'framer-motion';
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
  AlertCircle,
  ChevronDown,
  Terminal,
  Network,
  Info,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import {
  getBridgeStatus,
  formatUptime,
  bridgeEfficiency,
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from '@/lib/bridge-api';
import BridgeBurnWidget from '@/components/BridgeBurnWidget';

// ─── Steps data ───────────────────────────────────────────────────────────────

const lockMintSteps = [
  {
    icon: Lock,
    title: 'Lock ZION on L1',
    desc: 'Send native ZION to the ZIONBridge escrow address on ZION L1. Include the bridge memo in the transaction.',
  },
  {
    icon: Shield,
    title: 'Relay detects & verifies',
    desc: 'The Rust relay monitors L1 blocks, waits 60-block finality, validates Guardian threshold.',
  },
  {
    icon: Zap,
    title: 'Receive wZION on Base',
    desc: 'ZIONBridge contract mints wZION ERC-20 to your wallet on Base Sepolia. 1:1 peg, no fees.',
  },
];

const burnUnlockSteps = [
  {
    icon: Flame,
    title: 'Burn wZION on Base',
    desc: 'Call burn(amount, l1Recipient) on the wZION ERC-20 contract with your ZION L1 address.',
  },
  {
    icon: Shield,
    title: 'Relay verifies burn',
    desc: 'EVM watcher detects the BurnForBridge event, waits 64-block EVM finality, submits L1 unlock.',
  },
  {
    icon: CheckCircle2,
    title: 'Receive ZION on L1',
    desc: 'L1 processes the unlock memo and releases escrowed ZION to your address. No extra fees.',
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'How long does bridging take?',
    a: 'L1→Base: ~60 L1 blocks (~10 min on testnet) for finality, then EVM mint confirmation. Base→L1: ~64 EVM blocks (~2 min on Sepolia) for finality, then L1 unlock processing.',
  },
  {
    q: 'What is the minimum bridge amount?',
    a: 'Minimum is 100 ZION per transaction. Amounts above 1,000,000 ZION require a 24h timelock for additional security.',
  },
  {
    q: 'What memo format is required for L1 → Base?',
    a: 'BRIDGE:base:0xYOUR_EVM_ADDRESS — uppercase BRIDGE, chain name "base" (lowercase), 42-char hex address with 0x prefix. Example: BRIDGE:base:0xAbCd...1234',
  },
  {
    q: 'Is there a bridge fee?',
    a: 'No protocol fee. You only pay standard L1 transaction fee (ZION) and EVM gas for the mint transaction (ETH on Base Sepolia). The relay submits EVM txs from a validator wallet.',
  },
  {
    q: 'What happens if a transaction is lost?',
    a: 'The relay uses INSERT OR IGNORE semantics — duplicate TX hashes are silently skipped, completed operations cannot be replayed. If stuck, check the relay logs or contact support.',
  },
  {
    q: 'Is the bridge safe to use on mainnet?',
    a: 'Currently testnet only (Base Sepolia). Mainnet deployment requires contract audit and Guardian set to be established. DO NOT send real ETH/ZION to testnet addresses.',
  },
  {
    q: 'Can I lose funds?',
    a: 'On testnet: funds have no real value. For future mainnet: replay attack prevention (INSERT OR IGNORE) and ≥2 Guardian confirmations protect against double minting. 60-block finality prevents re-org exploits.',
  },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BridgePage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [memoAddr, setMemoAddr] = useState('0xYourEvmAddress');
  const [memoChain, setMemoChain] = useState<'base'>('base');

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getBridgeStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initial = setTimeout(load, 0);
    const id = setInterval(load, 15_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [load]);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const efficiency = status ? bridgeEfficiency(status) : 0;
  const memoString = `BRIDGE:${memoChain}:${memoAddr}`;

  return (
    <div className="zion-shell min-h-screen pt-32 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 p-6 md:p-10 backdrop-blur-xl"
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-cyan-400 uppercase">
                <ArrowLeftRight className="h-4 w-4" />
                L1 ↔ EVM · Cross-chain Bridge
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <Shield className="h-3 w-3" />
                Replay-safe · INSERT OR IGNORE
              </div>
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
              multi-sig, 60-block finality, Prometheus monitoring, replay-attack prevention.
            </p>

            {/* Live status */}
            <div className="flex flex-wrap items-center gap-4">
              {status ? (
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                    status.online
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
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

          {/* Lock & Mint */}
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
                    <p className="text-sm font-semibold text-white">Step {i + 1} — {step.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            {status && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-white">{status.l1_locks_detected.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Locks detected</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{status.evm_mints_confirmed.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Mints confirmed</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Burn & Unlock */}
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
                    <p className="text-sm font-semibold text-white">Step {i + 1} — {step.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            {status && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-white">{status.evm_burns_detected.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Burns detected</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-orange-400">{status.l1_unlocks_confirmed.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Unlocks done</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── TRY IT LIVE — interactive burn widget ──────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[28px] border border-orange-500/20 bg-gradient-to-b from-orange-500/5 to-black/60 p-6 md:p-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <Flame className="h-5 w-5 text-orange-400" />
            <h2 className="text-xl font-semibold text-white">Try it live — Burn wZION</h2>
          </div>
          <p className="text-sm text-gray-400 mb-8 ml-8">
            Have wZION on Base Sepolia? Connect MetaMask and burn directly from this page. No download required.
          </p>
          <div className="grid gap-6 md:grid-cols-2 items-start">
            <BridgeBurnWidget />
            {/* Quick-ref panel */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">What happens after you burn</p>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">1.</span>
                    <span><code className="text-orange-300 rounded bg-white/10 px-1 text-xs">BurnForBridge</code> event emitted on Base Sepolia</span>
                  </li>
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">2.</span>
                    <span>EVM watcher detects event, waits <strong className="text-white">64 block</strong> confirmations (~2 min)</span>
                  </li>
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">3.</span>
                    <span>Relay submits <code className="text-cyan-300 rounded bg-white/10 px-1 text-xs">POST /api/bridge/unlock</code> to ZION L1</span>
                  </li>
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">4.</span>
                    <span>L1 releases escrowed ZION to your recipient address</span>
                  </li>
                </ol>
              </div>
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">Testnet only</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  This widget operates on <strong className="text-white">Base Sepolia</strong>. wZION has no real value. Do NOT send mainnet ETH or wZION to testnet addresses.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── BRIDGE MEMO GUIDE ──────────────────────────────────────────── */}        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[28px] border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-black/60 p-6 md:p-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <Terminal className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">How to initiate a bridge transfer</h2>
          </div>
          <p className="text-sm text-gray-400 mb-8 ml-8">
            Detailed instructions for both directions — including the required L1 memo format.
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* L1 → Base guide */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">A</span>
                <h3 className="font-semibold text-white">ZION → wZION (L1 → Base)</h3>
              </div>

              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs text-emerald-400">1</span>
                  <div>
                    <p className="text-white font-medium">Add your EVM address to the memo builder below</p>
                    <p className="text-gray-400 mt-0.5">The system generates the correct memo string automatically.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs text-emerald-400">2</span>
                  <div>
                    <p className="text-white font-medium">Send ZION to the bridge address via ZION wallet</p>
                    <p className="text-gray-400 mt-0.5">Include the generated memo in your L1 transaction. Minimum: <strong className="text-white">100 ZION</strong>.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs text-emerald-400">3</span>
                  <div>
                    <p className="text-white font-medium">Wait for 60-block L1 finality (~10 min)</p>
                    <p className="text-gray-400 mt-0.5">The relay detects your lock, waits for finality, then mints wZION to your EVM wallet on Base Sepolia.</p>
                  </div>
                </li>
              </ol>

              {/* Memo format */}
              <div className="rounded-2xl border border-cyan-500/20 bg-black/50 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Memo format</p>
                <code className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-emerald-300">
                  BRIDGE:<span className="text-cyan-300">base</span>:<span className="text-yellow-300">0x<span className="opacity-60">YourEvmAddress</span></span>
                </code>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• <strong className="text-white">BRIDGE</strong> — uppercase, exact spelling</li>
                  <li>• <strong className="text-white">base</strong> — chain name (lowercase)</li>
                  <li>• <strong className="text-white">0x…</strong> — 42-char EVM hex address with 0x prefix</li>
                </ul>
              </div>
            </div>

            {/* Base → L1 guide */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">B</span>
                <h3 className="font-semibold text-white">wZION → ZION (Base → L1)</h3>
              </div>

              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 text-xs text-orange-400">1</span>
                  <div>
                    <p className="text-white font-medium">Open BaseScan — wZION contract</p>
                    <p className="text-gray-400 mt-0.5">Go to Contract → Write Contract → connect your wallet.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 text-xs text-orange-400">2</span>
                  <div>
                    <p className="text-white font-medium">Call <code className="rounded bg-white/10 px-1 text-orange-300">burn(amount, l1Recipient)</code></p>
                    <p className="text-gray-400 mt-0.5">
                      <strong className="text-white">amount</strong>: wZION in wei (×10<sup>8</sup> — 8 decimals). <br />
                      <strong className="text-white">l1Recipient</strong>: your ZION L1 address string.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 text-xs text-orange-400">3</span>
                  <div>
                    <p className="text-white font-medium">Wait for 64 EVM blocks (~2 min on Sepolia)</p>
                    <p className="text-gray-400 mt-0.5">The relay detects BurnForBridge event, verifies finality, submits L1 unlock. ZION arrives in your L1 wallet.</p>
                  </div>
                </li>
              </ol>

              <div className="rounded-2xl border border-orange-500/20 bg-black/50 p-4">
                <p className="text-xs uppercase tracking-wider text-orange-400 font-semibold mb-2">Example: 500 wZION</p>
                <code className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-orange-200 break-all">
                  burn(50000000000, &quot;ZoYourL1AddressHere&quot;)
                </code>
                <p className="text-xs text-gray-500 mt-2">500 × 10<sup>8</sup> = 50,000,000,000 (8 decimals)</p>
              </div>
            </div>
          </div>

          {/* Interactive memo builder */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-cyan-400" />
              <p className="text-sm font-semibold text-white">Memo builder (L1 → Base)</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={memoChain}
                onChange={(e) => setMemoChain(e.target.value as 'base')}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white w-36"
              >
                <option value="base">base (Sepolia)</option>
              </select>
              <input
                type="text"
                value={memoAddr}
                onChange={(e) => setMemoAddr(e.target.value)}
                placeholder="0xYourEvmAddress"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600"
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <code className="flex-1 font-mono text-sm text-emerald-300 break-all">{memoString}</code>
              <button
                onClick={() => copyText(memoString, 'memo')}
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors"
                title="Copy memo"
              >
                <Copy className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            {copied === 'memo' && (
              <p className="text-xs text-emerald-400 mt-2 font-semibold">✓ Copied to clipboard</p>
            )}
          </div>
        </motion.section>

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
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/40 p-4 text-center">
                  <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── ARCHITECTURE OVERVIEW ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-10"
        >
          <div className="flex items-center gap-3 mb-8">
            <Network className="h-5 w-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Architecture</h2>
          </div>

          <div className="relative">
            {/* Flow diagram */}
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-2 overflow-x-auto pb-2">
              {[
                { label: 'ZION L1', sub: 'Native blockchain', color: 'border-cyan-500/40 bg-cyan-500/10', text: 'text-cyan-400' },
                { label: '→', sub: '', color: 'border-transparent bg-transparent', text: 'text-gray-400 text-2xl', arrow: true },
                { label: 'Bridge Relay', sub: 'Rust · Tokio async', color: 'border-purple-500/40 bg-purple-500/10', text: 'text-purple-400' },
                { label: '→', sub: '', color: 'border-transparent bg-transparent', text: 'text-gray-400 text-2xl', arrow: true },
                { label: 'ZIONBridge.sol', sub: 'EVM smart contract', color: 'border-blue-500/40 bg-blue-500/10', text: 'text-blue-400' },
                { label: '→', sub: '', color: 'border-transparent bg-transparent', text: 'text-gray-400 text-2xl', arrow: true },
                { label: 'wZION ERC-20', sub: 'Base Sepolia token', color: 'border-emerald-500/40 bg-emerald-500/10', text: 'text-emerald-400' },
              ].map((node, i) =>
                node.arrow ? (
                  <div key={i} className="flex items-center justify-center shrink-0 text-gray-600 text-3xl font-light">→</div>
                ) : (
                  <div key={node.label} className={`shrink-0 rounded-2xl border ${node.color} px-5 py-4 text-center min-w-[140px]`}>
                    <p className={`font-semibold text-sm ${node.text}`}>{node.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{node.sub}</p>
                  </div>
                )
              )}
            </div>

            {/* Relay components */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: 'L1 Watcher', desc: 'Polls ZION L1 API, parses BRIDGE: memos from transaction inputs, validates 60-block finality.' },
                { name: 'EVM Watcher', desc: 'Subscribes to Base Sepolia & scans BurnForBridge events in 49k-block chunks since deployment.' },
                { name: 'Relayer', desc: 'Submits EVM mint transactions (handle_l1_lock) and L1 unlock calls (handle_evm_burn).' },
                { name: 'SQLite DB', desc: 'INSERT OR IGNORE — duplicate TX hashes skipped. Replay-safe: completed ops cannot be reset.' },
              ].map((c) => (
                <div key={c.name} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-sm font-semibold text-white mb-1">{c.name}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── CONTRACT ADDRESSES ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8"
        >
          <h2 className="text-xl font-semibold text-white mb-2">Contract addresses</h2>
          <p className="text-sm text-gray-400 mb-6">
            {BRIDGE_CONTRACTS.network} · Chain ID {BRIDGE_CONTRACTS.chain_id}
          </p>

          <div className="space-y-3">
            {[
              { label: 'wZION (ERC-20)', key: 'wzion', addr: BRIDGE_CONTRACTS.wzion_address },
              { label: 'ZIONBridge (relay escrow)', key: 'bridge', addr: BRIDGE_CONTRACTS.bridge_address },
            ].map(({ label, key, addr }) => (
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
                    onClick={() => copyText(addr, key)}
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
                {copied === key && (
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
          className="rounded-[28px] border border-yellow-500/20 bg-yellow-500/5 p-6 md:p-8"
        >
          <div className="flex items-start gap-4">
            <Shield className="h-6 w-6 text-yellow-400 shrink-0 mt-0.5" />
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Security &amp; testnet notice</h2>
              <ul className="space-y-3 text-sm text-gray-300 mb-6">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">60-block L1 finality</strong> — L1 locks require 60 confirmations before minting. EVM burns require 64 blocks. Prevents re-org exploits.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Guardian multi-sig</strong> — All treasury operations require ≥2 Guardian confirmations (configurable). Threshold stored per-operation.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Replay-attack prevention</strong> — DB uses <code className="rounded bg-white/10 px-1 font-mono text-xs">INSERT OR IGNORE</code>: duplicate TX hashes are silently skipped. A completed lock/burn cannot be replayed to trigger a second mint.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Testnet only</strong> — This bridge operates on Base Sepolia. Do NOT send mainnet ETH/ZION. Mainnet deployment pending contract audit.
                  </span>
                </li>
              </ul>

              {/* Security badge row */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '60-block finality', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
                  { label: 'INSERT OR IGNORE', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
                  { label: 'Guardian ≥2/N', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
                  { label: 'auto_pause enabled', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
                  { label: 'Prometheus monitoring', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
                ].map((b) => (
                  <span key={b.label} className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${b.color}`}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-10"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Frequently asked questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm text-gray-300 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── RESOURCES ──────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
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
