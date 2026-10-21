'use client';

import { createConfig, http, type CreateConnectorFn } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect project ID — get from https://cloud.walletconnect.com
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '';
const WC_PLACEHOLDERS = new Set(['', 'your-walletconnect-project-id', 'zion-marketplace']);

// Chain selection: NEXT_PUBLIC_CHAIN_ID=84532 → Base Sepolia (dev), else Base Mainnet
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '8453');
export const activeChain = CHAIN_ID === 84532 ? baseSepolia : base;
const RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ??
  (activeChain.id === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'ZION MarketPlace' }),
  ...(WC_PROJECT_ID && !WC_PLACEHOLDERS.has(WC_PROJECT_ID)
    ? [walletConnect({ projectId: WC_PROJECT_ID })]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: connectors as unknown as CreateConnectorFn[],
  transports: {
    // Keys for every chain in the union — only activeChain is in `chains`,
    // so the other entry is inert. One RPC_URL env drives the selected chain.
    [base.id]: http(RPC_URL),
    [baseSepolia.id]: http(RPC_URL),
  },
});

export { base, baseSepolia };
