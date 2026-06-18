import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `DAO Governance · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION DAO governance — Tree of Life, treasury stewardship, humanitarian tithe, and community voting with consciousness-weighted power.',
};

export default function DaoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
