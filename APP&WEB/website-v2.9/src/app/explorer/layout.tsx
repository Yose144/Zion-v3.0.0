import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Explorer · ZION ${SITE_RELEASE_LABEL}`,
  description: `Explore | Prozkoumejte ZION blockchain blocks, transactions, addresses, and network statistics in real-time on the ${SITE_RELEASE_LABEL} public line with ${SITE_RUNTIME_LABEL} compatibility.`,
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
