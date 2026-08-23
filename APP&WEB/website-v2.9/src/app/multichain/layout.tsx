import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Multichain Hub · ZION TerraNova',
  description: 'ZION Multichain Hub — swap, bridge, DEX, earn, governance, and auction in one place.',
};

export default function MultichainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
