import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Genesis · Book of Awakening · ZION',
  description: 'The sacred Genesis document of ZION blockchain — the Book of Awakening, a journey from physical realm to cosmic consciousness.',
};

export default function GenesisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
