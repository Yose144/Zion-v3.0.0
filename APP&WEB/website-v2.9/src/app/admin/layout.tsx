import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Admin · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mining pool admin — algorithm routing, pool configuration, and revenue analytics.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
