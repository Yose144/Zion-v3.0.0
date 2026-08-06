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
  const { address, setAddress, reset, syncPlayer } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const [tab, setTab] = useState<Tab>('pilgrim');

  const [input, setInput] = useState(address ?? '');
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
    syncPlayer();
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
    syncPlayer();
    onClose();
  };

  const handleImportMnemonic = () => {
    try {
      const wallet = deriveWalletFromMnemonic(mnemonic.trim());
      setAddress(wallet.address);
      addToast(`ZION wallet imported: ${wallet.address.slice(0, 12)}...`, 'success', 2500);
      setMnemonic('');
      syncPlayer();
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
      syncPlayer();
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
      <div className="relative w-full max-w-md overflow-hidden p-5 zion-rainbow-card" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-oasis-purple/10 p-1.5 text-oasis-purple">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pilgrim Identity</h2>
              <p className="text-[10px] text-white/70">Link wallet or set pilgrim ID</p>
            </div>
          </div>
          <button onClick={onClose} className="zion-button-ghost !p-1.5 text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2 rounded-xl border border-white/10 bg-black/30 p-1">
          <button
            onClick={() => setTab('pilgrim')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === 'pilgrim' ? 'bg-oasis-purple/20 text-oasis-purple' : 'text-white/70 hover:text-white'
            }`}
          >
            Pilgrim
          </button>
          <button
            onClick={() => setTab('zion')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === 'zion' ? 'bg-oasis-purple/20 text-oasis-purple' : 'text-white/70 hover:text-white'
            }`}
          >
            ZION Wallet
          </button>
        </div>

        {tab === 'pilgrim' && (
          <>
            <p className="mb-3 text-sm text-white/70">
              Enter your pilgrim ID or a ZION address to load profile data.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="pilgrim-0001 or zion1..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:border-oasis-purple focus:ring-1 focus:ring-oasis-purple"
            />
            <p className="mt-1 text-[10px] text-white/60">
              Current type: <span className="text-oasis-purple">{getAddressType(input) || 'empty'}</span>
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleSavePilgrim}
                className="zion-button-primary flex-1 text-sm"
              >
                Save Address
              </button>
              <button
                onClick={handleReset}
                className="zion-button-ghost border-rasta-red/30 bg-rasta-red/10 text-rasta-red hover:bg-rasta-red/20"
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
              <p className="mb-2 text-sm text-white/70">Paste an existing zion1 address (read-only login):</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={zionInput}
                  onChange={(e) => setZionInput(e.target.value)}
                  placeholder="zion1..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:border-oasis-purple focus:ring-1 focus:ring-oasis-purple"
                />
                <button
                  onClick={handleSaveZionAddress}
                  disabled={!isValidZionAddress(zionInput)}
                  className="zion-button-primary px-4 text-sm disabled:opacity-40"
                >
                  Link
                </button>
              </div>
            </div>

            <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="mb-2 text-sm text-white/70">Import from 12-word mnemonic:</p>
              <div className="flex gap-2">
                <input
                  type={showSeed ? 'text' : 'password'}
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  placeholder="abandon ability able ..."
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:border-oasis-gold focus:ring-1 focus:ring-oasis-gold"
                />
                <button
                  onClick={() => setShowSeed((s) => !s)}
                  className="zion-button-ghost !p-2"
                >
                  {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={handleImportMnemonic}
                className="zion-button-ghost mt-2 w-full border-oasis-gold/30 bg-oasis-gold/10 text-oasis-gold hover:bg-oasis-gold/20"
              >
                Import Mnemonic
              </button>
              <p className="mt-1 text-[10px] text-white/60">Seed is used locally to derive address. It is not sent or stored.</p>
            </div>

            <div className="zion-rainbow-sub p-3" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <p className="mb-2 text-sm text-white/70">No wallet? Generate a new ZION address:</p>
              {generated ? (
                <div className="space-y-2">
                  <div className="zion-rainbow-sub flex items-center gap-2 p-2" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                    <Wallet className="h-4 w-4 text-oasis-cyan" />
                    <code className="flex-1 text-xs text-white">{generated.address}</code>
                    <button onClick={() => copy(generated.address, 'Address')} className="text-white/70 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="zion-rainbow-sub flex items-center gap-2 p-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <code className="flex-1 text-[10px] text-oasis-gold">{generated.mnemonic}</code>
                    <button onClick={() => copy(generated.mnemonic, 'Mnemonic')} className="text-white/70 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-rasta-red/80">Save this seed phrase. It is shown only once.</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="zion-button-primary w-full text-sm disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? 'Generating...' : 'Generate Wallet'}
                </button>
              )}
            </div>
          </div>
        )}

        <p className="mt-4 text-[10px] text-white/60">
          Default <code>pilgrim-0001</code> is used if no address is set. Local progress stays in this browser unless reset.
        </p>
      </div>
    </motion.div>
  );
}
