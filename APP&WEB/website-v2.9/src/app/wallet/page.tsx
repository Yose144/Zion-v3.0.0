'use client';

import { useState } from 'react';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import { Wallet, Plus, Import, Send, RefreshCw, Trash2, Copy, Eye, EyeOff } from 'lucide-react';

export default function WalletPage() {
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
    setActiveWallet,
    deleteWallet,
    refreshBalance,
    send,
    exportMnemonic,
    exportPrivateKey,
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-zinc-500 animate-pulse" />
          <p className="text-zinc-400">Initializing ZION Wallet...</p>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!password || password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    try {
      await createWallet(walletName, password);
      setPassword('');
      alert('Wallet created successfully!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleImportMnemonic = async () => {
    if (!mnemonic || !password) { alert('Mnemonic and password required'); return; }
    try {
      await importFromMnemonic(mnemonic, walletName, password);
      setMnemonic(''); setPassword('');
      alert('Wallet imported successfully!');
    } catch (e: any) { alert(e.message); }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey || !password) { alert('Private key and password required'); return; }
    try {
      await importFromPrivateKey(privateKey, walletName, password);
      setPrivateKey(''); setPassword('');
      alert('Wallet imported successfully!');
    } catch (e: any) { alert(e.message); }
  };

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || !password) {
      alert('Fill all required fields'); return;
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="zion-container max-w-4xl pt-28 pb-24">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Wallet className="w-8 h-8 text-zion-gold" />
        ZION L1 Wallet
      </h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl mb-6">
          {error}
        </div>
      )}

      {/* Active wallet card */}
      {activeWallet && (
        <div className="zion-panel p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-zinc-400">Active Wallet</p>
              <p className="text-lg font-semibold">{activeWallet.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refreshBalance} className="p-2 hover:bg-white/10 rounded-2xl transition" disabled={loading}>
                <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <code className="bg-black/60 px-3 py-1.5 rounded-xl text-sm font-mono text-zion-gold flex-1 truncate">
              {activeWallet.address}
            </code>
            <button onClick={() => copyToClipboard(activeWallet.address)} className="p-2 hover:bg-white/10 rounded-2xl">
              <Copy className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-zion-cyan mt-3">
            {balance !== null ? `${balance.toFixed(6)} ZION` : '---'}
          </p>
        </div>
      )}

      {/* Wallet list */}
      {wallets.length > 0 && (
        <div className="zion-panel p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Wallets ({wallets.length})</h2>
          <div className="space-y-2">
            {wallets.map((w) => (
              <div
                key={w.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                  activeWallet?.id === w.id
                    ? 'bg-zion-gold/10 border-zion-gold/30'
                    : 'bg-black/40 border-white/5 hover:border-white/15'
                }`}
                onClick={() => setActiveWallet(w.id)}
              >
                <div>
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-zinc-500 font-mono truncate max-w-[300px]">{w.address}</p>
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
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-1">
        {(['create', 'import', 'send', 'export'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
              tab === t
                ? 'bg-white/10 text-zion-gold border-b-2 border-zion-gold'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Create tab */}
      {tab === 'create' && (
        <div className="zion-panel p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create New Wallet
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Wallet Name</label>
              <input
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Password (min 8 chars)</label>
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
              className="zion-button-primary transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Wallet'}
            </button>
          </div>
        </div>
      )}

      {/* Import tab */}
      {tab === 'import' && (
        <div className="zion-panel p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Import className="w-5 h-5" /> Import Wallet
          </h3>
          <div className="space-y-6">
            <div className="border border-zinc-800 rounded-lg p-4">
              <p className="text-sm font-medium text-zinc-300 mb-3">From Mnemonic (BIP39)</p>
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="Enter 12 or 24 word mnemonic phrase..."
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none h-24"
              />
              <div className="mt-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Encryption password"
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none mb-3"
                />
                <button
                  onClick={handleImportMnemonic}
                  disabled={loading}
                  className="zion-button-primary transition disabled:opacity-50"
                >
                  {loading ? 'Importing...' : 'Import from Mnemonic'}
                </button>
              </div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-4">
              <p className="text-sm font-medium text-zinc-300 mb-3">From Private Key (hex)</p>
              <input
                type="text"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="64-char hex private key"
                className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
              />
              <div className="mt-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Encryption password"
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none mb-3"
                />
                <button
                  onClick={handleImportPrivateKey}
                  disabled={loading}
                  className="zion-button-primary transition disabled:opacity-50"
                >
                  {loading ? 'Importing...' : 'Import from Private Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send tab */}
      {tab === 'send' && (
        <div className="zion-panel p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Send className="w-5 h-5" /> Send ZION
          </h3>
          {!activeWallet ? (
            <p className="text-zinc-500">Select or create a wallet first.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Recipient Address (zion1...)</label>
                <input
                  type="text"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="zion1..."
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Amount (ZION)</label>
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
                <label className="block text-sm text-zinc-400 mb-1">Memo (optional)</label>
                <input
                  type="text"
                  value={sendMemo}
                  onChange={(e) => setSendMemo(e.target.value)}
                  placeholder="Optional message..."
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Wallet Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter wallet password"
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none mb-3"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={loading}
                className="zion-button-primary transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send ZION'}
              </button>
              {txResult && (
                <p className="text-zion-cyan text-sm mt-2 bg-zion-cyan/10 p-3 rounded-2xl">{txResult}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export tab */}
      {tab === 'export' && (
        <div className="zion-panel p-6">
          <h3 className="text-lg font-semibold mb-4">Export Wallet Secrets</h3>
          {!activeWallet ? (
            <p className="text-zinc-500">Select a wallet first.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Wallet Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to decrypt"
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleExportMnemonic}
                  className="zion-button-secondary transition"
                >
                  Export Mnemonic
                </button>
                <button
                  onClick={handleExportPrivateKey}
                  className="zion-button-secondary transition"
                >
                  Export Private Key
                </button>
              </div>
              {exportedSecret && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-red-300 text-sm font-medium">Secret (never share!)</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowSecret(!showSecret)} className="p-1 hover:bg-red-900/30 rounded">
                        {showSecret ? <EyeOff className="w-4 h-4 text-red-300" /> : <Eye className="w-4 h-4 text-red-300" />}
                      </button>
                      <button onClick={() => copyToClipboard(exportedSecret)} className="p-1 hover:bg-red-900/30 rounded">
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
    </div>
  );
}
