import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'Terms of service for ZION Pool, the public mining pool of the ZION TerraNova ecosystem.',
  alternates: { canonical: '/terms' },
  openGraph: { url: 'https://pool.zionterranova.com/terms' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
