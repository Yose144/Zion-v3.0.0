import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roadmap · ZION v2.9.7',
  description: 'ZION blockchain roadmap — L1 TerraNova 2026, L2 NCL 2027, L3 DAO 2028, L4 Oasis 2029, L5 Free World 2030, L6 Issobella 2040+.',
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
