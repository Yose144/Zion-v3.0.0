'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Zap,
  Lock,
  Flame,
  Activity,
  Copy,
  ChevronDown,
  Terminal,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Key,
  DollarSign,
  Info,
  HelpCircle,
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

export default function SwapPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  // State management
  const [escrowAddress, setEscrowAddress] = useState<string>('');
  const [escrowLoading, setEscrowAddressLoading] = useState(true);
  const [pendingHtlcs, setPendingHtlcs] = useState<HtlcRecord[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

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
    // Generate secure 32-byte (64-char hex) preimage
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const preimage = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    setGeneratedPreimage(preimage);

    // Dynamic SHA-256 hash computation
    const encoder = new TextEncoder();
    const data = encoder.encode(preimage);
    // Convert hex string preimage to byte array first to hash the actual bytes
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

  return (
    <div className="relative min-h-screen bg-[#070709] text-white pt-24 pb-20 px-4 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-12">
        {/* ── Header ── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            <Sparkles className="h-3 w-3 animate-pulse" />
            v3.0.4 · Atomic HTLC Swaps
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            ZION <span className="text-gradient">Atomic Swap</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
            {cs
              ? 'Plně decentralizované cross-chain swapy bez prostředníků. Trustless HTLC protokoly chráněné hashlocky a časovými zámky.'
              : 'Fully decentralized cross-chain swaps with no middlemen. Trustless HTLC protocols secured by hashlocks and timelocks.'}
          </p>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column: Initiate Swap */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="zion-rainbow-card p-6 md:p-8 space-y-6"
            style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{cs ? 'Iniciovat Swap' : 'Initiate Swap'}</h2>
                <p className="text-xs text-gray-500">ZION L1 → Target Chain (Base / EVM)</p>
              </div>
            </div>

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
                    {cs ? 'Časový zámek' : 'Timelock (Mins)'}
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

              {/* Preimage Generator */}
              <div className="zion-tile p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300">
                    {cs ? '1. Vygenerovat hash klíče' : '1. Generate Hash Keys'}
                  </span>
                  <button
                    onClick={handleGenerateKeys}
                    className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition"
                  >
                    {cs ? 'Generovat' : 'Generate'}
                  </button>
                </div>

                {generatedPreimage && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="zion-tile p-2 relative">
                      <div className="text-[9px] text-gray-500 uppercase">Preimage (SAVE THIS!)</div>
                      <div className="text-white break-all pr-8 mt-1">{generatedPreimage}</div>
                      <button
                        onClick={() => handleCopy(generatedPreimage, 'preimage')}
                        className="absolute right-2 top-2 p-1.5 hover:bg-white/10 rounded"
                      >
                        <Copy className={`h-3 w-3 ${copied === 'preimage' ? 'text-emerald-400' : 'text-gray-400'}`} />
                      </button>
                    </div>

                    <div className="zion-tile p-2 relative">
                      <div className="text-[9px] text-gray-500 uppercase">Hashlock (SHA-256)</div>
                      <div className="text-amber-400 break-all pr-8 mt-1">{generatedHash}</div>
                      <button
                        onClick={() => handleCopy(generatedHash!, 'hash')}
                        className="absolute right-2 top-2 p-1.5 hover:bg-white/10 rounded"
                      >
                        <Copy className={`h-3 w-3 ${copied === 'hash' ? 'text-emerald-400' : 'text-gray-400'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Memo Builder */}
              {generatedHash && initRecipient && (
                <div className="zion-rainbow-sub p-4 space-y-2 text-xs" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                    <Info className="h-4 w-4" />
                    {cs ? '2. Odeslat transakci na ZION L1' : '2. Send Transaction on ZION L1'}
                  </div>
                  <p className="text-gray-400">
                    {cs
                      ? 'Pošli nativní ZION na escrow adresu se zadaným memo. Daemon automaticky detekuje lock.'
                      : 'Send native ZION to the escrow address with this exact memo. Daemon will auto-detect the lock.'}
                  </p>
                  <div className="space-y-1.5 font-mono zion-tile p-3 relative">
                    <div><span className="text-gray-500">Escrow:</span> <span className="text-white break-all">{escrowLoading ? 'Loading…' : (escrowAddress || 'Unavailable')}</span></div>
                    <div><span className="text-gray-500">Amount:</span> <span className="text-white">{initAmt} ZION</span></div>
                    <div><span className="text-gray-500">Memo:</span> <span className="text-amber-400 break-all">{getSwapMemo()}</span></div>
                    <button
                      onClick={() => handleCopy(getSwapMemo(), 'memo')}
                      className="absolute right-2 top-2 p-1.5 hover:bg-white/10 rounded"
                    >
                      <Copy className={`h-3.5 w-3.5 ${copied === 'memo' ? 'text-emerald-400' : 'text-gray-400'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right column: Claim / Refund form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-8"
          >
            {/* Action panel (Claim & Refund) */}
            <div className="zion-rainbow-card p-6 md:p-8 space-y-6" style={{ '--rc': '168, 85, 247' } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{cs ? 'Spravovat HTLC zámek' : 'Manage HTLC lock'}</h2>
                  <p className="text-xs text-gray-500">{cs ? 'Uplatnit swap (Claim) nebo refundovat' : 'Claim swap (reveal preimage) or request refund'}</p>
                </div>
              </div>

              <form className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="flex gap-4">
                  <button
                    onClick={handleClaim}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {actionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {cs ? 'Uplatnit (Claim)' : 'Claim Swap'}
                  </button>
                  <button
                    onClick={handleRefund}
                    disabled={actionLoading}
                    className="py-3 px-6 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
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
                    className={`p-4 rounded-xl text-xs flex gap-2 border ${
                      actionMessage.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    {actionMessage.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
                    <span className="break-all">{actionMessage.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Query / Search lock panel */}
            <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Search className="h-4 w-4 text-amber-400" />
                {cs ? 'Vyhledat HTLC Lock' : 'Track HTLC Lock'}
              </h3>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchHash}
                  onChange={e => setSearchHash(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Enter 64-character hashlock"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition text-xs font-semibold"
                >
                  {searchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (cs ? 'Hledat' : 'Search')}
                </button>
              </form>

              {searchError && <div className="text-xs text-red-400 font-medium">{searchError}</div>}

              {searchResult && (
                <div className="zion-tile p-4 space-y-2 text-xs font-mono relative">
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
          </motion.div>
        </div>

        {/* ── Active pending locks table ── */}
        <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                {cs ? 'Aktivní HTLC Zámky' : 'Active HTLC Locks'}
              </h3>
              <p className="text-xs text-gray-500">
                {cs ? 'Čekající na uplatnění nebo vypršení časového zámku' : 'Pending claim or waiting for refund on expiry'}
              </p>
            </div>
            <button
              onClick={loadInitialData}
              disabled={pendingLoading}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
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
      </div>
    </div>
  );
}
