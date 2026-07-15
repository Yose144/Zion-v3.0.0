'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Lock,
  Flame,
  Activity,
  Copy,
  ChevronDown,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Key,
  Info,
  HelpCircle,
  Shield,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import {
  getEscrowAddress,
  getHtlcStatus,
  getPendingHtlcs,
  submitClaim,
  submitRefund,
  type HtlcRecord,
} from '@/lib/swap-api';

// ─── Stat Card helper (matches /defi & /bridge) ───────────────────────────────

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  tip,
  rc = '6, 182, 212',
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
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': rc } as CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}>
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

// ─── Swap Tabs (same pattern as /defi & /bridge) ─────────────────────────────

type SectionTab = 'create' | 'manage' | 'track';

const SECTIONS: { key: SectionTab; labelCs: string; labelEn: string; icon: typeof Zap }[] = [
  { key: 'create', labelCs: 'Vytvořit zámek', labelEn: 'Create Lock', icon: Zap },
  { key: 'manage', labelCs: 'Uplatnit / Refund', labelEn: 'Claim / Refund', icon: Key },
  { key: 'track', labelCs: 'Sledovat', labelEn: 'Track', icon: Activity },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const getFaqs = (cs: boolean) => [
  {
    q: cs ? 'Co je HTLC swap?' : 'What is an HTLC swap?',
    a: cs
      ? 'Hash Time-Locked Contract (HTLC) umožňuje trustless cross-chain swap. Provedení vyžaduje znalost preimage nebo vypršení časového zámku.'
      : 'A Hash Time-Locked Contract (HTLC) enables a trustless cross-chain swap. Settlement requires either the preimage or the timelock to expire.',
  },
  {
    q: cs ? 'Jak dlouho trvá swap?' : 'How long does a swap take?',
    a: cs
      ? 'Vytvoření zámku je okamžité po potvrzení L1 transakce. Claim probíhá během několika minut. Refund je možný až po vypršení timelocku.'
      : 'Locking is immediate after the L1 transaction confirms. Claiming takes a few minutes. Refunds are only possible after the timelock expires.',
  },
  {
    q: cs ? 'Jaký je minimální obnos?' : 'What is the minimum amount?',
    a: cs ? 'Minimum 100 ZION na jeden HTLC lock.' : 'Minimum 100 ZION per HTLC lock.',
  },
  {
    q: cs ? 'Je to bezpečné?' : 'Is it safe?',
    a: cs
      ? 'Ano — swap je chráněn SHA-256 hashlockem a časovým zámkem. Escrow drží tokeny pouze do claimu/refundu.'
      : 'Yes — the swap is secured by a SHA-256 hashlock and a timelock. The escrow only holds tokens until claim or refund.',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SwapPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  // State management
  const [escrowAddress, setEscrowAddress] = useState<string>('');
  const [escrowLoading, setEscrowAddressLoading] = useState(true);
  const [pendingHtlcs, setPendingHtlcs] = useState<HtlcRecord[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SectionTab>('create');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Forms state
  const [initAmt, setInitAmt] = useState('1000');
  const [initChain, setInitChain] = useState('base');
  const [initRecipient, setInitRecipient] = useState('');
  const [initTimeout, setInitTimeout] = useState('120');
  const [initPreimage, setInitPreimage] = useState('');
  const [generatedPreimage, setGeneratedPreimage] = useState<string | null>(null);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);

  // Claim/Refund form state
  const [actionHash, setActionHash] = useState('');
  const [actionPreimage, setActionPreimage] = useState('');
  const [actionRecipient, setActionRecipient] = useState('');
  const [actionToken, setActionToken] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Query/Search state
  const [searchHash, setSearchHash] = useState('');
  const [searchResult, setSearchResult] = useState<HtlcRecord | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const faqs = getFaqs(cs);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const loadInitialData = useCallback(async () => {
    try {
      setEscrowAddressLoading(true);
      const res = await getEscrowAddress();
      if (res && res.escrow_address) {
        setEscrowAddress(res.escrow_address);
      }
    } catch {
      // ignore
    } finally {
      setEscrowAddressLoading(false);
    }

    try {
      setPendingLoading(true);
      const list = await getPendingHtlcs();
      setPendingHtlcs(list);
    } catch {
      // ignore
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Generate cryptographic preimage and hashlock
  const handleGenerateKeys = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const preimage = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    setGeneratedPreimage(preimage);

    const hexBytes = new Uint8Array(preimage.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    window.crypto.subtle.digest('SHA-256', hexBytes).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      setGeneratedHash(hash);
    });
  };

  // Claim swap handler
  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionHash || !actionPreimage || !actionRecipient) {
      setActionMessage({ text: cs ? 'Vyplňte prosím všechna pole' : 'Please fill in all fields', success: false });
      return;
    }
    try {
      setActionLoading(true);
      setActionMessage(null);
      const res = await submitClaim({
        hashHex: actionHash.trim(),
        preimageHex: actionPreimage.trim(),
        recipient: actionRecipient.trim(),
        token: actionToken.trim() || undefined,
      });
      if (res.success) {
        setActionMessage({
          text: cs
            ? `Swap úspěšně uplatněn! Release TX ID: ${res.release_tx_id || 'vytvořena'}`
            : `Swap claimed successfully! Release TX ID: ${res.release_tx_id || 'submitted'}`,
          success: true,
        });
        void loadInitialData();
      } else {
        setActionMessage({ text: res.message, success: false });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Error', success: false });
    } finally {
      setActionLoading(false);
    }
  };

  // Refund swap handler
  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionHash) {
      setActionMessage({ text: cs ? 'Zadejte prosím hashlock' : 'Please enter hashlock', success: false });
      return;
    }
    try {
      setActionLoading(true);
      setActionMessage(null);
      const res = await submitRefund({
        hashHex: actionHash.trim(),
        token: actionToken.trim() || undefined,
      });
      if (res.success) {
        setActionMessage({
          text: cs
            ? `Refund úspěšně odeslán! Release TX ID: ${res.release_tx_id || 'vytvořena'}`
            : `Refund processed successfully! Release TX ID: ${res.release_tx_id || 'submitted'}`,
          success: true,
        });
        void loadInitialData();
      } else {
        setActionMessage({ text: res.message, success: false });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Error', success: false });
    } finally {
      setActionLoading(false);
    }
  };

  // Query handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchHash) return;
    try {
      setSearchLoading(true);
      setSearchError(null);
      setSearchResult(null);
      const htlc = await getHtlcStatus(searchHash.trim());
      if (htlc) {
        setSearchResult(htlc);
      } else {
        setSearchError(cs ? 'HTLC nebylo nalezeno.' : 'HTLC lock not found.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Error');
    } finally {
      setSearchLoading(false);
    }
  };

  const getSwapMemo = () => {
    if (!generatedHash) return '';
    return `SWAP:LOCK:${generatedHash}:${initTimeout}:${initChain}:${initRecipient}`;
  };

  // Derived statistics
  const totalLocked = pendingHtlcs.reduce((sum, h) => sum + (h.amount_flowers ?? 0), 0) / 1_000_000;
  const claimedCount = pendingHtlcs.filter(h => h.state === 'claimed').length;
  const refundedCount = pendingHtlcs.filter(h => h.state === 'refunded').length;
  const activeCount = pendingHtlcs.filter(h => h.state === 'locked').length;
  const avgTimelock = pendingHtlcs.length
    ? Math.round(pendingHtlcs.reduce((sum, h) => sum + (h.timeout_mins ?? 0), 0) / pendingHtlcs.length)
    : 0;

  const escrowOnline = !escrowLoading && Boolean(escrowAddress);

  return (
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-amber-500/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-purple-500/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-cyan/10 blur-3xl" />
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
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <ArrowLeftRight className="h-4 w-4 text-zion-purple" />
                {cs ? 'Atomic Swap · L1 ↔ EVM' : 'Atomic Swap · L1 ↔ EVM'}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {cs ? 'ZION L1 ↔ EVM řetězce' : 'ZION L1 ↔ EVM chains'}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'ZION Atomic Swap' : 'ZION Atomic Swap'}
                </h1>
              </div>

              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Plně decentralizované cross-chain swapy bez prostředníků. Trustless HTLC protokol chráněný SHA-256 hashlocky a časovými zámky.'
                  : 'Fully decentralized cross-chain swaps with no middlemen. Trustless HTLC protocol secured by SHA-256 hashlocks and timelocks.'}
              </p>

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`zion-badge ${escrowOnline ? 'zion-badge-green' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                  <span className={`h-2 w-2 rounded-full ${escrowOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {escrowOnline ? (cs ? 'Escrow Ready' : 'Escrow Ready') : (cs ? 'Escrow Offline' : 'Escrow Offline')}
                </span>

                <span className="zion-badge">
                  <ShieldCheck className="h-3.5 w-3.5 text-zion-gold" />
                  <span className="text-gray-300">HTLC:</span>
                  <span className="font-mono text-white">SHA-256</span>
                </span>

                <span className="zion-badge">
                  <Clock className="h-3.5 w-3.5 text-zion-cyan" />
                  <span className="text-gray-300">{cs ? 'Min. časový zámek' : 'Min timelock'}:</span>
                  <span className="font-mono text-white">30 min</span>
                </span>
              </div>
            </div>

            {/* Quick info side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  {cs ? 'Rychlý přehled' : 'Quick Overview'}
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Wallet className="h-4 w-4 text-zion-purple" />
                      {cs ? 'Escrow adresa' : 'Escrow Address'}
                    </div>
                    <span className="font-mono text-white text-xs truncate max-w-[160px]">
                      {escrowLoading ? (cs ? 'Načítám…' : 'Loading…') : (escrowAddress || (cs ? 'Nedostupná' : 'Unavailable'))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Unlock className="h-4 w-4 text-zion-cyan" />
                      {cs ? 'Aktivní zámky' : 'Active Locks'}
                    </div>
                    <span className="font-mono text-white">{activeCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <ShieldCheck className="h-4 w-4 text-zion-purple" />
                      {cs ? 'Celkem zamčeno' : 'Total Locked'}
                    </div>
                    <span className="font-mono text-white">{totalLocked.toLocaleString()} ZION</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Activity className={`h-4 w-4 ${escrowOnline ? 'text-zion-cyan' : 'text-red-400'}`} />
                      {cs ? 'Relayer' : 'Relayer'}
                    </div>
                    <span className={`font-mono ${escrowOnline ? 'text-zion-cyan' : 'text-red-300'}`}>
                      {escrowOnline ? (cs ? 'Online' : 'Online') : (cs ? 'Offline' : 'Offline')}
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
              {cs ? 'Statistiky swapů' : 'Swap Statistics'}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? 'Metriky HTLC swapů agregované z daemon API v reálném čase.'
                : 'HTLC swap metrics aggregated from the daemon API in real time.'}
            </p>
          </div>

          {pendingLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
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
                colorClass="text-cyan-400"
                bgClass="bg-cyan-400/10"
                rc="6, 182, 212"
                label={cs ? 'Celkem locků' : 'Total Locks'}
                value={pendingHtlcs.length.toLocaleString()}
                sub={cs ? 'Všechny HTLC' : 'All HTLCs'}
                tip={cs ? 'Celkový počet HTLC záznamů detekovaných daemonem.' : 'Total number of HTLC records detected by the daemon.'}
              />
              <StatCard
                icon={<Flame className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"
                rc="147, 51, 234"
                label={cs ? 'Refundováno' : 'Refunded'}
                value={refundedCount.toLocaleString()}
                sub={cs ? 'Po vypršení' : 'After expiry'}
                tip={cs ? 'Počet HTLC, které byly refundovány po vypršení časového zámku.' : 'Number of HTLCs refunded after the timelock expired.'}
              />
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                colorClass="text-cyan-400"
                bgClass="bg-cyan-400/10"
                rc="6, 182, 212"
                label={cs ? 'Uplatněno' : 'Claimed'}
                value={claimedCount.toLocaleString()}
                sub={cs ? 'Úspěšné swapy' : 'Successful swaps'}
                tip={cs ? 'Počet HTLC úspěšně uplatněných pomocí preimage.' : 'Number of HTLCs successfully claimed with a preimage.'}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-cyan-400"
                bgClass="bg-cyan-400/10"
                rc="6, 182, 212"
                label={cs ? 'Aktivní' : 'Active'}
                value={activeCount.toLocaleString()}
                sub={cs ? 'Čekající' : 'Pending'}
                tip={cs ? 'Počet HTLC zámek čekajících na claim nebo refund.' : 'Number of HTLC locks waiting for claim or refund.'}
              />
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"
                rc="147, 51, 234"
                label={cs ? 'Celkem ZION' : 'Total ZION'}
                value={`${totalLocked.toLocaleString()} ZION`}
                sub={cs ? 'Zamčeno v escrow' : 'Locked in escrow'}
                tip={cs ? 'Celkový objem ZION tokenů zamčených v aktivních HTLC.' : 'Total volume of ZION tokens locked in active HTLCs.'}
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"
                rc="147, 51, 234"
                label={cs ? 'Prům. timelock' : 'Avg Timelock'}
                value={`${avgTimelock} min`}
                sub={cs ? 'Na lock' : 'Per lock'}
                tip={cs ? 'Průměrná délka časového zámku pro aktivní HTLC.' : 'Average timelock duration for active HTLCs.'}
              />
              <StatCard
                icon={<Shield className="h-5 w-5" />}
                colorClass="text-cyan-400"
                bgClass="bg-cyan-400/10"
                rc="6, 182, 212"
                label={cs ? 'Hash algoritmus' : 'Hash Algorithm'}
                value="SHA-256"
                sub={cs ? 'Zabezpečení' : 'Security'}
                tip={cs ? 'Algoritmus použitý pro výpočet hashlocku z preimage.' : 'Algorithm used to derive the hashlock from the preimage.'}
              />
              <StatCard
                icon={<Sparkles className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"
                rc="147, 51, 234"
                label={cs ? 'Protokol' : 'Protocol'}
                value="v3.0.6"
                sub={cs ? 'HTLC Atomic Swap' : 'HTLC Atomic Swap'}
                tip={cs ? 'Aktuální verze ZION Atomic Swap protokolu.' : 'Current version of the ZION Atomic Swap protocol.'}
              />
            </div>
          )}
        </motion.div>
      </section>

      {/* ── Tab Bar ── */}
      <section className="zion-container relative z-10 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="zion-rainbow-card p-4"
          style={{ '--rc': '6, 182, 212' } as CSSProperties}
        >
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'zion-rainbow-sub'
                      : 'border border-white/10 bg-black/30 text-gray-300 hover:border-white/25 hover:text-white'
                  }`}
                  style={isActive ? ({ '--rc': '6, 182, 212' } as CSSProperties) : undefined}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-zion-cyan' : 'text-gray-400'}`} />
                  {cs ? s.labelCs : s.labelEn}
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── Tab Content ── */}
      <section className="zion-container relative z-10 mb-12">
        <AnimatePresence mode="wait">
          {activeTab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="zion-rainbow-card p-6 md:p-8 space-y-6"
              style={{ '--rc': '6, 182, 212' } as CSSProperties}
            >
              <div className="flex items-center gap-3">
                <div className="zion-rainbow-sub p-3 text-cyan-400" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{cs ? 'Iniciovat Swap' : 'Initiate Swap'}</h2>
                  <p className="text-xs text-gray-500">ZION L1 → Target Chain (Base / EVM)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                      {cs ? 'ZION L1 Částka' : 'ZION L1 Amount'}
                    </label>
                    <input
                      type="number"
                      value={initAmt}
                      onChange={e => setInitAmt(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-amber-500 focus:outline-none"
                      placeholder="1000"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                        {cs ? 'Cílová síť' : 'Target Chain'}
                      </label>
                      <select
                        value={initChain}
                        onChange={e => setInitChain(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="base">Base</option>
                        <option value="ethereum">Ethereum</option>
                        <option value="bsc">BSC</option>
                        <option value="polygon">Polygon</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                        {cs ? 'Časový zámek (min)' : 'Timelock (Mins)'}
                      </label>
                      <input
                        type="number"
                        value={initTimeout}
                        onChange={e => setInitTimeout(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-amber-500 focus:outline-none"
                        placeholder="120"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                      {cs ? 'Cílová adresa příjemce (EVM)' : 'Target Recipient Address (EVM)'}
                    </label>
                    <input
                      type="text"
                      value={initRecipient}
                      onChange={e => setInitRecipient(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-amber-500 focus:outline-none"
                      placeholder="0xYourEvmAddress"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Preimage Generator */}
                  <div className="zion-rainbow-sub p-4 space-y-3" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300">
                        {cs ? '1. Vygenerovat hash klíče' : '1. Generate Hash Keys'}
                      </span>
                      <button
                        onClick={handleGenerateKeys}
                        className="zion-button-primary text-xs py-1.5 px-3"
                      >
                        {cs ? 'Generovat' : 'Generate'}
                      </button>
                    </div>

                    {generatedPreimage && (
                      <div className="space-y-2 text-xs font-mono">
                        <div className="zion-rainbow-sub p-2 relative" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                          <div className="text-[9px] text-gray-500 uppercase">Preimage (SAVE THIS!)</div>
                          <div className="text-white break-all pr-8 mt-1">{generatedPreimage}</div>
                          <button
                            onClick={() => handleCopy(generatedPreimage, 'preimage')}
                            className="zion-button-secondary absolute right-2 top-2 p-1.5"
                          >
                            <Copy className={`h-3 w-3 ${copied === 'preimage' ? 'text-emerald-400' : 'text-gray-400'}`} />
                          </button>
                        </div>

                        <div className="zion-rainbow-sub p-2 relative" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                          <div className="text-[9px] text-gray-500 uppercase">Hashlock (SHA-256)</div>
                          <div className="text-cyan-400 break-all pr-8 mt-1">{generatedHash}</div>
                          <button
                            onClick={() => handleCopy(generatedHash!, 'hash')}
                            className="zion-button-secondary absolute right-2 top-2 p-1.5"
                          >
                            <Copy className={`h-3 w-3 ${copied === 'hash' ? 'text-emerald-400' : 'text-gray-400'}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Memo Builder */}
                  {generatedHash && initRecipient && (
                    <div className="zion-rainbow-sub p-4 space-y-2 text-xs" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                      <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
                        <Info className="h-4 w-4" />
                        {cs ? '2. Odeslat transakci na ZION L1' : '2. Send Transaction on ZION L1'}
                      </div>
                      <p className="text-gray-400">
                        {cs
                          ? 'Pošli nativní ZION na escrow adresu se zadaným memo. Daemon automaticky detekuje lock.'
                          : 'Send native ZION to the escrow address with this exact memo. Daemon will auto-detect the lock.'}
                      </p>
                      <div className="space-y-1.5 font-mono zion-rainbow-sub p-3 relative" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                        <div><span className="text-gray-500">Escrow:</span> <span className="text-white break-all">{escrowLoading ? 'Loading…' : (escrowAddress || 'Unavailable')}</span></div>
                        <div><span className="text-gray-500">Amount:</span> <span className="text-white">{initAmt} ZION</span></div>
                        <div><span className="text-gray-500">Memo:</span> <span className="text-cyan-400 break-all">{getSwapMemo()}</span></div>
                        <button
                          onClick={() => handleCopy(getSwapMemo(), 'memo')}
                          className="zion-button-secondary absolute right-2 top-2 p-1.5"
                        >
                          <Copy className={`h-3.5 w-3.5 ${copied === 'memo' ? 'text-emerald-400' : 'text-gray-400'}`} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'manage' && (
            <motion.div
              key="manage"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="zion-rainbow-card p-6 md:p-8 space-y-6"
              style={{ '--rc': '147, 51, 234' } as CSSProperties}
            >
              <div className="flex items-center gap-3">
                <div className="zion-rainbow-sub p-3 text-purple-400" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{cs ? 'Spravovat HTLC zámek' : 'Manage HTLC Lock'}</h2>
                  <p className="text-xs text-gray-500">{cs ? 'Uplatnit swap (Claim) nebo refundovat' : 'Claim swap (reveal preimage) or request refund'}</p>
                </div>
              </div>

              <form className="space-y-4 max-w-3xl">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                    Hashlock (SHA-256 Hex)
                  </label>
                  <input
                    type="text"
                    value={actionHash}
                    onChange={e => setActionHash(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-purple-500 focus:outline-none text-xs"
                    placeholder="64-character hex"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                    Preimage (pouze pro Claim)
                  </label>
                  <input
                    type="text"
                    value={actionPreimage}
                    onChange={e => setActionPreimage(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-purple-500 focus:outline-none text-xs"
                    placeholder="64-character hex"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                      {cs ? 'Příjemce (L1 adresa)' : 'Recipient (L1 address)'}
                    </label>
                    <input
                      type="text"
                      value={actionRecipient}
                      onChange={e => setActionRecipient(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-purple-500 focus:outline-none text-xs"
                      placeholder="zion1…"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                      {cs ? 'Bearer Token (Volitelný)' : 'Bearer Token (Optional)'}
                    </label>
                    <input
                      type="password"
                      value={actionToken}
                      onChange={e => setActionToken(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white focus:border-purple-500 focus:outline-none text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleClaim}
                    disabled={actionLoading}
                    className="flex-1 zion-button-primary disabled:opacity-50"
                  >
                    {actionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {cs ? 'Uplatnit (Claim)' : 'Claim Swap'}
                  </button>
                  <button
                    onClick={handleRefund}
                    disabled={actionLoading}
                    className="zion-button-secondary px-6 disabled:opacity-50"
                  >
                    {cs ? 'Refund' : 'Refund'}
                  </button>
                </div>
              </form>

              <AnimatePresence>
                {actionMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-xl text-xs flex gap-2 max-w-3xl zion-rainbow-sub ${
                      actionMessage.success ? 'text-emerald-400' : 'text-red-400'
                    }`}
                    style={{ '--rc': actionMessage.success ? '16, 185, 129' : '239, 68, 68' } as CSSProperties}
                  >
                    {actionMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
                    <span className="break-all">{actionMessage.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'track' && (
            <motion.div
              key="track"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Query panel */}
              <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Search className="h-4 w-4 text-cyan-400" />
                  {cs ? 'Vyhledat HTLC Lock' : 'Track HTLC Lock'}
                </h3>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchHash}
                    onChange={e => setSearchHash(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Enter 64-character hashlock"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="zion-button-secondary px-4 py-2 text-xs font-semibold"
                  >
                    {searchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (cs ? 'Hledat' : 'Search')}
                  </button>
                </form>

                {searchError && <div className="text-xs text-red-400 font-medium">{searchError}</div>}

                {searchResult && (
                  <div className="zion-rainbow-sub p-4 space-y-2 text-xs font-mono relative" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                    <div className="flex justify-between">
                      <span className="text-gray-500">State:</span>
                      <span
                        className={`font-bold uppercase ${
                          searchResult.state === 'claimed'
                            ? 'text-emerald-400'
                            : searchResult.state === 'refunded'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {searchResult.state}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount:</span>
                      <span className="text-white">{(searchResult.amount_flowers / 1_000_000).toLocaleString()} ZION</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Timeout:</span>
                      <span className="text-white">{searchResult.timeout_mins} mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Chain:</span>
                      <span className="text-white uppercase">{searchResult.target_chain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Recipient:</span>
                      <span className="text-white break-all">{searchResult.recipient_addr}</span>
                    </div>
                    {searchResult.release_tx_id && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">TX ID:</span>
                        <span className="text-white break-all">{searchResult.release_tx_id}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Active pending locks table */}
              <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Activity className="h-5 w-5 text-cyan-400" />
                      {cs ? 'Aktivní HTLC Zámky' : 'Active HTLC Locks'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {cs ? 'Čekající na uplatnění nebo vypršení časového zámku' : 'Pending claim or waiting for refund on expiry'}
                    </p>
                  </div>
                  <button
                    onClick={loadInitialData}
                    disabled={pendingLoading}
                    className="zion-button-secondary p-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${pendingLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/10">
                        <th className="py-3 px-4">Hash</th>
                        <th className="py-3 px-4">{cs ? 'Částka' : 'Amount'}</th>
                        <th className="py-3 px-4">{cs ? 'Síť' : 'Chain'}</th>
                        <th className="py-3 px-4">{cs ? 'Příjemce' : 'Recipient'}</th>
                        <th className="py-3 px-4">{cs ? 'Zámek' : 'Timelock'}</th>
                        <th className="py-3 px-4">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">
                            {cs ? 'Načítám locks…' : 'Loading locks…'}
                          </td>
                        </tr>
                      ) : pendingHtlcs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                            {cs ? 'Žádné aktivní HTLC zámky v daemonu' : 'No active HTLC locks in the daemon'}
                          </td>
                        </tr>
                      ) : (
                        pendingHtlcs.map(rec => (
                          <tr key={String(rec.hash_hex)} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                            <td className="py-3 px-4 font-mono text-gray-400 break-all max-w-[120px]">{rec.hash_hex}</td>
                            <td className="py-3 px-4 font-bold">{(rec.amount_flowers / 1_000_000).toLocaleString()} ZION</td>
                            <td className="py-3 px-4 uppercase font-semibold text-gray-300">{rec.target_chain}</td>
                            <td className="py-3 px-4 font-mono text-gray-400 break-all max-w-[150px]">{rec.recipient_addr}</td>
                            <td className="py-3 px-4 text-gray-400">{rec.timeout_mins} mins</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                rec.state === 'claimed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : rec.state === 'refunded'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {rec.state}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── FAQ ── */}
      <section className="zion-container relative z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-6 md:p-8"
          style={{ '--rc': '147, 51, 234' } as CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'FAQ' : 'FAQ'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <HelpCircle className="h-7 w-7 text-purple-400" />
              {cs ? 'Často kladené dotazy' : 'Frequently Asked Questions'}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="zion-rainbow-sub" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="font-semibold text-white">{f.q}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-4 text-sm text-gray-400">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="zion-container relative z-10 mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="zion-cta-banner"
        >
          <h2 className="text-2xl font-semibold text-white text-center mb-6">
            {cs ? 'Více o ZION DeFi' : 'Learn more about ZION DeFi'}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/bridge" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
              <ArrowLeftRight className="h-4 w-4 text-zion-cyan" /> {cs ? 'Bridge' : 'Bridge'}
            </a>
            <a href="/defi" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
              <TrendingUp className="h-4 w-4 text-zion-cyan" /> {cs ? 'DeFi Hub' : 'DeFi Hub'}
            </a>
            <a href="/docs" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
              <ExternalLink className="h-4 w-4 text-cyan-400" /> {cs ? 'Dokumentace' : 'Documentation'}
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
