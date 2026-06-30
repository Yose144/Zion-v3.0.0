'use client';

import { useMemo } from 'react';
import { LiFiWidgetLight, type WidgetLightConfig } from '@lifi/widget-light';
import { useWallet } from '@/contexts/WalletContext';

// wZION token addresses per chain — populated as each chain is deployed
// Base ✅ deployed | Others = null (will be filled after deploy-chain.ts runs)
const WZION_ADDRESSES: Record<number, string | null> = {
  8453:  '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // ✅ Base Mainnet
  1:     null,  // Ethereum Mainnet (not deployed)
  42161: null,  // Arbitrum One (not deployed)
  56:    '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // ✅ BNB Smart Chain (deployed 2026-06-30)
  137:   '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // ✅ Polygon PoS (deployed 2026-06-30)
  10:    null,  // Optimism (not deployed)
  43114: null,  // Avalanche C-Chain (not deployed)
};

// wZION on Base (default — the only chain with deployed wZION so far)
const WZION_BASE = WZION_ADDRESSES[8453]!;

// Native ETH zero-address
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';

// Chains allowed in the widget (EVM only — Fáze 2 will add more after wZION deploy)
const ALLOWED_CHAINS = [8453, 1, 42161, 56, 137, 10, 43114];

// Custom RPC URLs per chain — avoids public RPC rate-limits
const RPC_URLS: Record<number, string[]> = {
  8453:  ['https://mainnet.base.org'],
  1:     ['https://eth.llamarpc.com'],
  42161: ['https://arb1.arbitrum.io/rpc'],
  56:    ['https://bsc-dataseed.binance.org'],
  137:   ['https://polygon-rpc.com'],
  10:    ['https://mainnet.optimism.io'],
  43114: ['https://api.avax.network/ext/bc/C/rpc'],
};

/**
 * LiFiWidget — Cross-chain swap + bridge widget powered by LI.FI
 *
 * Uses WidgetLight (postMessage bridge) from @lifi/widget-light for proper
 * config delivery — no URL params hacking. Aggregates 30+ DEX and 20+ bridge
 * protocols across 25+ chains.
 *
 * Config highlights:
 * - slippage: 0.01 (1% as decimal 0-1) — fixed from incorrect '100'
 * - routePriority: RECOMMENDED
 * - useRelayerRoutes: true (gasless transactions)
 * - feeConfig: 0.5% integrator fee (monetization)
 * - chains: 7 EVM chains (Base, Eth, Arb, BSC, Polygon, OP, Avax)
 * - sdkConfig.rpcUrls: custom RPC per chain
 * - appearance: dark + custom theme matching Zion design
 */
export default function LiFiWidget() {
  const { account } = useWallet();

  const config = useMemo<WidgetLightConfig>(() => {
    const cfg: WidgetLightConfig = {
      integrator: 'ZionProtocol',
      // ── Form defaults ──
      fromChain: 8453,   // Base
      fromToken: WZION_BASE,
      toChain: 8453,
      toToken: NATIVE_ETH,
      // ── Routing ──
      slippage: 0.01,           // 1% (decimal 0-1, NOT basis points)
      routePriority: 'RECOMMENDED',
      useRelayerRoutes: true,   // gasless/relayer routes
      // ── Chain filtering ──
      chains: {
        allow: ALLOWED_CHAINS,
      },
      // ── Fee monetization (0.5% integrator fee) ──
      feeConfig: {
        name: 'Zion Protocol',
        fee: 0.005,              // 0.5% (decimal 0-1)
        showFeePercentage: true,
        showFeeTooltip: true,
      },
      // ── Appearance ──
      appearance: 'dark',
      theme: {
        container: {
          borderRadius: '12px',
        },
      },
      // ── SDK config: custom RPCs ──
      sdkConfig: {
        rpcUrls: RPC_URLS,
      },
    };

    // Pre-fill destination address if wallet is connected
    if (account) {
      cfg.toAddress = {
        address: account,
        chainType: 'EVM' as any,
      };
    }

    return cfg;
  }, [account]);

  return (
    <div className="zion-rainbow-card p-4" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-indigo-400">
          <path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h3 className="font-semibold text-white text-sm">
          Cross-Chain Swap &amp; Bridge
        </h3>
        <span className="ml-auto text-[10px] text-white/40">Powered by LI.FI</span>
      </div>

      <div className="text-[11px] text-white/50 mb-3">
        Agreguje 20+ bridge protokolů a 30+ DEX napříč 25+ chainy. Nejlepší cena, automatický routing.
        wZION je přednastavený jako výchozí token na Base. Integrator fee 0.5%.
      </div>

      {/* LI.FI WidgetLight — postMessage bridge with proper config */}
      <LiFiWidgetLight
        config={config}
        iframeOrigin="https://widget.li.fi"
        autoResize
        title="LI.FI Cross-Chain Swap"
        style={{
          width: '100%',
          height: '640px',
          border: 'none',
          borderRadius: '12px',
          background: 'transparent',
        }}
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
