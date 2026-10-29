import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Miner account settings on ZION Pool: payout thresholds and per-wallet preferences.',
  alternates: { canonical: '/account' },
  openGraph: { url: 'https://pool.zionterranova.com/account' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
