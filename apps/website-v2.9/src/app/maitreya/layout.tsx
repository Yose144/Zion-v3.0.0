import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Nirvana Hub — knihovna Nové Země',
  description:
    'Knihovna ZION Terra Nova: Genesis, Kvantová revoluce, Ekam, Terra Nova, Maitreya, Nirvana a doprovodné knihy — jedno čtenářské rozhraní, jeden plán 3.3. All books of the path in one unified reader, one plan.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya` },
};

export default function MaitreyaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
