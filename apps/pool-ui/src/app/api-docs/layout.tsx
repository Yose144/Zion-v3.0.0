import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API documentation',
  description: 'Public REST API of ZION Pool: miner stats, coin stats, PPLNS transparency, earnings estimates, history and blocks endpoints.',
  alternates: { canonical: '/api-docs' },
  openGraph: { url: 'https://pool.zionterranova.com/api-docs' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
