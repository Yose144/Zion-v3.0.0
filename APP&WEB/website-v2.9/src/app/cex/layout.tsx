import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `CEX Listings · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION CEX listings — track exchange listings, trading pairs, and how to buy ZION on centralized exchanges.',
};

export default function CexLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
