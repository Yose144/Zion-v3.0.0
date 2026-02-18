import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DAO Governance · ZION v2.9.6',
  description: 'ZION DAO governance — Tree of Life, treasury stewardship, humanitarian tithe, and community voting with consciousness-weighted power.',
};

export default function DaoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
