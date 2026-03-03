import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WARP Corridors · ZION v2.9.7',
  description: 'Cross-chain WARP bridge corridors connecting ZION with Bitcoin, Ethereum, and Solana ecosystems.',
};

export default function WarpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
