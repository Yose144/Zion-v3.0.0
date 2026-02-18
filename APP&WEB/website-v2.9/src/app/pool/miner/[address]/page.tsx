import type { Metadata } from 'next';
import MinerDashboard from '@/components/MinerDashboard';

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  const short = address.length > 20 ? `${address.slice(0, 12)}…${address.slice(-6)}` : address;
  return {
    title: `Miner ${short}`,
    description: `ZION Mining Pool — detailed statistics for miner ${short}. Hashrate, shares, blocks, payouts & live metrics.`,
    openGraph: {
      title: `Miner ${short} | ZION Pool`,
      description: `Live mining stats for ${short} — hashrate, shares, efficiency, blocks found, and payout history.`,
    },
  };
}

export default async function MinerPage({ params }: PageProps) {
  const { address } = await params;
  return <MinerDashboard address={address} />;
}
