import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about ZION Pool: payouts, PPLNS, SOLO mining, fees, supported miners and multi-coin streams.',
  alternates: { canonical: '/faq' },
  openGraph: { url: 'https://pool.zionterranova.com/faq' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
