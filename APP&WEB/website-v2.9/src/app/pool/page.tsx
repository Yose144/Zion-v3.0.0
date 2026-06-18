import PoolDashboard from '@/components/PoolDashboard';
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `ZION Mining Pool · TerraNova ${SITE_RELEASE_LABEL}`,
  description: 'Mine ZION with Cosmic Harmony PoW. PPLNS rewards, 89% miner share, 5% humanitarian tithe, 5% Issobella fund. Real-time pool stats, miner dashboard, and getting started guide.',
  openGraph: {
    title: 'ZION Mining Pool',
    description: 'Cosmic Harmony PoW · PPLNS · 89% Miner Reward · Humanitarian Mining',
    type: 'website',
  },
};

export default function PoolPage() {
  return <PoolDashboard />;
}
