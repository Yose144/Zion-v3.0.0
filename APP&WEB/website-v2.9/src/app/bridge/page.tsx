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
  HelpCircle,
  ShieldCheck,
  Unlock,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { useState, useCallback, type CSSProperties } from 'react';
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'lock' | 'burn';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof Lock }[] = [
  { key: 'lock', labelCs: 'ZION → wZION', labelEn: 'ZION → wZION', icon: Lock },
  { key: 'burn', labelCs: 'wZION → ZION', labelEn: 'wZION → ZION', icon: Flame },
];

// ─── Stat Card (matches /defi & /pool) ─────────────────────────────────────────

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  tip,
  rc = '147, 51, 234',
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  tip?: string;
  rc?: string;
}) {
  return (
    <div
      className="zion-rainbow-sub p-4 transition-colors"
      style={{ '--rc': rc } as CSSProperties}
    >
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}
      >
        {icon}
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

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
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 182, 212' } as CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <ArrowLeftRight className="h-4 w-4 text-zion-cyan" />
                {cs ? 'Bridge · L1 ↔ Base' : 'Bridge · L1 ↔ Base'}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {cs ? 'ZION L1 ↔ Base L2' : 'ZION L1 ↔ Base L2'}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'Most ZION' : 'ZION Bridge'}
                </h1>
              </div>

              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Zamkni ZION na L1 → přijmi wZION na Base. Nebo spal wZION → přijmi ZION na L1. 1:1 peg, žádné poplatky.'
                  : 'Lock ZION on L1 → receive wZION on Base. Or burn wZION → receive ZION on L1. 1:1 peg, no fees.'}
              </p>

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {status ? (
                  <span
                    className={`zion-badge ${
                      status.online
                        ? 'zion-badge-green'
                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                      }`}
                    />
                    {status.online
                      ? (cs ? 'Relay Online' : 'Relay Online')
                      : (cs ? 'Relay Offline' : 'Relay Offline')}
                  </span>
                ) : (
                  <span className="zion-badge">
                    <span className="h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
                    {cs ? 'Kontroluji…' : 'Checking…'}
                  </span>
                )}

                {status?.online && (
                  <span className="zion-badge">
                    {status.online ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-orange-400" />
                    )}
                    <span className="text-gray-300">Uptime:</span>
                    <span className="font-mono text-white">{formatUptime(status.uptime_seconds)}</span>
                  </span>
                )}

                {status?.online && (
                  <span className="zion-badge">
                    <Activity className="h-3.5 w-3.5 text-zion-gold" />
                    <span className="text-gray-300">L1:</span>
                    <span className="font-mono text-white">{status.last_l1_height.toLocaleString()}</span>
                  </span>
                )}

                {status?.online && (
                  <span className="zion-badge">
                    <Activity className="h-3.5 w-3.5 text-zion-cyan" />
                    <span className="text-gray-300">EVM:</span>
                    <span className="font-mono text-white">{status.last_evm_block.toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick info side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div
                className="zion-rainbow-sub p-5"
                style={{ '--rc': '6, 182, 212' } as CSSProperties}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  {cs ? 'Rychlý přehled' : 'Quick Overview'}
                </p>
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': '251, 191, 36' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Wallet className="h-4 w-4 text-zion-gold" />
                      {cs ? 'Zamčeno' : 'Locked'}
                    </div>
                    <span className="font-mono text-white">{totalBridged.toLocaleString()} ZION</span>
                  </div>
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 182, 212' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Unlock className="h-4 w-4 text-zion-cyan" />
                      {cs ? 'Unlocky' : 'Unlocks'}
                    </div>
                    <span className="font-mono text-white">{(status?.l1_unlocks_confirmed ?? 0).toLocaleString()}</span>
                  </div>
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': '16, 185, 129' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      {cs ? 'Validátoři' : 'Validators'}
                    </div>
                    <span className="font-mono text-white">5/5</span>
                  </div>
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': status?.online ? '16, 185, 129' : '239, 68, 68' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Activity className={`h-4 w-4 ${status?.online ? 'text-emerald-400' : 'text-red-400'}`} />
                      {cs ? 'Relay' : 'Relay'}
                    </div>
                    <span className={`font-mono ${status?.online ? 'text-emerald-300' : 'text-red-300'}`}>
                      {status?.online ? (cs ? 'Online' : 'Online') : (cs ? 'Offline' : 'Offline')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Quick Stats ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? 'Statistiky bridge' : 'Bridge Statistics'}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? 'Metriky mostu agregované z relayer API v reálném čase.'
                : 'Bridge metrics aggregated from the relayer API in real time.'}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="zion-rainbow-sub p-4 animate-pulse"
                  style={{ '--rc': '6, 182, 212' } as CSSProperties}
                >
                  <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-6 w-20 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<Lock className="h-5 w-5" />}
                colorClass="text-emerald-400"
                bgClass="bg-emerald-400/10"
                rc="16, 185, 129"
                label={cs ? 'Minty' : 'Mints'}
                value={(status?.evm_mints_confirmed ?? 0).toLocaleString()}
                sub={cs ? 'L1 → Base' : 'L1 → Base'}
                tip={cs ? 'Celkový počet wZION mintnutých na Base po zamčení ZION na L1.' : 'Total wZION minted on Base after locking ZION on L1.'}
              />
              <StatCard
                icon={<Flame className="h-5 w-5" />}
                colorClass="text-orange-400"
                bgClass="bg-orange-400/10"
                rc="249, 115, 22"
                label={cs ? 'Burny' : 'Burns'}
                value={(status?.evm_burns_detected ?? 0).toLocaleString()}
                sub={cs ? 'Base → L1' : 'Base → L1'}
                tip={cs ? 'Celkový počet burn eventů wZION detekovaných na EVM.' : 'Total wZION burn events detected on EVM.'}
              />
              <StatCard
                icon={<Unlock className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                rc="255, 215, 0"
                label={cs ? 'Unlocky' : 'Unlocks'}
                value={(status?.l1_unlocks_confirmed ?? 0).toLocaleString()}
                sub={cs ? 'potvrzeno' : 'confirmed'}
                tip={cs ? 'Celkový počet L1 unlocků potvrzených relayem.' : 'Total L1 unlocks confirmed by the relay.'}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-blue-400"
                bgClass="bg-blue-400/10"
                rc="59, 130, 246"
                label={cs ? 'Chyby' : 'Errors'}
                value={(status?.errors_total ?? 0).toLocaleString()}
                sub={cs ? 'celkem' : 'total'}
                tip={cs ? 'Celkový počet chyb zaznamenaných relayerem.' : 'Total errors logged by the relayer.'}
              />
              <StatCard
                icon={<Lock className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                rc="6, 182, 212"
                label={cs ? 'Locky' : 'Locks'}
                value={(status?.l1_locks_finalized ?? 0).toLocaleString()}
                sub={cs ? 'finalizováno' : 'finalized'}
                tip={cs ? 'L1 locky dosažené 60-block finality.' : 'L1 locks that reached 60-block finality.'}
              />
              <StatCard
                icon={<ShieldCheck className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"
                rc="147, 51, 234"
                label={cs ? 'Validátoři' : 'Validators'}
                value="5/5"
                sub={cs ? 'Guardian relay' : 'Guardian relay'}
                tip={cs ? 'Guardian validátoři — quorum 5/5.' : 'Guardian validators — 5/5 quorum.'}
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                colorClass="text-teal-400"
                bgClass="bg-teal-400/10"
                rc="20, 184, 166"
                label={cs ? 'Uptime' : 'Uptime'}
                value={status ? formatUptime(status.uptime_seconds) : '—'}
                sub={cs ? 'relay běží' : 'relay running'}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                colorClass="text-amber-400"
                bgClass="bg-amber-400/10"
                rc="251, 191, 36"
                label={cs ? 'Efektivita' : 'Efficiency'}
                value={`${status ? bridgeEfficiency(status) : 0}%`}
                sub={cs ? 'finalizováno / detekováno' : 'finalized / detected'}
                tip={cs ? 'Poměr finalizovaných locků k detekovaným lockům.' : 'Ratio of finalized locks to detected locks.'}
              />
            </div>
          )}
        </motion.div>
      </section>

      {/* ── Tab Navigation ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="zion-rainbow-card p-4 md:p-5"
          style={{ '--rc': '6, 182, 212' } as CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
              {cs ? 'Bridge operace' : 'Bridge operations'}
            </span>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 !px-4 !py-2 text-sm font-medium transition ${
                    active
                      ? 'zion-rainbow-sub text-zion-cyan'
                      : 'zion-panel-soft text-gray-300 hover:text-white'
                  }`}
                  style={active ? ({ '--rc': '6, 182, 212' } as CSSProperties) : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cs ? t.labelCs : t.labelEn}
                </button>
              );
            })}
          </div>
        </motion.div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lock & Mint widget */}
              <div
                className="zion-rainbow-card p-6"
                style={{ '--rc': '6, 182, 212' } as CSSProperties}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Lock className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">
                    {cs ? 'Zamkni ZION na L1' : 'Lock ZION on L1'}
                  </h2>
                </div>

                {/* Step 1: Bridge address */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                    {cs ? 'Krok 1 — Pošli ZION na bridge adresu' : 'Step 1 — Send ZION to bridge address'}
                  </p>
                  <div
                    className="flex items-center gap-3 zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 182, 212' } as CSSProperties}
                  >
                    <code className="flex-1 font-mono text-sm text-cyan-300 break-all">
                      {BRIDGE_CONTRACTS.l1_bridge_address}
                    </code>
                    <button
                      onClick={() => copyText(BRIDGE_CONTRACTS.l1_bridge_address, 'l1addr')}
                      className="zion-button-secondary shrink-0 !p-2"
                    >
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {copied === 'l1addr' && (
                    <p className="text-xs text-emerald-400 mt-1">✓ {cs ? 'Zkopírováno' : 'Copied'}</p>
                  )}
                </div>

                {/* Step 2: Memo */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                    {cs ? 'Krok 2 — Přidej memo s tvou EVM adresou' : 'Step 2 — Include memo with your EVM address'}
                  </p>
                  <div
                    className="zion-rainbow-sub p-1 mb-3"
                    style={{ '--rc': '6, 182, 212' } as CSSProperties}
                  >
                    <input
                      type="text"
                      value={memoAddr}
                      onChange={(e) => setMemoAddr(e.target.value)}
                      placeholder="0xYourEvmAddress"
                      className="w-full rounded-lg border-0 bg-transparent px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 outline-none"
                    />
                  </div>
                  <div
                    className="flex items-center gap-3 zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 182, 212' } as CSSProperties}
                  >
                    <code className="flex-1 font-mono text-sm text-cyan-300 break-all">{memoString}</code>
                    <button
                      onClick={() => copyText(memoString, 'memo')}
                      className="zion-button-secondary shrink-0 !p-2"
                    >
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {copied === 'memo' && (
                    <p className="text-xs text-emerald-400 mt-1">✓ {cs ? 'Zkopírováno' : 'Copied'}</p>
                  )}
                </div>

                {/* Step 3: Wait */}
                <div
                  className="flex items-start gap-3 zion-rainbow-sub p-4 mb-4"
                  style={{ '--rc': '6, 182, 212' } as CSSProperties}
                >
                  <Clock className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">
                    {cs
                      ? 'Počkej ~10 min. Relay detekuje lock, počká na finalitu a mintne wZION na tvou Base adresu.'
                      : 'Wait ~10 min. Relay detects lock, waits for finality, mints wZION to your Base address.'}
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  {cs ? 'Minimum: 100 ZION · Formát memo: ' : 'Minimum: 100 ZION · Memo format: '}
                  <code className="text-gray-400">BRIDGE:base:0x...</code>
                </p>
              </div>

              {/* Side info */}
              <div className="space-y-6">
                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '6, 182, 212' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-4">
                    {cs ? 'Jak to funguje' : 'How it works'}
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        icon: Lock,
                        text: cs
                          ? 'Pošli ZION na bridge escrow adresu s memo'
                          : 'Send ZION to bridge escrow address with memo',
                        rc: '16, 185, 129',
                        color: 'text-emerald-400',
                      },
                      {
                        icon: Shield,
                        text: cs
                          ? 'Relay ověří 60-block finalitu + Guardian threshold'
                          : 'Relay verifies 60-block finality + Guardian threshold',
                        rc: '251, 191, 36',
                        color: 'text-zion-gold',
                      },
                      {
                        icon: ArrowRight,
                        text: cs
                          ? 'ZIONBridge mintne wZION na tvou Base adresu'
                          : 'ZIONBridge mints wZION to your Base address',
                        rc: '6, 182, 212',
                        color: 'text-zion-cyan',
                      },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg zion-rainbow-sub"
                          style={{ '--rc': step.rc } as CSSProperties}
                        >
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed pt-1">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '6, 182, 212' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-3">
                    {cs ? 'Kontrakty' : 'Contracts'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '6, 182, 212' } as CSSProperties}
                    >
                      <span className="text-gray-400">wZION</span>
                      <Link
                        href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      >
                        BaseScan <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '6, 182, 212' } as CSSProperties}
                    >
                      <span className="text-gray-400">ZIONBridge</span>
                      <Link
                        href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.bridge_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      >
                        BaseScan <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '147, 51, 234' } as CSSProperties}
                    >
                      <span className="text-gray-400">{cs ? 'Pipeline tracker' : 'Pipeline tracker'}</span>
                      <Link href="/explorer/bridge" className="inline-flex items-center gap-1 text-gray-400 hover:text-white">
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-gray-500">
                      {BRIDGE_CONTRACTS.network} · Chain {BRIDGE_CONTRACTS.chain_id} · 5/5 Guardians
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'burn' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className="zion-rainbow-card p-5"
                style={{ '--rc': '251, 191, 36' } as CSSProperties}
              >
                <BridgeBurnWidget />
              </div>
              <div className="space-y-6">
                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '251, 191, 36' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-4">
                    {cs ? 'Jak to funguje' : 'How it works'}
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        icon: Flame,
                        text: cs
                          ? 'Spal wZION na Base (burn(amount, l1Recipient))'
                          : 'Burn wZION on Base (burn(amount, l1Recipient))',
                        rc: '251, 191, 36',
                        color: 'text-zion-gold',
                      },
                      {
                        icon: Shield,
                        text: cs
                          ? 'EVM watcher čeká 64-block finalitu'
                          : 'EVM watcher waits 64-block finality',
                        rc: '251, 191, 36',
                        color: 'text-zion-gold',
                      },
                      {
                        icon: ArrowRight,
                        text: cs
                          ? 'Relay odešle L1 unlock, ZION dorazí na tvou adresu'
                          : 'Relay submits L1 unlock, ZION arrives to your address',
                        rc: '6, 182, 212',
                        color: 'text-zion-cyan',
                      },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg zion-rainbow-sub"
                          style={{ '--rc': step.rc } as CSSProperties}
                        >
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed pt-1">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '6, 182, 212' } as CSSProperties}
                >
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
          className="zion-section"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Podpora' : 'Support'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <HelpCircle className="h-7 w-7 text-blue-400" />
              {cs ? 'Časté dotazy' : 'FAQ'}
            </h2>
          </div>
          <div className="space-y-3 max-w-3xl">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="zion-rainbow-card overflow-hidden"
                style={{ '--rc': '6, 182, 212' } as CSSProperties}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <span className="text-sm font-medium text-white">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
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
