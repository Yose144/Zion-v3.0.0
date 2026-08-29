'use client';

/**
 * /login — Login page with Zion Wallet authentication.
 *
 * Shows the LoginModal centered on a nice background.
 * Redirects to /dashboard on success.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet, Shield, Lock, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import LoginModal from '@/components/LoginModal';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const { authenticated, loading, loginWithSiwe, loginWithGoogle } = useAuth();
  const zionWallet = useZionWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';
  const [showModal, setShowModal] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);
  const [siweError, setSiweError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  // Already authenticated — redirect
  useEffect(() => {
    if (!loading && authenticated) {
      router.push(redirect);
    }
  }, [loading, authenticated, redirect, router]);

  // Auto-open modal when wallet is ready
  useEffect(() => {
    if (zionWallet.initialized && zionWallet.wallets.length > 0 && !showModal && !authenticated) {
      setShowModal(true);
    }
  }, [zionWallet.initialized, zionWallet.wallets.length, showModal, authenticated]);

  useEffect(() => {
    setHasMetaMask(typeof window !== 'undefined' && !!(window as any).ethereum);
  }, []);

  const handleSiwe = async () => {
    setSiweLoading(true);
    setSiweError(null);
    try {
      await loginWithSiwe();
      router.push(redirect);
    } catch (err: any) {
      setSiweError(err.message || 'MetaMask login failed');
    } finally {
      setSiweLoading(false);
    }
  };

  const handleGoogle = async (idToken: string) => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      await loginWithGoogle(idToken);
      router.push(redirect);
    } catch (err: any) {
      setGoogleError(err.message || 'Google login failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 pt-32 pb-20">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-zion-cyan/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-zion-purple/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg z-10">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-zion-cyan/30 bg-gradient-to-br from-zion-cyan/20 to-zion-purple/20 mb-4">
            <Wallet className="h-8 w-8 text-zion-cyan" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to ZION</h1>
          <p className="text-sm text-gray-500">
            Sign in with your ZION Wallet to access your dashboard
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <Shield className="h-5 w-5 text-zion-cyan mx-auto mb-2" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Secure</p>
            <p className="text-[10px] text-gray-600 mt-1">Ed25519 signature</p>
          </div>
          <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <Lock className="h-5 w-5 text-zion-gold mx-auto mb-2" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Private</p>
            <p className="text-[10px] text-gray-600 mt-1">Keys never leave browser</p>
          </div>
          <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <Sparkles className="h-5 w-5 text-zion-purple mx-auto mb-2" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">No Email</p>
            <p className="text-[10px] text-gray-600 mt-1">Wallet = identity</p>
          </div>
        </div>

        {/* Login buttons */}
        <button
          onClick={handleSiwe}
          disabled={siweLoading || !hasMetaMask}
          className="zion-button-secondary w-full flex items-center justify-center gap-2 py-3.5 mb-3 disabled:opacity-50"
        >
          {siweLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Wallet className="h-5 w-5" />
          )}
          {siweLoading ? 'Signing...' : 'Sign in with MetaMask'}
          <ArrowRight className="h-4 w-4" />
        </button>
        {siweError && (
          <p className="text-xs text-red-400 text-center mb-3">{siweError}</p>
        )}

        {googleLoading && (
          <p className="text-xs text-gray-400 text-center mb-3">Signing in with Google...</p>
        )}

        <div className="mb-3 w-full">
          <GoogleSignInButton
            onSuccess={handleGoogle}
            onError={(err) => setGoogleError(err.message || 'Google sign-in failed')}
          />
        </div>

        {googleError && (
          <p className="text-xs text-red-400 text-center mb-3">{googleError}</p>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-rasta-black px-2 text-[10px] text-gray-500 uppercase">or</span>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className="zion-button-primary w-full flex items-center justify-center gap-2 py-3.5 disabled:opacity-50"
        >
          <Wallet className="h-5 w-5" />
          Sign in with ZION Wallet
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* No wallet? */}
        {zionWallet.initialized && zionWallet.wallets.length === 0 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 mb-3">Don&apos;t have a ZION wallet yet?</p>
            <a
              href="/wallet"
              className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-zion-cyan/80 transition-colors"
            >
              Create one now <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Info */}
        <p className="text-[10px] text-gray-600 text-center mt-6">
          By signing in, you prove ownership of your wallet by signing a cryptographic challenge.
          Your private key never leaves your browser.
        </p>
      </div>

      <LoginModal
        open={showModal}
        onClose={() => setShowModal(false)}
        redirectTo={redirect}
      />
    </div>
  );
}
