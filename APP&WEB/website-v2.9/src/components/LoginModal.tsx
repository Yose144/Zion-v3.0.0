'use client';

/**
 * LoginModal — Zion Wallet authentication modal.
 *
 * Flow:
 *   1. User must have a wallet (via ZionWalletContext)
 *   2. User enters wallet password to unlock private key
 *   3. Client signs a nonce challenge and submits to /api/auth/wallet
 *   4. Server verifies signature and issues JWT cookie
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Wallet, Loader2, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useZionWallet } from '@/contexts/ZionWalletContext';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  redirectTo?: string;
}

export default function LoginModal({ open, onClose, redirectTo }: LoginModalProps) {
  const { loginWithWallet, loginWithSiwe } = useAuth();
  const zionWallet = useZionWallet();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [showWalletList, setShowWalletList] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasMetaMask(typeof window !== 'undefined' && !!(window as any).ethereum);
  }, []);

  const handleSiwe = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithSiwe();
      setPassword('');
      onClose();
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    } catch (err: any) {
      setError(err.message || 'MetaMask login failed');
    } finally {
      setLoading(false);
    }
  };

  const activeWallet = zionWallet.wallets.find((w) => w.id === selectedWalletId) || zionWallet.activeWallet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !password) return;

    setLoading(true);
    setError(null);
    try {
      await loginWithWallet(
        activeWallet.address,
        password,
        zionWallet.exportPrivateKey,
        activeWallet.id,
      );
      // Success — close modal
      setPassword('');
      onClose();
      if (redirectTo) {
        window.location.href = redirectTo;
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zion-cyan/30 bg-gradient-to-br from-zion-dark to-black shadow-[0_20px_80px_rgba(6,105,40,0.15)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zion-cyan/20 border border-zion-cyan/30">
                  <Wallet className="h-5 w-5 text-zion-cyan" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Sign in to ZION</h2>
                  <p className="text-xs text-zion-gold/70">Prove ownership to access dashboard</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-zion-gold/70 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {/* MetaMask / EVM sign-in */}
              <div className="mb-5">
                <button
                  type="button"
                  onClick={handleSiwe}
                  disabled={loading || !hasMetaMask}
                  className="zion-button-secondary w-full text-sm disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  {loading ? 'Signing...' : 'Sign in with MetaMask'}
                </button>
                {!hasMetaMask && (
                  <p className="text-[10px] text-zion-gold/55 text-center mt-2">
                    MetaMask not detected. Install it or use a ZION wallet below.
                  </p>
                )}
              </div>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-zion-gold/55">
                  <span className="bg-black px-2">or</span>
                </div>
              </div>

              {/* No wallet */}
              {zionWallet.initialized && zionWallet.wallets.length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-zion-gold/60 mx-auto mb-3" />
                  <p className="text-sm text-zion-gold/85 mb-4">
                    No ZION wallet found. You need a wallet to sign in.
                  </p>
                  <a
                    href="/wallet"
                    className="inline-flex items-center gap-2 rounded-lg border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-sm font-medium text-zion-cyan transition-all hover:bg-zion-cyan/20"
                  >
                    Go to Wallet <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              )}

              {/* Hardware wallet selected */}
              {activeWallet && zionWallet.isHardwareWallet && (
                <div className="rounded-lg border border-zion-gold/20 bg-zion-gold/5 px-4 py-3 mb-4">
                  <p className="text-xs text-zion-gold">
                    Hardware wallets (Trezor/Ledger) are watch-only and cannot sign authentication messages.
                    Please use a software wallet to sign in.
                  </p>
                </div>
              )}

              {/* Wallet selector */}
              {zionWallet.initialized && zionWallet.wallets.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs text-zion-gold/70 mb-1.5 block uppercase tracking-wider">Wallet</label>
                  <button
                    type="button"
                    onClick={() => setShowWalletList(!showWalletList)}
                    disabled={loading}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:border-white/20 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wallet className="h-4 w-4 text-zion-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{activeWallet?.name ?? 'Select wallet'}</p>
                        <p className="text-[10px] text-zion-gold/70 truncate font-mono">
                          {activeWallet?.address ?? '—'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-zion-gold/85 shrink-0 transition-transform ${showWalletList ? 'rotate-180' : ''}`} />
                  </button>
                  {showWalletList && (
                    <div className="mt-1 rounded-lg border border-white/10 bg-black/60 overflow-hidden">
                      {zionWallet.wallets.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            setSelectedWalletId(w.id);
                            setShowWalletList(false);
                            setError(null);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                            activeWallet?.id === w.id ? 'bg-zion-cyan/5' : ''
                          }`}
                        >
                          <Wallet className="h-3.5 w-3.5 text-zion-gold shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-white truncate">{w.name}</p>
                            <p className="text-[9px] text-zion-gold/70 truncate font-mono">{w.address}</p>
                          </div>
                          {w.keyType === 'trezor' || w.keyType === 'ledger' ? (
                            <span className="text-[8px] text-zion-gold/60 uppercase">HW</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Password input */}
              {activeWallet && !zionWallet.isHardwareWallet && (
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="text-xs text-zion-gold/70 mb-1.5 block uppercase tracking-wider">
                      Wallet Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zion-gold/70" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        autoFocus
                        placeholder="Enter your wallet password"
                        className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zion-gold/55 focus:border-zion-cyan/40 focus:outline-none focus:ring-1 focus:ring-zion-cyan/20 disabled:opacity-50"
                      />
                    </div>
                    <p className="text-[10px] text-zion-gold/55 mt-1.5">
                      Your password decrypts your private key locally to sign the auth challenge.
                      It is never sent to the server.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-zion-purple/20 bg-zion-purple/5 px-3 py-2 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-zion-purple shrink-0 mt-0.5" />
                      <p className="text-xs text-zion-purple">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="zion-button-primary w-full text-sm"
                    style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Sign & Login
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Loading state while wallet initializes */}
              {!zionWallet.initialized && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-zion-cyan" />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 px-6 py-3 bg-black/30">
              <p className="text-[10px] text-zion-gold/55 text-center">
                Secured by Ed25519 or EIP-191 signature · No private keys leave your browser
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
