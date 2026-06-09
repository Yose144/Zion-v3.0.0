'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import {
  Wallet, Plus, Import, Send, RefreshCw, Trash2, Copy, Eye, EyeOff,
  Shield, KeyRound, Download, BookOpen, ArrowRight, Lock, Fingerprint,
  Zap, Globe2, Usb, AlertTriangle
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const getFeatures = (cs: boolean) => [
  {
    title: tr('walletPage', 'ed25519', lang),
    desc: tr('walletPage', 'state_of_the_art_curve_cryptography_fast_and_', lang),
    icon: Fingerprint,
    color: 'text-cyan-400',
  },
  {
    title: tr('walletPage', 'bip39_mnemonic', lang),
    desc: tr('walletPage', '12_24_word_seed_for_easy_backup_and_recovery', lang),
    icon: KeyRound,
    color: 'text-zion-gold',
  },
  {
    title: tr('walletPage', 'utxo_model', lang),
    desc: tr('walletPage', 'native_zion_l1_utxo_model_transparent_and_aud', lang),
    icon: Zap,
    color: 'text-emerald-400',
  },
  {
    title: tr('walletPage', 'on_chain', lang),
    desc: tr('walletPage', 'fully_on_chain_wallet_no_custodial_services', lang),
    icon: Globe2,
    color: 'text-purple-400',
  },
];

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

  const [tab, setTab] = useState<'create' | 'import' | 'send' | 'export'>('create');
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
      <div className="pt-28 pb-24 overflow-x-hidden">
        <div className="zion-container max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-zinc-500 animate-pulse" />
              <p className="text-zinc-400">{tr('walletPage', 'initializing_zion_wallet', lang)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!password || password.length < 8) {
      alert(tr('walletPage', 'password_must_be_at_least_8_characters', lang));
      return;
    }
    try {
      await createWallet(walletName, password);
      setPassword('');
      alert(tr('walletPage', 'wallet_created_successfully', lang));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleImportMnemonic = async () => {
    if (!mnemonic || !password) { alert(tr('walletPage', 'mnemonic_and_password_required', lang)); return; }
    try {
      await importFromMnemonic(mnemonic, walletName, password);
      setMnemonic(''); setPassword('');
      alert(tr('walletPage', 'wallet_imported_successfully', lang));
    } catch (e: any) { alert(e.message); }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey || !password) { alert(tr('walletPage', 'private_key_and_password_required', lang)); return; }
    try {
      await importFromPrivateKey(privateKey, walletName, password);
      setPrivateKey(''); setPassword('');
      alert(tr('walletPage', 'wallet_imported_successfully', lang));
    } catch (e: any) { alert(e.message); }
  };

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || !password) {
      alert(tr('walletPage', 'fill_all_required_fields', lang)); return;
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
      alert(tr('walletPage', 'trezor_wallet_connected', lang));
    } catch (e: any) { alert(e.message); }
  };

  const handleImportLedger = async () => {
    try {
      await importFromLedger(walletName);
      alert(tr('walletPage', 'ledger_wallet_connected', lang));
    } catch (e: any) { alert(e.message); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(tr('walletPage', 'copied_to_clipboard', lang));
  };

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-zion-gold/30 bg-gradient-to-br from-zion-gold/10 via-black/60 to-cyan-500/10 p-6 md:p-10 backdrop-blur-xl"
        >
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-amber-300 uppercase">
              <Wallet className="h-4 w-4" />
              ZION L1 Wallet
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {tr('walletPage', 'native_zion_blockchain_wallet', lang)}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {tr('walletPage', 'zion_wallet', lang)}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
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
                <Lock className="h-3 w-3" /> {tr('walletPage', 'local_only', lang)}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── FEATURES ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('walletPage', 'features', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-cyan-400" />
              {tr('walletPage', 'why_zion_wallet', lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <f.icon className={`h-8 w-8 ${f.color} mb-3`} />
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── WALLET UI ── */}
        <div className="max-w-4xl mx-auto space-y-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          {/* Active wallet card */}
          {activeWallet && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-br from-zion-gold/10 via-black/40 to-cyan-500/10 p-6 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">{tr('walletPage', 'active_wallet', lang)}</p>
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
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-200">
                    <p className="font-medium">{tr('walletPage', 'hardware_wallet_watch_only', lang)}</p>
                    <p className="text-amber-300/80 mt-1">
                      {cs
                        ? 'Trezor/Ledger firmware zatím nepodporuje podepisování transakcí pro ZION. Pro odeslání tokenů použijte software peněženku se stejným seedem (méně bezpečné) nebo počkejte na Ledger aplikaci.'
                        : 'Trezor/Ledger firmware does not yet support transaction signing for ZION. To send tokens, use a software wallet with the same seed (less secure) or wait for the Ledger app.'}
                    </p>
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
              className="rounded-[32px] border border-white/10 bg-black/40 p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-4">{tr('walletPage', 'your_wallets', lang)} ({wallets.length})</h2>
              <div className="space-y-2">
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                      activeWallet?.id === w.id
                        ? 'bg-zion-gold/10 border-zion-gold/30'
                        : 'bg-black/40 border-white/5 hover:border-white/15'
                    }`}
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
            className="rounded-[32px] border border-white/10 bg-black/40 p-6"
          >
            <div className="flex gap-2 mb-6 border-b border-white/10 pb-1 overflow-x-auto">
              {(['create', 'import', 'send', 'export'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap ${
                    tab === t
                      ? 'bg-white/10 text-zion-gold border-b-2 border-zion-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'create' && <Plus className="w-4 h-4 inline mr-1" />}
                  {t === 'import' && <Import className="w-4 h-4 inline mr-1" />}
                  {t === 'send' && <Send className="w-4 h-4 inline mr-1" />}
                  {t === 'export' && <Download className="w-4 h-4 inline mr-1" />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Create tab */}
            {tab === 'create' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-zion-gold" /> {tr('walletPage', 'create_new_wallet', lang)}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'wallet_name', lang)}</label>
                    <input
                      type="text"
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'password_min_8_chars', lang)}</label>
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
                    {loading ? (tr('walletPage', 'creating', lang)) : (tr('walletPage', 'create_wallet', lang))}
                  </button>
                </div>
              </div>
            )}

            {/* Import tab */}
            {tab === 'import' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Import className="w-5 h-5 text-zion-gold" /> {tr('walletPage', 'import_wallet', lang)}
                </h3>
                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm font-medium text-gray-300 mb-3">{tr('walletPage', 'from_mnemonic_bip39', lang)}</p>
                    <textarea
                      value={mnemonic}
                      onChange={(e) => setMnemonic(e.target.value)}
                      placeholder={tr('walletPage', 'enter_12_or_24_word_mnemonic_phrase', lang)}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none h-24"
                    />
                    <div className="mt-3 space-y-3">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={tr('walletPage', 'encryption_password', lang)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                      <button
                        onClick={handleImportMnemonic}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {loading ? (tr('walletPage', 'importing', lang)) : (tr('walletPage', 'import_from_mnemonic', lang))}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm font-medium text-gray-300 mb-3">{tr('walletPage', 'from_private_key_hex', lang)}</p>
                    <input
                      type="text"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder={tr('walletPage', '64_char_hex_private_key', lang)}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                    />
                    <div className="mt-3 space-y-3">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={tr('walletPage', 'encryption_password', lang)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                      <button
                        onClick={handleImportPrivateKey}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {loading ? (tr('walletPage', 'importing', lang)) : (tr('walletPage', 'import_from_private_key', lang))}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm font-medium text-gray-300 mb-3">{tr('walletPage', 'hardware_wallet_watch_only_1', lang)}</p>
                    <p className="text-xs text-gray-400 mb-3">{tr('walletPage', 'import_public_key_from_trezor_or_ledger', lang)}</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleImportTrezor}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
                      >
                        {loading ? (tr('walletPage', 'connecting', lang)) : 'Trezor'}
                      </button>
                      <button
                        onClick={handleImportLedger}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
                      >
                        {loading ? (tr('walletPage', 'connecting', lang)) : 'Ledger'}
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-zion-gold" /> {tr('walletPage', 'send_zion', lang)}
                </h3>
                {!activeWallet ? (
                  <p className="text-gray-500">{tr('walletPage', 'select_or_create_a_wallet_first', lang)}</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'recipient_address_zion1', lang)}</label>
                      <input
                        type="text"
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                        placeholder="zion1..."
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'amount_zion', lang)}</label>
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
                      <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'memo_optional', lang)}</label>
                      <input
                        type="text"
                        value={sendMemo}
                        onChange={(e) => setSendMemo(e.target.value)}
                        placeholder={tr('walletPage', 'optional_message', lang)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'wallet_password', lang)}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={tr('walletPage', 'enter_wallet_password', lang)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {loading ? (tr('walletPage', 'sending', lang)) : (tr('walletPage', 'send_zion', lang))}
                    </button>
                    {txResult && (
                      <p className="text-zion-cyan text-sm mt-2 bg-zion-cyan/10 p-3 rounded-2xl font-mono">{txResult}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Export tab */}
            {tab === 'export' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-zion-gold" /> {tr('walletPage', 'export_wallet_secrets', lang)}
                </h3>
                {!activeWallet ? (
                  <p className="text-gray-500">{tr('walletPage', 'select_a_wallet_first', lang)}</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{tr('walletPage', 'wallet_password', lang)}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={tr('walletPage', 'enter_password_to_decrypt', lang)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleExportMnemonic}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                      >
                        <KeyRound className="h-4 w-4 text-zion-gold" /> {tr('walletPage', 'export_mnemonic', lang)}
                      </button>
                      <button
                        onClick={handleExportPrivateKey}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                      >
                        <Fingerprint className="h-4 w-4 text-cyan-400" /> {tr('walletPage', 'export_private_key', lang)}
                      </button>
                    </div>
                    {exportedSecret && (
                      <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-red-300 text-sm font-medium">{tr('walletPage', 'secret_never_share', lang)}</p>
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

        {/* ── LINKS ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-gold/10 via-transparent to-cyan-500/10 p-10"
        >
          <h2 className="text-2xl font-semibold text-white text-center mb-6">
            {tr('walletPage', 'learn_more_about_zion_wallet', lang)}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/download" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Download className="h-4 w-4 text-zion-gold" /> {tr('walletPage', 'download', lang)}
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <BookOpen className="h-4 w-4 text-cyan-400" /> {tr('walletPage', 'documentation', lang)}
            </Link>
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-6 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 transition-colors">
              <Globe2 className="h-4 w-4" /> Explorer
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
