import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal notice',
  description: 'Legal notice and operator information for ZION Pool.',
  alternates: { canonical: '/legal' },
  openGraph: { url: 'https://pool.zionterranova.com/legal' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
