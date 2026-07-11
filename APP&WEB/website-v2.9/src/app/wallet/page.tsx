'use client';

import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import {
  Wallet, Plus, Import, Send, RefreshCw, Trash2, Copy, Eye, EyeOff,
  Shield, KeyRound, Download, BookOpen, Lock, Fingerprint,
  Zap, Globe2, Usb, AlertTriangle, Activity,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const getFeatures = (cs: boolean) => [
  {
    title: cs ? 'Ed25519' : 'Ed25519',
    desc: cs ? 'Nejmodernější křivková kryptografie — rychlé a bezpečné podpisy.' : 'State-of-the-art curve cryptography — fast and secure signatures.',
    icon: Fingerprint,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'BIP39 Mnemonic' : 'BIP39 Mnemonic',
    desc: cs ? '12–24 slovní seed pro snadné zálohování a obnovení.' : '12–24 word seed for easy backup and recovery.',
    icon: KeyRound,
    color: 'text-zion-gold',
  },
  {
    title: cs ? 'UTXO Model' : 'UTXO Model',
    desc: cs ? 'Nativní UTXO model ZION L1 — transparentní a auditovatelný.' : 'Native ZION L1 UTXO model — transparent and auditable.',
    icon: Zap,
    color: 'text-emerald-400',
  },
  {
    title: cs ? 'On-Chain' : 'On-Chain',
    desc: cs ? 'Plně on-chain wallet — žádné custodial služby.' : 'Fully on-chain wallet — no custodial services.',
    icon: Globe2,
    color: 'text-purple-400',
  },
];

type Tab = 'create' | 'import' | 'send' | 'export';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof Plus }[] = [
  { key: 'create', labelCs: 'Vytvořit', labelEn: 'Create', icon: Plus },
  { key: 'import', labelCs: 'Import', labelEn: 'Import', icon: Import },
  { key: 'send', labelCs: 'Odeslat', labelEn: 'Send', icon: Send },
  { key: 'export', labelCs: 'Export', labelEn: 'Export', icon: Download },
];

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  rc = '251, 191, 36',
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  rc?: string;
}) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': rc } as CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function WalletPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const features = getFeatures(cs);

  const {
    initialized,
    wallets,
    activeWallet,
    balance,
    loading,
    error,
    createWallet,
    importFromMnemonic,
    importFromPrivateKey,
    importFromTrezor,
    importFromLedger,
    setActiveWallet,
    deleteWallet,
    refreshBalance,
    send,
    exportMnemonic,
    exportPrivateKey,
    isHardwareWallet,
  } = useZionWallet();

  const [tab, setTab] = useState<Tab>('create');
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [walletName, setWalletName] = useState('My Wallet');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [exportedSecret, setExportedSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [txResult, setTxResult] = useState('');

  if (!initialized) {
    return (
      <div className="zion-page text-white">
        <div className="zion-container max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-zinc-500 animate-pulse" />
              <p className="text-zinc-400">{cs ? 'Inicializace ZION Wallet...' : 'Initializing ZION Wallet...'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!password || password.length < 8) {
      alert(cs ? 'Heslo musí mít alespoň 8 znaků' : 'Password must be at least 8 characters');
      return;
    }
    try {
      await createWallet(walletName, password);
      setPassword('');
      alert(cs ? 'Peněženka vytvořena!' : 'Wallet created successfully!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleImportMnemonic = async () => {
    if (!mnemonic || !password) { alert(cs ? 'Vyžadováno mnemonic a heslo' : 'Mnemonic and password required'); return; }
    try {
      await importFromMnemonic(mnemonic, walletName, password);
      setMnemonic(''); setPassword('');
      alert(cs ? 'Peněženka importována!' : 'Wallet imported successfully!');
    } catch (e: any) { alert(e.message); }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey || !password) { alert(cs ? 'Vyžadován private key a heslo' : 'Private key and password required'); return; }
    try {
      await importFromPrivateKey(privateKey, walletName, password);
      setPrivateKey(''); setPassword('');
      alert(cs ? 'Peněženka importována!' : 'Wallet imported successfully!');
    } catch (e: any) { alert(e.message); }
  };

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || !password) {
      alert(cs ? 'Vyplňte všechna povinná pole' : 'Fill all required fields'); return;
    }
    try {
      const txid = await send(sendTo, parseFloat(sendAmount), password, sendMemo || undefined);
      setTxResult(`Transaction submitted! TXID: ${txid}`);
      setSendTo(''); setSendAmount(''); setSendMemo(''); setPassword('');
    } catch (e: any) { alert(e.message); }
  };

  const handleExportMnemonic = async () => {
    if (!activeWallet || !password) return;
    try {
      const m = await exportMnemonic(activeWallet.id, password);
      setExportedSecret(m);
      setShowSecret(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleExportPrivateKey = async () => {
    if (!activeWallet || !password) return;
    try {
      const pk = await exportPrivateKey(activeWallet.id, password);
      setExportedSecret(pk);
      setShowSecret(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleImportTrezor = async () => {
    try {
      await importFromTrezor(walletName);
      alert(cs ? 'Trezor peněženka připojena!' : 'Trezor wallet connected!');
    } catch (e: any) { alert(e.message); }
  };

  const handleImportLedger = async () => {
    try {
      await importFromLedger(walletName);
      alert(cs ? 'Ledger peněženka připojena!' : 'Ledger wallet connected!');
    } catch (e: any) { alert(e.message); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(cs ? 'Zkopírováno do schránky!' : 'Copied to clipboard!');
  };

  const activeName = activeWallet?.name ?? (cs ? 'Žádná peněženka' : 'No wallet');
  const activeAddress = activeWallet?.address ?? '—';
  const activeBalanceDisplay = balance !== null ? `${balance.toFixed(6)} ZION` : '—';
  const hardwareStatus = isHardwareWallet
    ? (cs ? 'Watch-only' : 'Watch-only')
    : (cs ? 'Software' : 'Software');

  const walletCount = wallets.length;
  const activeBalance = balance !== null ? `${balance.toFixed(6)} ZION` : '---';
  const ed25519Type = 'Ed25519';
  const securityLevel = isHardwareWallet
    ? (cs ? 'Hardware' : 'Hardware')
    : (cs ? 'Lokalní' : 'Local');

  return (
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-gold/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-purple/10 blur-3xl" />
      </div>

      <div className="zion-container relative z-10 max-w-7xl space-y-10">

        {/* ── HERO ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '147, 51, 234' } as CSSProperties}
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-amber-300 uppercase">
                  <Wallet className="h-4 w-4" />
                  ZION L1 Wallet
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                    {cs ? 'Nativní peněženka ZION blockchainu' : 'Native ZION blockchain wallet'}
                  </p>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                    {cs ? 'ZION Wallet' : 'ZION Wallet'}
                  </h1>
                </div>
                <p className="text-lg text-gray-300 max-w-2xl">
                  {cs
                    ? 'Plně on-chain peněženka pro ZION L1. Vytvořte, importujte, odešlete a zálohujte své ZION tokeny s Ed25519 kryptografií a UTXO modelem. Žádné custodial služby — plná kontrola nad klíči.'
                    : 'Fully on-chain wallet for ZION L1. Create, import, send, and back up your ZION tokens with Ed25519 cryptography and UTXO model. No custodial services — full key control.'}
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-cyan-200">
                    <Fingerprint className="h-3 w-3" /> Ed25519
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                    <KeyRound className="h-3 w-3" /> BIP39
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                    <Lock className="h-3 w-3" /> {cs ? 'Local-only' : 'Local-only'}
                  </span>
                </div>
              </div>

              {/* Quick info side card */}
              <div className="w-full lg:max-w-md space-y-3">
                <div
                  className="zion-rainbow-sub p-5"
                  style={{ '--rc': '251, 191, 36' } as CSSProperties}
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
                        {cs ? 'Peněženka' : 'Wallet'}
                      </div>
                      <span className="font-mono text-white text-sm">{activeName}</span>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '251, 191, 36' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Copy className="h-4 w-4 text-zion-gold" />
                        {cs ? 'Adresa' : 'Address'}
                      </div>
                      <span className="font-mono text-white text-xs break-all max-w-[180px]">{activeAddress}</span>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '251, 191, 36' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Activity className="h-4 w-4 text-zion-gold" />
                        {cs ? 'Zůstatek' : 'Balance'}
                      </div>
                      <span className="font-mono text-white">{activeBalanceDisplay}</span>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '251, 191, 36' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Usb className="h-4 w-4 text-zion-gold" />
                        {cs ? 'Hardware' : 'Hardware'}
                      </div>
                      <span className="font-mono text-white">{hardwareStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── QUICK STATS ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-emerald-400" />
                {cs ? 'Statistiky peněženky' : 'Wallet Statistics'}
              </h2>
              <p className="text-sm text-gray-400">
                {cs
                  ? 'Aktuální metriky z lokální ZION Wallet.'
                  : 'Current metrics from your local ZION Wallet.'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                label={cs ? 'Peněženky' : 'Wallets'}
                value={String(walletCount)}
                sub={cs ? 'celkem' : 'total'}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                label={cs ? 'Aktivní zůstatek' : 'Active Balance'}
                value={activeBalance}
                sub="ZION"
              />
              <StatCard
                icon={<Fingerprint className="h-5 w-5" />}
                colorClass="text-emerald-400"
                bgClass="bg-emerald-400/10"
                label={cs ? 'Kryptografie' : 'Cryptography'}
                value={ed25519Type}
                sub="Ed25519"
              />
              <StatCard
                icon={<Shield className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"
                label={cs ? 'Zabezpečení' : 'Security'}
                value={securityLevel}
                sub={cs ? 'úroveň' : 'level'}
              />
            </div>
          </motion.div>
        </section>

        {/* ── FEATURES ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="zion-rainbow-card p-6 md:p-8"
            style={{ '--rc': '147, 51, 234' } as CSSProperties}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vlastnosti' : 'Features'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Shield className="h-7 w-7 text-cyan-400" />
                {cs ? 'Proč ZION Wallet?' : 'Why ZION Wallet?'}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((f) => (
                <div key={f.title} className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                  <f.icon className={`h-8 w-8 ${f.color} mb-3`} />
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── WALLET UI ── */}
        <section className="relative z-10 max-w-4xl mx-auto">
          <div className="space-y-8">
            {error && (
              <div className="zion-rainbow-sub p-4 text-red-300" style={{ '--rc': '239, 68, 68' } as CSSProperties}>
                {error}
              </div>
            )}

            {/* Active wallet card */}
            {activeWallet && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="zion-rainbow-card p-6"
                style={{ '--rc': '147, 51, 234' } as CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">{cs ? 'Aktivní peněženka' : 'Active Wallet'}</p>
                    <p className="text-lg font-semibold text-white">{activeWallet.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={refreshBalance} className="p-2 hover:bg-white/10 rounded-2xl transition" disabled={loading}>
                      <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <code className="bg-black/60 px-3 py-1.5 rounded-xl text-sm font-mono text-zion-gold flex-1 truncate">
                    {activeWallet.address}
                  </code>
                  <button onClick={() => copyToClipboard(activeWallet.address)} className="p-2 hover:bg-white/10 rounded-2xl transition">
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-2xl font-bold text-zion-cyan mt-3">
                  {balance !== null ? `${balance.toFixed(6)} ZION` : '---'}
                </p>
                {isHardwareWallet && (
                  <div className="mt-4 zion-rainbow-sub p-4" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-200">
                        <p className="font-medium">{cs ? 'Hardware peněženka — pouze pro sledování' : 'Hardware Wallet — Watch Only'}</p>
                        <p className="text-amber-300/80 mt-1">
                          {cs
                            ? 'Trezor/Ledger firmware zatím nepodporuje podepisování transakcí pro ZION. Pro odeslání tokenů použijte software peněženku se stejným seedem (méně bezpečné) nebo počkejte na Ledger aplikaci.'
                            : 'Trezor/Ledger firmware does not yet support transaction signing for ZION. To send tokens, use a software wallet with the same seed (less secure) or wait for the Ledger app.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Wallet list */}
            {wallets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="zion-rainbow-card p-6"
                style={{ '--rc': '147, 51, 234' } as CSSProperties}
              >
                <h2 className="text-lg font-semibold text-white mb-4">{cs ? 'Vaše peněženky' : 'Your Wallets'} ({wallets.length})</h2>
                <div className="space-y-2">
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      className={`flex items-center justify-between cursor-pointer transition ${
                        activeWallet?.id === w.id
                          ? 'zion-rainbow-sub p-3'
                          : 'zion-panel-soft p-3 border border-white/5 hover:border-white/15'
                      }`}
                      style={activeWallet?.id === w.id ? ({ '--rc': '251, 191, 36' } as CSSProperties) : undefined}
                      onClick={() => setActiveWallet(w.id)}
                    >
                      <div>
                        <p className="font-medium text-white">{w.name}</p>
                        <p className="text-xs text-gray-500 font-mono truncate max-w-[300px]">{w.address}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteWallet(w.id); }}
                        className="p-2 hover:bg-red-500/10 rounded-2xl text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="zion-rainbow-card p-6"
              style={{ '--rc': '147, 51, 234' } as CSSProperties}
            >
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                  {cs ? 'Peněženkové operace' : 'Wallet operations'}
                </span>
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                        active
                          ? 'zion-rainbow-sub'
                          : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white'
                      }`}
                      style={active ? ({ '--rc': '251, 191, 36' } as CSSProperties) : undefined}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cs ? t.labelCs : t.labelEn}
                    </button>
                  );
                })}
              </div>

              {/* Create tab */}
              {tab === 'create' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-zion-gold" /> {cs ? 'Vytvořit novou peněženku' : 'Create New Wallet'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{cs ? 'Název peněženky' : 'Wallet Name'}</label>
                      <input
                        type="text"
                        value={walletName}
                        onChange={(e) => setWalletName(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{cs ? 'Heslo (min. 8 znaků)' : 'Password (min 8 chars)'}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleCreate}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-zion-gold to-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-zion-gold/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {loading ? (cs ? 'Vytváření...' : 'Creating...') : (cs ? 'Vytvořit peněženku' : 'Create Wallet')}
                    </button>
                  </div>
                </div>
              )}

              {/* Import tab */}
              {tab === 'import' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Import className="w-5 h-5 text-zion-gold" /> {cs ? 'Importovat peněženku' : 'Import Wallet'}
                  </h3>
                  <div className="space-y-6">
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                      <p className="text-sm font-medium text-gray-300 mb-3">{cs ? 'Z Mnemonic (BIP39)' : 'From Mnemonic (BIP39)'}</p>
                      <textarea
                        value={mnemonic}
                        onChange={(e) => setMnemonic(e.target.value)}
                        placeholder={cs ? 'Zadejte 12 nebo 24 slovní frázi...' : 'Enter 12 or 24 word mnemonic phrase...'}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none h-24"
                      />
                      <div className="mt-3 space-y-3">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={cs ? 'Šifrovací heslo' : 'Encryption password'}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                        <button
                          onClick={handleImportMnemonic}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                          {loading ? (cs ? 'Importování...' : 'Importing...') : (cs ? 'Importovat z Mnemonic' : 'Import from Mnemonic')}
                        </button>
                      </div>
                    </div>
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                      <p className="text-sm font-medium text-gray-300 mb-3">{cs ? 'Z Private Key (hex)' : 'From Private Key (hex)'}</p>
                      <input
                        type="text"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder={cs ? '64-znakový hex private key' : '64-char hex private key'}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                      />
                      <div className="mt-3 space-y-3">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={cs ? 'Šifrovací heslo' : 'Encryption password'}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                        <button
                          onClick={handleImportPrivateKey}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                          {loading ? (cs ? 'Importování...' : 'Importing...') : (cs ? 'Importovat z Private Key' : 'Import from Private Key')}
                        </button>
                      </div>
                    </div>
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                      <p className="text-sm font-medium text-gray-300 mb-3">{cs ? 'Hardware peněženka (Watch-only)' : 'Hardware Wallet (Watch-only)'}</p>
                      <p className="text-xs text-gray-400 mb-3">{cs ? 'Importujte veřejný klíč z Trezoru nebo Ledgeru.' : 'Import public key from Trezor or Ledger.'}</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleImportTrezor}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
                        >
                          {loading ? (cs ? 'Připojování...' : 'Connecting...') : 'Trezor'}
                        </button>
                        <button
                          onClick={handleImportLedger}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
                        >
                          {loading ? (cs ? 'Připojování...' : 'Connecting...') : 'Ledger'}
                        </button>
                      </div>
                      <p className="text-xs text-amber-300/70 mt-2">
                        {cs
                          ? 'Varování: Trezor/Ledger firmware zatím neumožňuje podepisování transakcí pro ZION. Peněženka bude pouze pro sledování.'
                          : 'Warning: Trezor/Ledger firmware does not yet support transaction signing for ZION. Wallet will be watch-only.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Send tab */}
              {tab === 'send' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-zion-gold" /> {cs ? 'Odeslat ZION' : 'Send ZION'}
                  </h3>
                  {!activeWallet ? (
                    <p className="text-gray-500">{cs ? 'Nejprve vyberte nebo vytvořte peněženku.' : 'Select or create a wallet first.'}</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{cs ? 'Adresa příjemce (zion1...)' : 'Recipient Address (zion1...)'}</label>
                        <input
                          type="text"
                          value={sendTo}
                          onChange={(e) => setSendTo(e.target.value)}
                          placeholder="zion1..."
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{cs ? 'Částka (ZION)' : 'Amount (ZION)'}</label>
                        <input
                          type="number"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          placeholder="0.00"
                          step="0.000001"
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{cs ? 'Memo (volitelné)' : 'Memo (optional)'}</label>
                        <input
                          type="text"
                          value={sendMemo}
                          onChange={(e) => setSendMemo(e.target.value)}
                          placeholder={cs ? 'Volitelná zpráva...' : 'Optional message...'}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{cs ? 'Heslo peněženky' : 'Wallet Password'}</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={cs ? 'Zadejte heslo peněženky' : 'Enter wallet password'}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {loading ? (cs ? 'Odesílání...' : 'Sending...') : (cs ? 'Odeslat ZION' : 'Send ZION')}
                      </button>
                      {txResult && (
                        <p className="text-zion-cyan text-sm mt-2 zion-rainbow-sub p-3 font-mono" style={{ '--rc': '251, 191, 36' } as CSSProperties}>{txResult}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Export tab */}
              {tab === 'export' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-zion-gold" /> {cs ? 'Exportovat tajemství' : 'Export Wallet Secrets'}
                  </h3>
                  {!activeWallet ? (
                    <p className="text-gray-500">{cs ? 'Nejprve vyberte peněženku.' : 'Select a wallet first.'}</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{cs ? 'Heslo peněženky' : 'Wallet Password'}</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={cs ? 'Zadejte heslo pro dešifrování' : 'Enter password to decrypt'}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleExportMnemonic}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                        >
                          <KeyRound className="h-4 w-4 text-zion-gold" /> {cs ? 'Exportovat Mnemonic' : 'Export Mnemonic'}
                        </button>
                        <button
                          onClick={handleExportPrivateKey}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                        >
                          <Fingerprint className="h-4 w-4 text-cyan-400" /> {cs ? 'Exportovat Private Key' : 'Export Private Key'}
                        </button>
                      </div>
                      {exportedSecret && (
                        <div className="mt-4 zion-rainbow-sub p-4" style={{ '--rc': '239, 68, 68' } as CSSProperties}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-red-300 text-sm font-medium">{cs ? 'Tajemství (nikdy nesdílejte!)' : 'Secret (never share!)'}</p>
                            <div className="flex gap-2">
                              <button onClick={() => setShowSecret(!showSecret)} className="p-1 hover:bg-red-900/30 rounded transition">
                                {showSecret ? <EyeOff className="w-4 h-4 text-red-300" /> : <Eye className="w-4 h-4 text-red-300" />}
                              </button>
                              <button onClick={() => copyToClipboard(exportedSecret)} className="p-1 hover:bg-red-900/30 rounded transition">
                                <Copy className="w-4 h-4 text-red-300" />
                              </button>
                            </div>
                          </div>
                          <code className="block font-mono text-sm break-all text-red-200">
                            {showSecret ? exportedSecret : '•'.repeat(Math.min(exportedSecret.length, 50))}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="zion-cta-banner"
          >
            <h2 className="text-2xl font-semibold text-white text-center mb-6">
              {cs ? 'Více o ZION Wallet' : 'Learn more about ZION Wallet'}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/explorer" className="zion-button-secondary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white">
                <Globe2 className="h-4 w-4" /> Explorer
              </Link>
              <Link href="/download" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                <Download className="h-4 w-4 text-zion-gold" /> {cs ? 'Stáhnout' : 'Download'}
              </Link>
              <Link href="/docs" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white" style={{ '--rc': '251, 191, 36' } as CSSProperties}>
                <BookOpen className="h-4 w-4 text-zion-gold" /> {cs ? 'Dokumentace' : 'Documentation'}
              </Link>
            </div>
          </motion.div>
        </section>

      </div>
    </div>
  );
}
