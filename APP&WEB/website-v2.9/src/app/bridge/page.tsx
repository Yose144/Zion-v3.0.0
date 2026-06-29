'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Shield,
  Copy,
  ChevronDown,
  Clock,
  ExternalLink,
  Lock,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import {
  getBridgeStatus,
  formatUptime,
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from '@/lib/bridge-api';
import { useLang } from '@/contexts/LanguageContext';
import BridgeBurnWidget from '@/components/BridgeBurnWidget';
import { usePolling } from '@/hooks/usePolling';

// ─── FAQ (only 4 key questions) ──────────────────────────────────────────────

const getFaqs = (cs: boolean) => [
  {
    q: cs ? 'Jak dlouho to trvá?' : 'How long does it take?',
    a: cs
      ? 'ZION → wZION: ~10 min (60 L1 bloků finalita + mint). wZION → ZION: ~5 min (64 EVM bloků + L1 unlock).'
      : 'ZION → wZION: ~10 min (60 L1 block finality + mint). wZION → ZION: ~5 min (64 EVM blocks + L1 unlock).',
  },
  {
    q: cs ? 'Jaký je poplatek?' : 'Is there a fee?',
    a: cs
      ? 'Žádný protokolový poplatek. Platíš jen L1 TX fee (ZION) a EVM gas (ETH na Base).'
      : 'No protocol fee. You only pay L1 TX fee (ZION) and EVM gas (ETH on Base).',
  },
  {
    q: cs ? 'Jaký je minimální obnos?' : 'What is the minimum amount?',
    a: cs ? 'Minimum 100 ZION na transakci.' : 'Minimum 100 ZION per transaction.',
  },
  {
    q: cs ? 'Je to bezpečné?' : 'Is it safe?',
    a: cs
      ? 'Ano — 5/5 Guardian validátory, 60-block L1 finalita, replay-attack prevence. Bridge kontrakt je na Base Mainnet.'
      : 'Yes — 5/5 Guardian validators, 60-block L1 finality, replay-attack prevention. Bridge contract is on Base Mainnet.',
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
  const [tab, setTab] = useState<'lock' | 'burn'>('lock');
  const [memoAddr, setMemoAddr] = useState('');

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

  const memoString = `BRIDGE:base:${memoAddr || '0xYourEvmAddress'}`;
  const totalBridged = status ? status.evm_mints_confirmed : 0;

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-4xl space-y-8">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-cyan-400 uppercase">
              <ArrowLeftRight className="h-4 w-4" />
              L1 ↔ Base
            </div>
            {status && (
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${status.online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                <span className={`h-2 w-2 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {status.online ? (cs ? 'Online' : 'Online') : (cs ? 'Offline' : 'Offline')}
              </span>
            )}
            {status?.online && (
              <span className="text-xs text-gray-400">Uptime: <span className="text-white font-mono">{formatUptime(status.uptime_seconds)}</span></span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight mb-3">
            {cs ? 'Bridge ZION ↔ wZION' : 'Bridge ZION ↔ wZION'}
          </h1>

          <p className="text-lg text-gray-300 mb-6">
            {cs
              ? 'Zamkni ZION na L1 → přijmi wZION na Base. Nebo spal wZION → přijmi ZION na L1. 1:1 peg, žádné poplatky.'
              : 'Lock ZION on L1 → receive wZION on Base. Or burn wZION → receive ZION on L1. 1:1 peg, no fees.'}
          </p>

          {/* Quick stats */}
          {status && (
            <div className="grid grid-cols-3 gap-3">
              <div className="zion-rainbow-sub p-3 text-center" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                <p className="text-xl font-bold text-emerald-400">{totalBridged}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Mintů' : 'Mints'}</p>
              </div>
              <div className="zion-rainbow-sub p-3 text-center" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                <p className="text-xl font-bold text-orange-400">{status.evm_burns_detected}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Burnů' : 'Burns'}</p>
              </div>
              <div className="zion-rainbow-sub p-3 text-center" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                <p className="text-xl font-bold text-white">{status.l1_unlocks_confirmed}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Unlocků' : 'Unlocks'}</p>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── BRIDGE WIDGET (tabbed) ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
        >
          {/* Tab switcher */}
          <div className="flex gap-2 mb-6 p-1 rounded-2xl border border-white/10 bg-black/30">
            <button
              onClick={() => setTab('lock')}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${tab === 'lock' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-gray-400 hover:text-white'}`}
            >
              <Lock className="h-4 w-4" />
              {cs ? 'ZION → wZION' : 'ZION → wZION'}
            </button>
            <button
              onClick={() => setTab('burn')}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${tab === 'burn' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'text-gray-400 hover:text-white'}`}
            >
              <Flame className="h-4 w-4" />
              {cs ? 'wZION → ZION' : 'wZION → ZION'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === 'lock' ? (
              <motion.div
                key="lock"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* Step 1: Bridge address */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                    {cs ? 'Krok 1 — Pošli ZION na bridge adresu' : 'Step 1 — Send ZION to bridge address'}
                  </p>
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <code className="flex-1 font-mono text-sm text-emerald-300 break-all">
                      {BRIDGE_CONTRACTS.l1_bridge_address}
                    </code>
                    <button onClick={() => copyText(BRIDGE_CONTRACTS.l1_bridge_address, 'l1addr')} className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors">
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {copied === 'l1addr' && <p className="text-xs text-emerald-400 mt-1">✓ {cs ? 'Zkopírováno' : 'Copied'}</p>}
                </div>

                {/* Step 2: Memo */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                    {cs ? 'Krok 2 — Přidej memo s tvou EVM adresou' : 'Step 2 — Include memo with your EVM address'}
                  </p>
                  <input
                    type="text"
                    value={memoAddr}
                    onChange={(e) => setMemoAddr(e.target.value)}
                    placeholder="0xYourEvmAddress"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 mb-3"
                  />
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <code className="flex-1 font-mono text-sm text-emerald-300 break-all">{memoString}</code>
                    <button onClick={() => copyText(memoString, 'memo')} className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors">
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {copied === 'memo' && <p className="text-xs text-emerald-400 mt-1">✓ {cs ? 'Zkopírováno' : 'Copied'}</p>}
                </div>

                {/* Step 3: Wait */}
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <Clock className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">
                    {cs ? 'Počkej ~10 min. Relay detekuje lock, počká na finalitu a mintne wZION na tvou Base adresu.' : 'Wait ~10 min. Relay detects lock, waits for finality, mints wZION to your Base address.'}
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  {cs ? 'Minimum: 100 ZION · Formát memo: ' : 'Minimum: 100 ZION · Memo format: '}
                  <code className="text-gray-400">BRIDGE:base:0x...</code>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="burn"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <BridgeBurnWidget />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── FAQ ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
        >
          <h2 className="text-xl font-semibold text-white mb-4">{cs ? 'Časté dotazy' : 'FAQ'}</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
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

        {/* ── CONTRACTS (compact footer) ── */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-5"
          style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-gray-400">{BRIDGE_CONTRACTS.network} · Chain {BRIDGE_CONTRACTS.chain_id} · 5/5 Guardians</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                wZION <ExternalLink className="h-3 w-3" />
              </Link>
              <Link href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.bridge_address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                Bridge <ExternalLink className="h-3 w-3" />
              </Link>
              <Link href="/explorer/bridge" className="inline-flex items-center gap-1 text-gray-400 hover:text-white">
                {cs ? 'Pipeline tracker' : 'Pipeline tracker'} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
