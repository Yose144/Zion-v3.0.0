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
  Activity,
  Wifi,
  WifiOff,
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'lock' | 'burn';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof Lock }[] = [
  { key: 'lock', labelCs: 'ZION → wZION', labelEn: 'ZION → wZION', icon: Lock },
  { key: 'burn', labelCs: 'wZION → ZION', labelEn: 'wZION → ZION', icon: Flame },
];

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
  const [tab, setTab] = useState<Tab>('lock');
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
    <div className="relative overflow-hidden bg-black text-white pt-28 pb-16">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-4 flex items-center gap-3">
            <ArrowLeftRight className="h-5 w-5 text-zion-gold" />
            <span className="text-xs uppercase tracking-[0.35em] text-gray-400">
              ZION L1 ↔ Base L2
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">
            <span className="text-gradient">Bridge</span>
          </h1>

          <p className="mb-6 max-w-2xl text-lg leading-relaxed text-gray-300">
            {cs
              ? 'Zamkni ZION na L1 → přijmi wZION na Base. Nebo spal wZION → přijmi ZION na L1. 1:1 peg, žádné poplatky.'
              : 'Lock ZION on L1 → receive wZION on Base. Or burn wZION → receive ZION on L1. 1:1 peg, no fees.'}
          </p>

          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {status ? (
              <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 ${status.online ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                <div className={`h-2 w-2 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className={`text-xs font-semibold ${status.online ? 'text-emerald-300' : 'text-red-300'}`}>
                  {status.online ? (cs ? 'Relay Online' : 'Relay Online') : (cs ? 'Relay Offline' : 'Relay Offline')}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
                <div className="h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
                <span className="text-xs text-gray-400">{cs ? 'Kontroluji…' : 'Checking…'}</span>
              </div>
            )}

            {status?.online && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                {status.online ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-orange-400" />}
                <span className="text-gray-300">Uptime:</span>
                <span className="font-mono text-white">{formatUptime(status.uptime_seconds)}</span>
              </div>
            )}

            {status?.online && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Activity className="h-3.5 w-3.5 text-zion-gold" />
                <span className="text-gray-300">L1:</span>
                <span className="font-mono text-white">{status.last_l1_height.toLocaleString()}</span>
              </div>
            )}

            {status?.online && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Activity className="h-3.5 w-3.5 text-zion-cyan" />
                <span className="text-gray-300">EVM:</span>
                <span className="font-mono text-white">{status.last_evm_block.toLocaleString()}</span>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Quick Stats ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Minty' : 'Mints'}</span>
            </div>
            <p className="text-xl font-bold text-white">{totalBridged}</p>
            <p className="text-[10px] text-gray-500">{cs ? 'L1 → Base' : 'L1 → Base'}</p>
          </div>
          <div className="zion-rainbow-card p-4" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Burny' : 'Burns'}</span>
            </div>
            <p className="text-xl font-bold text-white">{status?.evm_burns_detected ?? 0}</p>
            <p className="text-[10px] text-gray-500">{cs ? 'Base → L1' : 'Base → L1'}</p>
          </div>
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-zion-gold" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Unlocky' : 'Unlocks'}</span>
            </div>
            <p className="text-xl font-bold text-white">{status?.l1_unlocks_confirmed ?? 0}</p>
            <p className="text-[10px] text-gray-500">{cs ? 'potvrzeno' : 'confirmed'}</p>
          </div>
          <div className="zion-rainbow-card p-4" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-zion-cyan" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Chyby' : 'Errors'}</span>
            </div>
            <p className={`text-xl font-bold ${status?.errors_total === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {status?.errors_total ?? 0}
            </p>
            <p className="text-[10px] text-gray-500">{cs ? 'celkem' : 'total'}</p>
          </div>
        </div>
      </section>

      {/* ── Tab Navigation ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="flex gap-1 zion-tile p-1 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                {cs ? t.labelCs : t.labelEn}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Active Tab Content ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tab === 'lock' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
              {/* Lock & Mint widget */}
              <div className="zion-rainbow-card p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-6">
                  <Lock className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">{cs ? 'Zamkni ZION na L1' : 'Lock ZION on L1'}</h2>
                </div>

                {/* Step 1: Bridge address */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
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
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
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
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
                  <Clock className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">
                    {cs ? 'Počkej ~10 min. Relay detekuje lock, počká na finalitu a mintne wZION na tvou Base adresu.' : 'Wait ~10 min. Relay detects lock, waits for finality, mints wZION to your Base address.'}
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  {cs ? 'Minimum: 100 ZION · Formát memo: ' : 'Minimum: 100 ZION · Memo format: '}
                  <code className="text-gray-400">BRIDGE:base:0x...</code>
                </p>
              </div>

              {/* Side info */}
              <div className="space-y-6">
                <div className="zion-rainbow-card p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-white mb-4">{cs ? 'Jak to funguje' : 'How it works'}</h3>
                  <div className="space-y-3">
                    {[
                      { icon: Lock, text: cs ? 'Pošli ZION na bridge escrow adresu s memo' : 'Send ZION to bridge escrow address with memo', color: 'text-emerald-400' },
                      { icon: Shield, text: cs ? 'Relay ověří 60-block finalitu + Guardian threshold' : 'Relay verifies 60-block finality + Guardian threshold', color: 'text-zion-gold' },
                      { icon: ArrowRight, text: cs ? 'ZIONBridge mintne wZION na tvou Base adresu' : 'ZIONBridge mints wZION to your Base address', color: 'text-zion-cyan' },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed pt-1">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="zion-rainbow-card p-6" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-white mb-3">{cs ? 'Kontrakty' : 'Contracts'}</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">wZION</span>
                      <Link href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                        BaseScan <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">ZIONBridge</span>
                      <Link href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.bridge_address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                        BaseScan <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{cs ? 'Pipeline tracker' : 'Pipeline tracker'}</span>
                      <Link href="/explorer/bridge" className="inline-flex items-center gap-1 text-gray-400 hover:text-white">
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-gray-500">{BRIDGE_CONTRACTS.network} · Chain {BRIDGE_CONTRACTS.chain_id} · 5/5 Guardians</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'burn' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
              <BridgeBurnWidget />
              <div className="space-y-6">
                <div className="zion-rainbow-card p-6" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-white mb-4">{cs ? 'Jak to funguje' : 'How it works'}</h3>
                  <div className="space-y-3">
                    {[
                      { icon: Flame, text: cs ? 'Spal wZION na Base (burn(amount, l1Recipient))' : 'Burn wZION on Base (burn(amount, l1Recipient))', color: 'text-orange-400' },
                      { icon: Shield, text: cs ? 'EVM watcher čeká 64-block finalitu' : 'EVM watcher waits 64-block finality', color: 'text-zion-gold' },
                      { icon: ArrowRight, text: cs ? 'Relay odešle L1 unlock, ZION dorazí na tvou adresu' : 'Relay submits L1 unlock, ZION arrives to your address', color: 'text-zion-cyan' },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed pt-1">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="zion-rainbow-card p-6" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                  <h3 className="text-sm font-semibold text-white mb-3">{cs ? 'Detail' : 'Details'}</h3>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p>{cs ? 'Čas: ~5 min (64 EVM bloků + L1 unlock)' : 'Time: ~5 min (64 EVM blocks + L1 unlock)'}</p>
                    <p>{cs ? 'Poplatek: jen EVM gas (ETH na Base)' : 'Fee: only EVM gas (ETH on Base)'}</p>
                    <p>{cs ? 'Minimum: 100 wZION' : 'Minimum: 100 wZION'}</p>
                    <p>{cs ? 'L1 adresa: zion1... nebo Zo...' : 'L1 address: zion1... or Zo...'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mb-4 text-lg font-semibold text-white">{cs ? 'Časté dotazy' : 'FAQ'}</h2>
          <div className="space-y-2 max-w-3xl">
            {faqs.map((faq, i) => (
              <div key={i} className="zion-rainbow-card overflow-hidden" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
                  <span className="text-sm font-medium text-white">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed">{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

    </div>
  );
}
