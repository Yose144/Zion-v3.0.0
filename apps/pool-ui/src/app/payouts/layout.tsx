import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payouts — transparent PPLNS',
  description: 'Live payout feed, PPLNS window fill, miner distribution, top-share concentration and fee split — full transparency on how rewards are computed.',
  alternates: { canonical: '/payouts' },
  openGraph: { url: 'https://pool.zionterranova.com/payouts' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
