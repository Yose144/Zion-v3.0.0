import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `WARP Corridors · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Cross-chain WARP bridge corridors connecting ZION with Bitcoin, Ethereum, and Solana ecosystems.',
};

export default function WarpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
