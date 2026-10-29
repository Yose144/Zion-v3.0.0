import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pool statistics',
  description: 'Live hashrate, miners online, share counters, per-coin streams and network data for ZION Pool.',
  alternates: { canonical: '/stats' },
  openGraph: { url: 'https://pool.zionterranova.com/stats' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
