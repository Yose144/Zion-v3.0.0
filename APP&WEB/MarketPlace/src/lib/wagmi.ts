'use client';

import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect project ID — get from https://cloud.walletconnect.com
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'zion-marketplace';

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    walletConnect({ projectId: WC_PROJECT_ID }),
    coinbaseWallet({ appName: 'ZION MarketPlace' }),
  ],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
        'https://mainnet.base.org'
    ),
  },
});

export { base };
