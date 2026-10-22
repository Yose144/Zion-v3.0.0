import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/market' },
  title: 'Market Hub · Trh · ZION TerraNova',
  description: 'ZION Market Hub — swap, bridge, DEX, earn, governance, and auction in one place.',
};

export default function MultichainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
