import type { Metadata } from 'next';
import NewsArchive from '@/components/NewsArchive';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Novinky | News · ZION ${SITE_RELEASE_LABEL}`,
  description: 'All ZION ecosystem news and updates — DeFi, mining, benchmarks, network, releases. Všechny novinky z ZION ekosystému.',
};

export default function NewsPage() {
  return <NewsArchive />;
}
