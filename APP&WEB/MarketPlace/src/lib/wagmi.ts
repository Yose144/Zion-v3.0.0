'use client';

import { createConfig, http, type CreateConnectorFn } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect project ID — get from https://cloud.walletconnect.com
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '';
const WC_PLACEHOLDERS = new Set(['', 'your-walletconnect-project-id', 'zion-marketplace']);

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'ZION MarketPlace' }),
  ...(WC_PROJECT_ID && !WC_PLACEHOLDERS.has(WC_PROJECT_ID)
    ? [walletConnect({ projectId: WC_PROJECT_ID })]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: connectors as unknown as CreateConnectorFn[],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
        'https://mainnet.base.org'
    ),
  },
});

export { base };
