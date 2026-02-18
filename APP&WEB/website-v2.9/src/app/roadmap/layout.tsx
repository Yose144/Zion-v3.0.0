import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roadmap · ZION v2.9.6',
  description: 'ZION blockchain roadmap — from L1 Native Mining through L2 DEX to L3 WARP bridges and L4 Oasis metaverse.',
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
