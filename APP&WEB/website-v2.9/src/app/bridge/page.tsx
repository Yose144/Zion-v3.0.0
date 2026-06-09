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
  ChevronDown,
  Terminal,
  Network,
  Info,
  TrendingUp,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import {
  getBridgeStatus,
  formatUptime,
  bridgeEfficiency,
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from '@/lib/bridge-api';
import { useLang } from '@/contexts/LanguageContext';
import BridgeBurnWidget from '@/components/BridgeBurnWidget';
import { usePolling } from '@/hooks/usePolling';

// ─── Steps data ───────────────────────────────────────────────────────────────

const getLockMintSteps = (cs: boolean) => [
  {
    icon: Lock,
    title: tr('bridgePage', 'lock_zion_on_l1', lang),
    desc: cs
      ? 'Pošli nativní ZION na escrow adresu bridge na ZION L1. Přidej bridge memo do transakce.'
      : 'Send native ZION to the ZIONBridge escrow address on ZION L1. Include the bridge memo in the transaction.',
  },
  {
    icon: Shield,
    title: tr('bridgePage', 'relay_detects_verifies', lang),
    desc: cs
      ? 'Rust relay monitoruje L1 bloky, čeká 60-block finalitu a validuje Guardian threshold.'
      : 'The Rust relay monitors L1 blocks, waits 60-block finality, validates Guardian threshold.',
  },
  {
    icon: Zap,
    title: tr('bridgePage', 'receive_wzion_on_base', lang),
    desc: cs
      ? 'ZIONBridge kontrakt mintne wZION ERC-20 do tvé peněženky na Base Mainnet. 1:1 peg, žádné poplatky.'
      : 'ZIONBridge contract mints wZION ERC-20 to your wallet on Base Mainnet. 1:1 peg, no fees.',
  },
];

const getBurnUnlockSteps = (cs: boolean) => [
  {
    icon: Flame,
    title: tr('bridgePage', 'burn_wzion_on_base', lang),
    desc: cs
      ? 'Zavolej burn(amount, l1Recipient) na wZION ERC-20 kontraktu. 18 decimálů.'
      : 'Call burn(amount, l1Recipient) on the wZION ERC-20 contract. 18 decimals.',
  },
  {
    icon: Shield,
    title: tr('bridgePage', 'relay_verifies_burn', lang),
    desc: cs
      ? 'EVM watcher detekuje BurnForBridge event, čeká 64-block EVM finalitu, odešle L1 unlock.'
      : 'EVM watcher detects the BurnForBridge event, waits 64-block EVM finality, submits L1 unlock.',
  },
  {
    icon: CheckCircle2,
    title: tr('bridgePage', 'receive_zion_on_l1', lang),
    desc: cs
      ? 'L1 zpracuje unlock memo a uvolní escrow ZION na tvou adresu. Žádné extra poplatky.'
      : 'L1 processes the unlock memo and releases escrowed ZION to your address. No extra fees.',
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const getFaqs = (cs: boolean) => [
  {
    q: tr('bridgePage', 'how_long_does_bridging_take', lang),
    a: cs
      ? 'L1→Base: ~60 L1 bloků (~10 min) pro finalitu + EVM mint potvrzení. Base→L1: ~64 EVM bloků (~2 min) pro finalitu + L1 unlock zpracování.'
      : 'L1→Base: ~60 L1 blocks (~10 min) for finality, then EVM mint confirmation. Base→L1: ~64 EVM blocks (~2 min) for finality, then L1 unlock processing.',
  },
  {
    q: tr('bridgePage', 'what_is_the_minimum_bridge_amount', lang),
    a: cs
      ? 'Minimum je 100 ZION na transakci. Částky nad 1 000 000 ZION vyžadují 24h timelock.'
      : 'Minimum is 100 ZION per transaction. Amounts above 1,000,000 ZION require a 24h timelock.',
  },
  {
    q: tr('bridgePage', 'what_memo_format_is_required_for_l1_base', lang),
    a: cs
      ? 'BRIDGE:base:0xTVOJE_EVM_ADRESA — „BRIDGE" velkými, „base" malými, 42-znakový hex address s 0x prefixem.'
      : 'BRIDGE:base:0xYOUR_EVM_ADDRESS — uppercase BRIDGE, chain name "base" (lowercase), 42-char hex address with 0x prefix.',
  },
  {
    q: tr('bridgePage', 'is_there_a_bridge_fee', lang),
    a: cs
      ? 'Žádný poplatek protokolu. Platíš pouze standardní L1 TX fee (ZION) a EVM gas pro mint (ETH na Base).'
      : 'No protocol fee. You only pay standard L1 transaction fee (ZION) and EVM gas for the mint transaction (ETH on Base).',
  },
  {
    q: tr('bridgePage', 'what_happens_if_a_transaction_is_lost', lang),
    a: cs
      ? 'Relay používá INSERT OR IGNORE — duplikátní TX hashe jsou přeskočeny, dokončené operace nelze replayovat.'
      : 'The relay uses INSERT OR IGNORE — duplicate TX hashes silently skipped, completed operations cannot be replayed.',
  },
  {
    q: tr('bridgePage', 'is_the_bridge_safe', lang),
    a: cs
      ? 'Bridge běží na Base Mainnet s replay-attack prevencí, ≥2 Guardian potvrzeními a 60-block finalitou.'
      : 'The bridge runs on Base Mainnet with replay-attack prevention, ≥2 Guardian confirmations, and 60-block finality.',
  },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BridgePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [memoAddr, setMemoAddr] = useState('0xYourEvmAddress');

  const lockMintSteps = getLockMintSteps(cs);
  const burnUnlockSteps = getBurnUnlockSteps(cs);
  const faqs = getFaqs(cs);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getBridgeStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  usePolling(load, 15_000);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const efficiency = status ? bridgeEfficiency(status) : 0;
  const memoString = `BRIDGE:base:${memoAddr}`;

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">

        {/* ── HERO ── */}
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
                Base Mainnet · Replay-safe
              </div>
            </div>

            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">ZION ↔ wZION · Base Mainnet</p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {cs ? <>Bridge nativní ZION<br className="hidden sm:block" /> do EVM světa</> : <>Bridge native ZION<br className="hidden sm:block" /> to the EVM world</>}
              </h1>
            </div>

            <p className="text-lg text-gray-300 max-w-3xl">
              {cs
                ? 'Zamkni ZION na L1 → přijmi wZION na Base. Rust relay s Guardian multi-sig, 60-block finalitou, Prometheus monitoringem a replay-attack prevencí.'
                : 'Lock ZION on L1 → receive wZION on Base. Rust relay with Guardian multi-sig, 60-block finality, Prometheus monitoring, replay-attack prevention.'}
            </p>

            {/* Live status */}
            <div className="flex flex-wrap items-center gap-4">
              {status ? (
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${status.online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                  <span className={`h-2 w-2 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {status.online ? 'Relay online' : 'Relay offline'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-semibold text-gray-400">
                  <span className="h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
                  {tr('bridgePage', 'checking_status', lang)}
                </span>
              )}

              {status?.online && (
                <>
                  <span className="text-sm text-gray-400">Uptime: <span className="text-white font-mono">{formatUptime(status.uptime_seconds)}</span></span>
                  <span className="text-sm text-gray-400">L1: <span className="text-white font-mono">{status.last_l1_height.toLocaleString()}</span></span>
                  <span className="text-sm text-gray-400">EVM: <span className="text-white font-mono">{status.last_evm_block.toLocaleString()}</span></span>
                </>
              )}

              <button onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {tr('bridgePage', 'refresh', lang)}
              </button>
            </div>
          </div>
        </motion.section>

        {/* ── TWO DIRECTIONS ── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Lock & Mint */}
          <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-black/60 p-6 md:p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">{tr('bridgePage', 'direction_a', lang)}</p>
                <h2 className="text-2xl font-semibold text-white">Lock &amp; Mint</h2>
                <p className="text-sm text-gray-400 mt-1">ZION (L1) → wZION (Base)</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Live
              </span>
            </div>
            <ol className="space-y-4 mb-8">
              {lockMintSteps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                    <step.icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tr('bridgePage', 'step', lang)} {i + 1} — {step.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            {status && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-white">{status.l1_locks_detected.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{tr('bridgePage', 'locks', lang)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{status.evm_mints_confirmed.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{tr('bridgePage', 'mints', lang)}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Burn & Unlock */}
          <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-orange-500/20 bg-gradient-to-b from-orange-500/5 to-black/60 p-6 md:p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-orange-400">{tr('bridgePage', 'direction_b', lang)}</p>
                <h2 className="text-2xl font-semibold text-white">Burn &amp; Unlock</h2>
                <p className="text-sm text-gray-400 mt-1">wZION (Base) → ZION (L1)</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Live
              </span>
            </div>
            <ol className="space-y-4 mb-8">
              {burnUnlockSteps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10">
                    <step.icon className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tr('bridgePage', 'step', lang)} {i + 1} — {step.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            {status && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-white">{status.evm_burns_detected.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{tr('bridgePage', 'burns', lang)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <p className="text-lg font-bold text-orange-400">{status.l1_unlocks_confirmed.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{tr('bridgePage', 'unlocks', lang)}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── TRY IT LIVE ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-orange-500/20 bg-gradient-to-b from-orange-500/5 to-black/60 p-6 md:p-10">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="h-5 w-5 text-orange-400" />
            <h2 className="text-xl font-semibold text-white">{tr('bridgePage', 'burn_wzion_directly', lang)}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-8 ml-8">
            {tr('bridgePage', 'have_wzion_on_base_connect_metamask_and_burn_', lang)}
          </p>
          <div className="grid gap-6 md:grid-cols-2 items-start">
            <BridgeBurnWidget />
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{tr('bridgePage', 'what_happens_after_you_burn', lang)}</p>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">1.</span>
                    <span><code className="text-orange-300 rounded bg-white/10 px-1 text-xs">BurnForBridge</code> {tr('bridgePage', 'event_emitted_on_base', lang)}</span>
                  </li>
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">2.</span>
                    <span>{tr('bridgePage', 'evm_watcher_waits', lang)} <strong className="text-white">64 {tr('bridgePage', 'blocks', lang)}</strong> (~2 min)</span>
                  </li>
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">3.</span>
                    <span>{tr('bridgePage', 'relay_submits_unlock_to_zion_l1', lang)}</span>
                  </li>
                  <li className="flex gap-2 text-gray-300">
                    <span className="text-orange-400 font-bold shrink-0">4.</span>
                    <span>{tr('bridgePage', 'l1_releases_zion_to_your_address', lang)}</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── MEMO GUIDE ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-black/60 p-6 md:p-10">
          <div className="flex items-center gap-3 mb-2">
            <Terminal className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">{tr('bridgePage', 'how_to_initiate_a_bridge_transfer', lang)}</h2>
          </div>
          <p className="text-sm text-gray-400 mb-8 ml-8">{tr('bridgePage', 'detailed_instructions_for_both_directions_inc', lang)}</p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* L1 → Base */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">A</span>
                <h3 className="font-semibold text-white">ZION → wZION (L1 → Base)</h3>
              </div>
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs text-emerald-400">1</span>
                  <div>
                    <p className="text-white font-medium">{tr('bridgePage', 'add_your_evm_address_to_the_memo_builder_belo', lang)}</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs text-emerald-400">2</span>
                  <div>
                    <p className="text-white font-medium">{tr('bridgePage', 'send_zion_to_the_bridge_address', lang)}</p>
                    <p className="text-gray-400 mt-0.5">{tr('bridgePage', 'include_the_generated_memo_minimum', lang)} <strong className="text-white">100 ZION</strong></p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 text-xs text-emerald-400">3</span>
                  <div>
                    <p className="text-white font-medium">{tr('bridgePage', 'wait_10_min_60_l1_blocks', lang)}</p>
                    <p className="text-gray-400 mt-0.5">{tr('bridgePage', 'relay_detects_lock_waits_for_finality_mints_w', lang)}</p>
                  </div>
                </li>
              </ol>
              <div className="rounded-2xl border border-cyan-500/20 bg-black/50 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">{tr('bridgePage', 'memo_format', lang)}</p>
                <code className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-emerald-300">
                  BRIDGE:<span className="text-cyan-300">base</span>:<span className="text-yellow-300">0x<span className="opacity-60">YourEvmAddress</span></span>
                </code>
              </div>
            </div>

            {/* Base → L1 */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">B</span>
                <h3 className="font-semibold text-white">wZION → ZION (Base → L1)</h3>
              </div>
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 text-xs text-orange-400">1</span>
                  <div>
                    <p className="text-white font-medium">{tr('bridgePage', 'use_the_burn_widget_above_or_basescan', lang)}</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 text-xs text-orange-400">2</span>
                  <div>
                    <p className="text-white font-medium">{tr('bridgePage', 'call', lang)} <code className="rounded bg-white/10 px-1 text-orange-300">burn(amount, l1Recipient)</code></p>
                    <p className="text-gray-400 mt-0.5">amount: wei (×10<sup>18</sup>) · l1Recipient: {tr('bridgePage', 'your_l1_address', lang)}</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 text-xs text-orange-400">3</span>
                  <div>
                    <p className="text-white font-medium">{tr('bridgePage', 'wait_2_min_64_evm_blocks', lang)}</p>
                  </div>
                </li>
              </ol>
              <div className="rounded-2xl border border-orange-500/20 bg-black/50 p-4">
                <p className="text-xs uppercase tracking-wider text-orange-400 font-semibold mb-2">{tr('bridgePage', 'example_500_wzion', lang)}</p>
                <code className="block rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-orange-200 break-all">
                  burn(500000000000000000000, &quot;ZoYourL1Address&quot;)
                </code>
                <p className="text-xs text-gray-500 mt-2">500 × 10<sup>18</sup> (18 {tr('bridgePage', 'decimals', lang)})</p>
              </div>
            </div>
          </div>

          {/* Memo builder */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-cyan-400" />
              <p className="text-sm font-semibold text-white">Memo builder (L1 → Base)</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 w-36">Base Mainnet</div>
              <input type="text" value={memoAddr} onChange={(e) => setMemoAddr(e.target.value)} placeholder="0xYourEvmAddress" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600" />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <code className="flex-1 font-mono text-sm text-emerald-300 break-all">{memoString}</code>
              <button onClick={() => copyText(memoString, 'memo')} className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors">
                <Copy className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            {copied === 'memo' && <p className="text-xs text-emerald-400 mt-2 font-semibold">✓ {tr('bridgePage', 'copied', lang)}</p>}
          </div>
        </motion.section>

        {/* ── RELAY STATS ── */}
        {status && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="h-5 w-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">{tr('bridgePage', 'relay_statistics', lang)}</h2>
              <span className="ml-auto text-xs text-gray-500">{new Date(status.fetched_at).toLocaleTimeString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: tr('bridgePage', 'efficiency', lang), value: `${efficiency}%`, color: efficiency >= 95 ? 'text-emerald-400' : 'text-yellow-400' },
                { label: tr('bridgePage', 'errors', lang), value: status.errors_total, color: status.errors_total === 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: tr('bridgePage', 'unlocks_1', lang), value: status.l1_unlocks_submitted, color: 'text-white' },
                { label: 'Uptime', value: formatUptime(status.uptime_seconds), color: 'text-cyan-300' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/40 p-4 text-center">
                  <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── ARCHITECTURE ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <Network className="h-5 w-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">{tr('bridgePage', 'architecture', lang)}</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-2 overflow-x-auto pb-2">
            {[
              { label: 'ZION L1', sub: tr('bridgePage', 'native_chain', lang), color: 'border-cyan-500/40 bg-cyan-500/10', text: 'text-cyan-400' },
              { label: '→', arrow: true },
              { label: 'Bridge Relay', sub: 'Rust · Tokio', color: 'border-purple-500/40 bg-purple-500/10', text: 'text-purple-400' },
              { label: '→', arrow: true },
              { label: 'ZIONBridge.sol', sub: 'EVM contract', color: 'border-blue-500/40 bg-blue-500/10', text: 'text-blue-400' },
              { label: '→', arrow: true },
              { label: 'wZION ERC-20', sub: 'Base Mainnet', color: 'border-emerald-500/40 bg-emerald-500/10', text: 'text-emerald-400' },
            ].map((node, i) =>
              'arrow' in node ? (
                <div key={i} className="text-gray-600 text-3xl font-light">→</div>
              ) : (
                <div key={node.label} className={`shrink-0 rounded-2xl border ${node.color} px-5 py-4 text-center min-w-[130px]`}>
                  <p className={`font-semibold text-sm ${node.text}`}>{node.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{node.sub}</p>
                </div>
              )
            )}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'L1 Watcher', desc: tr('bridgePage', 'polls_l1_api_parses_bridge_memos_validates_60', lang) },
              { name: 'EVM Watcher', desc: tr('bridgePage', 'scans_burnforbridge_events_on_base_in_49k_blo', lang) },
              { name: 'Relayer', desc: tr('bridgePage', 'submits_evm_mint_transactions_and_l1_unlock_c', lang) },
              { name: 'SQLite DB', desc: tr('bridgePage', 'insert_or_ignore_replay_safe_duplicates_skipp', lang) },
            ].map((c) => (
              <div key={c.name} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-sm font-semibold text-white mb-1">{c.name}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── CONTRACTS ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-white mb-2">{tr('bridgePage', 'contract_addresses', lang)}</h2>
          <p className="text-sm text-gray-400 mb-6">{BRIDGE_CONTRACTS.network} · Chain ID {BRIDGE_CONTRACTS.chain_id}</p>
          <div className="space-y-3">
            {[
              { label: 'wZION (ERC-20)', key: 'wzion', addr: BRIDGE_CONTRACTS.wzion_address },
              { label: 'ZIONBridge (relay escrow)', key: 'bridge', addr: BRIDGE_CONTRACTS.bridge_address },
            ].map(({ label, key, addr }) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="font-mono text-sm text-white break-all">{addr}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyText(addr, key)} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors">
                    <Copy className="h-4 w-4 text-gray-400" />
                  </button>
                  <Link href={`${BRIDGE_CONTRACTS.explorer_base}${addr}`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors">
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </Link>
                </div>
                {copied === key && <span className="text-xs text-emerald-400 font-semibold">{tr('bridgePage', 'copied_1', lang)}</span>}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SECURITY ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Shield className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">{tr('bridgePage', 'security_model', lang)}</h2>
              <ul className="space-y-3 text-sm text-gray-300 mb-6">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">{tr('bridgePage', '60_block_l1_finality', lang)}</strong> — {tr('bridgePage', 'prevents_re_org_exploits', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">Guardian multi-sig</strong> — {tr('bridgePage', '2_guardian_confirmations_for_treasury_operati', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">INSERT OR IGNORE</strong> — {tr('bridgePage', 'duplicate_tx_cannot_be_replayed', lang)}</span>
                </li>
              </ul>
              <div className="flex flex-wrap gap-2">
                {['60-block finality', 'INSERT OR IGNORE', 'Guardian ≥2/N', 'auto_pause', 'Prometheus'].map((b) => (
                  <span key={b} className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">{b}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── FAQ ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-10">
          <h2 className="text-xl font-semibold text-white mb-6">{tr('bridgePage', 'faq', lang)}</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <p className="px-5 pb-4 text-sm text-gray-300 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── READINESS CHECKLIST ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">{tr('bridgePage', 'readiness_checklist', lang)}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: tr('bridgePage', 'wzion_contract', lang), done: true },
              { label: tr('bridgePage', 'zionbridge_contract', lang), done: true },
              { label: tr('bridgePage', 'basescan_verified', lang), done: false },
              { label: tr('bridgePage', '3_5_guardian_multisig', lang), done: false },
              { label: tr('bridgePage', 'relay_metrics', lang), done: true },
              { label: tr('bridgePage', 'burn_widget_live', lang), done: true },
              { label: tr('bridgePage', 'l1_base_mint', lang), done: true },
              { label: tr('bridgePage', 'base_l1_unlock', lang), done: true },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${item.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                </div>
                <span className={`text-sm font-medium ${item.done ? 'text-emerald-300' : 'text-yellow-300'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── RESOURCES ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[28px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/20 via-zion-gold/10 to-zion-purple/20 p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">{tr('bridgePage', 'resources', lang)}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: tr('bridgePage', 'architecture_docs', lang), href: '/docs', desc: tr('bridgePage', 'relay_design_guardian_flow_security_model', lang) },
              { label: 'wZION (BaseScan)', href: `${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`, desc: tr('bridgePage', 'wzion_contract_source_on_base_mainnet', lang), external: true },
              { label: 'DeFi Hub', href: '/defi', desc: tr('bridgePage', 'swap_wzion_eth_portfolio_pool_price', lang) },
            ].map((res) => (
              <Link key={res.label} href={res.href} target={'external' in res ? '_blank' : undefined} rel={'external' in res ? 'noreferrer' : undefined} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white group-hover:text-zion-gold transition-colors">{res.label}</p>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-zion-gold transition-colors" />
                </div>
                <p className="text-xs text-gray-400">{res.desc}</p>
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
