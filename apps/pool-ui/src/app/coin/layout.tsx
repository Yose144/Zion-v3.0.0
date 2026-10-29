import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coin details',
  description: 'Per-coin mining details on ZION Pool: algorithm, hashrate, miners, rewards model and calculator.',
  alternates: { canonical: '/coin' },
  openGraph: { url: 'https://pool.zionterranova.com/coin' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
