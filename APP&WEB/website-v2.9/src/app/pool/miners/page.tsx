import PoolMinersClient from '@/components/pool/PoolMinersClient';
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Miner Leaderboard · ZION Mining Pool · ${SITE_RELEASE_LABEL}`,
  description: 'Top ZION miners by hashrate, shares, and rewards. Live leaderboard with miner search.',
};

export default function PoolMinersPage() {
  return <PoolMinersClient />;
}
