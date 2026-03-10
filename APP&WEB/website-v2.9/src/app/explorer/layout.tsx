import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explorer · ZION v2.9.8',
  description: 'Explore ZION blockchain blocks, transactions, addresses, and network statistics in real-time.',
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
