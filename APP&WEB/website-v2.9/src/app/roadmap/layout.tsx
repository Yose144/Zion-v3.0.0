import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Roadmap · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION blockchain roadmap — L1 TerraNova 2026, L2 Bridge/DAO/DeFi 2026–2027, L3 AI Native/WARP/NCL 2027–2028, L4 Oasis 2029, L5 Free World 2030, L6 Issobella 2040+.',
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
