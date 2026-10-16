import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DOGE vs ZION',
  alternates: { canonical: '/doge-vs-zion' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
