import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mining Guide · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mining setup guides, node configuration, and miner best practices.',
};

export default function MiningLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
