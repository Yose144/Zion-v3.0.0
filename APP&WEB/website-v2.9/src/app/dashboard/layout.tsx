import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mission control dashboard — pool metrics, system health, NCL curriculum, DAO tree, and presale analytics.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
