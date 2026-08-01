'use client';

import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { base } from 'wagmi/chains';
import { useState, useRef, useEffect } from 'react';

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  if (!isConnected || !address) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setWalletMenu(!walletMenu)}
          disabled={isPending}
          className="zion-button-primary text-sm"
        >
          {isPending ? 'Connecting…' : 'Connect Wallet'}
        </button>
        {walletMenu && (
          <div className="absolute right-0 mt-2 w-64 zion-section p-2 z-50">
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-white/5 mb-1">
              Choose wallet
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
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-oasis-cyan/30 to-oasis-purple/30 flex items-center justify-center text-xs font-bold">
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`zion-button-secondary flex items-center gap-2 ${wrongChain ? 'border-oasis-rose/50 text-oasis-rose' : ''}`}
      >
        <span className={`status-dot ${wrongChain ? 'status-inactive' : 'status-active'}`} />
        <span className="font-mono text-sm">{short}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 zion-section p-2 z-50">
          {wrongChain && (
            <div className="px-3 py-2 text-xs text-oasis-rose border-b border-white/5 mb-1">
              Wrong network — switch to Base
            </div>
          )}
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white"
          >
            View on Basescan ↗
          </a>
          <a
            href={`/profile/${address}`}
            className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white"
          >
            My Profile
          </a>
          <button
            onClick={() => { disconnect(); setOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-oasis-rose hover:bg-oasis-rose/10"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
