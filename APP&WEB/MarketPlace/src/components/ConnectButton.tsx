'use client';

import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';
import { useState, useRef, useEffect } from 'react';
import { useLangT } from '@/lib/useTranslation';
import { useAuth } from '@/contexts/AuthContext';

export default function ConnectButton({ variant = 'zion' }: { variant?: 'zion' | 'rasta' } = {}) {
  const { t } = useLangT();
  const isRasta = variant === 'rasta';
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user, authenticated, loginWithSiwe, logout: zisLogout } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setWalletMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await loginWithSiwe();
    } catch (e) {
      console.error('ZIS SIWE login failed:', e);
    } finally {
      setSigningIn(false);
    }
  };

  if (!isConnected || !address) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setWalletMenu(!walletMenu)}
          disabled={isPending}
          className={isRasta ? 'rasta-wallet-btn' : 'zion-button-primary text-sm'}
        >
          {isPending ? t('nav.connecting') : t('nav.connectWallet')}
        </button>
        {walletMenu && (
          <div className="absolute right-0 mt-2 w-64 zion-section p-2 z-50">
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-white/5 mb-1">
              {t('nav.chooseWallet')}
            </div>
            {connectors.map((c) => (
              <button
                key={c.uid}
                onClick={async () => {
                  try {
                    await connectAsync({ connector: c });
                    setWalletMenu(false);
                  } catch (e) {
                    console.error('Connect failed:', e);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all"
              >
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-rasta-green/30 to-rasta-red/30 flex items-center justify-center text-xs font-bold">
                  {c.name.slice(0, 1)}
                </span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const wrongChain = chainId !== base.id;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const displayName = user?.displayName || short;

  // Wallet connected but not yet ZIS-authenticated — show Sign In button
  if (!authenticated) {
    return (
      <div ref={ref} className="relative flex items-center gap-2">
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className={isRasta ? 'rasta-wallet-btn' : 'zion-button-primary text-sm'}
        >
          {signingIn ? 'Signing…' : 'Sign In'}
        </button>
        <button
          onClick={() => setWalletMenu(!walletMenu)}
          className={isRasta ? 'rasta-wallet-ghost' : 'zion-button-secondary text-sm'}
          aria-label="Wallet menu"
        >
          <span className="font-mono text-xs">{short}</span>
        </button>
        {walletMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 zion-section p-2 z-50">
            <button
              onClick={() => { disconnect(); setWalletMenu(false); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-rasta-red hover:bg-rasta-red/10"
            >
              {t('nav.disconnect')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Fully authenticated — show user menu
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={isRasta ? 'rasta-wallet-ghost' : `zion-button-secondary flex items-center gap-2 ${wrongChain ? 'border-rasta-red/50 text-rasta-red' : ''}`}
        data-wrong={wrongChain}
      >
        <span className={`status-dot ${wrongChain ? 'status-inactive' : 'status-active'}`} />
        <span className="text-sm max-w-[120px] truncate">{displayName}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 zion-section p-2 z-50">
          {wrongChain && (
            <div className="px-3 py-2 text-xs text-rasta-red border-b border-white/5 mb-1">
              {t('nav.wrongNetwork')}
            </div>
          )}
          {user && (
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-white/5 mb-1">
              {user.email ? `${user.displayName} · ${user.email}` : user.displayName}
            </div>
          )}
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white"
          >
            {t('nav.viewOnBasescan')}
          </a>
          <a
            href={`/profile/${address}`}
            className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white"
          >
            {t('nav.myProfile')}
          </a>
          <button
            onClick={() => { zisLogout(); setOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-rasta-red hover:bg-rasta-red/10"
          >
            {t('nav.disconnect')}
          </button>
        </div>
      )}
    </div>
  );
}
