'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, RotateCcw, Wallet, Eye, EyeOff, Copy, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import {
  isValidZionAddress,
  getAddressType,
  generateZionWallet,
  deriveWalletFromMnemonic,
  validatePilgrimOrZionAddress,
} from '../lib/zionWallet';

type Tab = 'pilgrim' | 'zion';

interface PlayerSettingsProps {
  onClose: () => void;
}

export default function PlayerSettings({ onClose }: PlayerSettingsProps) {
  const { address, setAddress, reset } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const [tab, setTab] = useState<Tab>('pilgrim');

  // Pilgrim / raw address
  const [input, setInput] = useState(address ?? '');

  // ZION wallet
  const [zionInput, setZionInput] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [generated, setGenerated] = useState<{ address: string; mnemonic: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSavePilgrim = () => {
    const trimmed = input.trim();
    if (trimmed && !validatePilgrimOrZionAddress(trimmed)) {
      addToast('Invalid address format', 'error', 2500);
      return;
    }
    setAddress(trimmed || null);
    addToast(`Pilgrim address set: ${trimmed || 'default'}`, 'success', 2500);
    onClose();
  };

  const handleSaveZionAddress = () => {
    const trimmed = zionInput.trim();
    if (!isValidZionAddress(trimmed)) {
      addToast('Invalid zion1 address', 'error', 2500);
      return;
    }
    setAddress(trimmed);
    addToast(`ZION wallet linked: ${trimmed.slice(0, 12)}...`, 'success', 2500);
    onClose();
  };

  const handleImportMnemonic = () => {
    try {
      const wallet = deriveWalletFromMnemonic(mnemonic.trim());
      setAddress(wallet.address);
      addToast(`ZION wallet imported: ${wallet.address.slice(0, 12)}...`, 'success', 2500);
      setMnemonic('');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Invalid mnemonic', 'error', 3000);
    }
  };

  const handleGenerate = () => {
    setLoading(true);
    try {
      const wallet = generateZionWallet();
      setGenerated({ address: wallet.address, mnemonic: wallet.mnemonic });
      setAddress(wallet.address);
    } catch (err) {
      addToast('Wallet generation failed', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all local progress? This cannot be undone.')) {
      reset();
      addToast('Local progress reset', 'info', 2500);
      onClose();
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied to clipboard`, 'info', 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#05060f]/95 p-5 shadow-2xl backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-oasis-cyan" />
            <h2 className="text-lg font-bold text-white">Pilgrim Identity</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2 rounded-xl border border-white/10 bg-black/30 p-1">
          <button
            onClick={() => setTab('pilgrim')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === 'pilgrim' ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'text-gray-400 hover:text-white'
            }`}
          >
            Pilgrim
          </button>
          <button
            onClick={() => setTab('zion')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === 'zion' ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'text-gray-400 hover:text-white'
            }`}
          >
            ZION Wallet
          </button>
        </div>

        {tab === 'pilgrim' && (
          <>
            <p className="mb-3 text-sm text-gray-400">
              Enter your pilgrim ID or a ZION address to load profile data.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="pilgrim-0001 or zion1..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-oasis-cyan focus:ring-1 focus:ring-oasis-cyan"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              Current type: <span className="text-oasis-cyan">{getAddressType(input) || 'empty'}</span>
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleSavePilgrim}
                className="flex-1 rounded-xl bg-oasis-cyan/20 py-2.5 text-sm font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30"
              >
                Save Address
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </>
        )}

        {tab === 'zion' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-gray-400">Paste an existing zion1 address (read-only login):</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={zionInput}
                  onChange={(e) => setZionInput(e.target.value)}
                  placeholder="zion1..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-oasis-cyan focus:ring-1 focus:ring-oasis-cyan"
                />
                <button
                  onClick={handleSaveZionAddress}
                  disabled={!isValidZionAddress(zionInput)}
                  className="rounded-xl bg-oasis-cyan/20 px-4 py-2.5 text-sm font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30 disabled:opacity-40"
                >
                  Link
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-sm text-gray-400">Import from 12-word mnemonic:</p>
              <div className="flex gap-2">
                <input
                  type={showSeed ? 'text' : 'password'}
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  placeholder="abandon ability able ..."
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-oasis-cyan focus:ring-1 focus:ring-oasis-cyan"
                />
                <button
                  onClick={() => setShowSeed((s) => !s)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 text-gray-400 transition hover:bg-white/10"
                >
                  {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={handleImportMnemonic}
                className="mt-2 w-full rounded-xl bg-oasis-gold/20 py-2 text-sm font-bold text-oasis-gold transition hover:bg-oasis-gold/30"
              >
                Import Mnemonic
              </button>
              <p className="mt-1 text-[10px] text-gray-500">Seed is used locally to derive address. It is not sent or stored.</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-sm text-gray-400">No wallet? Generate a new ZION address:</p>
              {generated ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
                    <Wallet className="h-4 w-4 text-oasis-cyan" />
                    <code className="flex-1 text-xs text-white">{generated.address}</code>
                    <button onClick={() => copy(generated.address, 'Address')} className="text-gray-400 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
                    <code className="flex-1 text-[10px] text-oasis-gold">{generated.mnemonic}</code>
                    <button onClick={() => copy(generated.mnemonic, 'Mnemonic')} className="text-gray-400 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-red-300">Save this seed phrase. It is shown only once.</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-oasis-purple/20 py-2 text-sm font-bold text-oasis-purple transition hover:bg-oasis-purple/30"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? 'Generating...' : 'Generate Wallet'}
                </button>
              )}
            </div>
          </div>
        )}

        <p className="mt-4 text-[10px] text-gray-500">
          Default <code>pilgrim-0001</code> is used if no address is set. Local progress stays in this browser unless reset.
        </p>
      </div>
    </motion.div>
  );
}
