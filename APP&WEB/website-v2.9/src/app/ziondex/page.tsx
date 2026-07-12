import ZionDexDashboard from '@/components/dex/ZionDexDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZionDex Hub — Cross-Chain DEX | ZION TerraNova',
  description: 'Universal cross-chain DEX powered by L3 WARP bridge. Swap, provide liquidity, track portfolio, bridge assets, and explore DeFi — all from one hub.',
};

export default function ZionDexPage() {
  return <ZionDexDashboard />;
}
