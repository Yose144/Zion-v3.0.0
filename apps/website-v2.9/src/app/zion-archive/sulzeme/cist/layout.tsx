import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Sůl této země — číst knihu',
  description: 'Číst knihu Sůl této země — kmenový kanon kompasu, zastavení přes proroky a archu. The root canon of the path.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/sulzeme/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
