import type { Metadata } from 'next';
import ZoharPageClient from './ZoharPageClient';

export const metadata: Metadata = {
  title: 'Zohar — Strom života ZIONu',
  description:
    'Kabalistický Strom života mapovaný na ZION vrstvy L1-L6. 10 sefirot + Da\'at, tři pilíře, 22 cest. ZION jako organismus — od Keter (L1 Consensus) po Malkhut (L6 Issobella).',
  openGraph: {
    title: 'Zohar — Strom života ZIONu',
    description:
      'Kabalistický Strom života mapovaný na ZION vrstvy L1-L6. 10 sefirot, 3 pilíře, 22 cest. ZION jako organismus.',
    type: 'website',
  },
};

export default function ZoharPage() {
  return <ZoharPageClient />;
}
