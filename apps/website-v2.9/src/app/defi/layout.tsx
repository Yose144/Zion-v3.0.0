import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `DeFi Hub · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION DeFi — swap, bridge, and manage wZION on Base. Real contracts, real liquidity.',
};

export default function DefiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
