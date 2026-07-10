import type { Metadata } from 'next';
import TreeOfLifePageClient from './TreeOfLifePageClient';

export const metadata: Metadata = {
  title: 'Tree of Life — ZION Layer Map',
  description:
    "Kabbalistic Tree of Life mapped to ZION layers L1-L6. 10 sephirot + Da'at, three pillars, 22 paths. ZION as a living organism — from Keter (L1 Consensus) to Malkhut (L6 Issobella).",
  openGraph: {
    title: 'Tree of Life — ZION Layer Map',
    description:
      "Kabbalistic Tree of Life mapped to ZION layers L1-L6. 10 sephirot, 3 pillars, 22 paths. ZION as a living organism.",
    type: 'website',
  },
};

export default function TreeOfLifePage() {
  return <TreeOfLifePageClient />;
}
