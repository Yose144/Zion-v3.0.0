import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blocks — live feed, luck and effort',
  description: 'Every block found by ZION Pool with per-round luck percentage, effort tracking and finder attribution across ZION and auxPoW legs.',
  alternates: { canonical: '/blocks' },
  openGraph: { url: 'https://pool.zionterranova.com/blocks' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
