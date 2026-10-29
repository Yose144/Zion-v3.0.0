import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Miner dashboard',
  description: 'Per-wallet hashrate, workers, share history, unpaid balance, estimated earnings and payout ETA for any ZION Pool miner.',
  alternates: { canonical: '/miner' },
  openGraph: { url: 'https://pool.zionterranova.com/miner' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
