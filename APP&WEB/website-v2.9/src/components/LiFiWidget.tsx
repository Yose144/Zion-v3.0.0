'use client';

import { useMemo } from 'react';
import { useWallet } from '@/contexts/WalletContext';

// wZION token address on Base
const WZION_BASE = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';

// LI.FI hosted widget URL
const LIFI_WIDGET_URL = 'https://widget.li.fi';

/**
 * LiFiWidget — Cross-chain swap + bridge widget powered by LI.FI
 *
 * Uses the hosted LI.FI widget in an iframe. The widget has its own
 * built-in wallet connection (MetaMask, WalletConnect, etc.) so no
 * postMessage bridge is needed — it works standalone.
 *
 * Aggregates 20+ bridges and 30+ DEXs across 25+ chains:
 * - Same-chain swaps on Base (Uniswap V3/V4, Aerodrome, PancakeSwap, SushiSwap)
 * - Cross-chain bridge (Ethereum, Arbitrum, BSC, Polygon, Optimism, etc.)
 * - Best price routing automatically
 * - wZION pre-configured as default from-token
 */
export default function LiFiWidget() {
  const { account } = useWallet();

  // Build URL with config params for initial load
  const widgetSrc = useMemo(() => {
    const params = new URLSearchParams({
      integrator: 'ZionProtocol',
      fromChain: '8453', // Base
      fromToken: WZION_BASE,
      toChain: '8453',
      toToken: '0x0000000000000000000000000000000000000000', // native ETH
      theme: 'dark',
      fee: '0',
      slippage: '100', // 1%
    });

    if (account) {
      params.set('fromAddress', account);
    }

    return `${LIFI_WIDGET_URL}?${params.toString()}`;
  }, [account]);

  return (
    <div className="zion-rainbow-card p-4" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-indigo-400">
          <path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h3 className="font-semibold text-white text-sm">
          Cross-Chain Swap & Bridge
        </h3>
        <span className="ml-auto text-[10px] text-white/40">Powered by LI.FI</span>
      </div>

      <div className="text-[11px] text-white/50 mb-3">
        Agreguje 20+ bridge protokolů a 30+ DEX napříč 25+ chainy. Nejlepší cena, automatický routing.
        wZION je přednastavený jako výchozí token na Base.
      </div>

      {/* LI.FI Widget iframe — has built-in wallet connection */}
      <iframe
        src={widgetSrc}
        title="LI.FI Cross-Chain Swap"
        width="100%"
        height="640"
        style={{
          border: 'none',
          borderRadius: '12px',
          background: 'transparent',
        }}
        allow="clipboard-read; clipboard-write; web3"
        loading="lazy"
      />

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/40">
        <span className="px-2 py-1 rounded-full bg-white/5">Uniswap V3/V4</span>
        <span className="px-2 py-1 rounded-full bg-white/5">Aerodrome</span>
        <span className="px-2 py-1 rounded-full bg-white/5">PancakeSwap</span>
        <span className="px-2 py-1 rounded-full bg-white/5">SushiSwap</span>
        <span className="px-2 py-1 rounded-full bg-white/5">Stargate</span>
        <span className="px-2 py-1 rounded-full bg-white/5">Across</span>
        <span className="px-2 py-1 rounded-full bg-white/5">+25 dalších</span>
      </div>
    </div>
  );
}
