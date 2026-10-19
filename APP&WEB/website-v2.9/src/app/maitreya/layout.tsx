import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Maitreya Buddha — knihy, souvislosti a plán 3.3',
  description:
    'Knihovna ZION Terra Nova: Maitreya (Kniha Pátá), Nirvana (Kniha Západu), doprovodné knihy a veřejný rámec plánu 3.3 — cíle, podmínky a evidence, ne sliby. The books, their connections and the path to 3.3 Nirvana.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya` },
};

export default function MaitreyaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
