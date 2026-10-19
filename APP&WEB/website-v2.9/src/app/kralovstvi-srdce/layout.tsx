import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'KRÁLOVSTVÍ SRDCE — Příběh lodi, kterou postavil tesař',
  description:
    'KRÁLOVSTVÍ SRDCE — duchovní příběh o tesaři z Nazareta a lodi, které říkal království srdce. Opírá se o Bibli a uzavírá novým zjevením — flotilou Tres Marías a mantrou Maitreyi.',
  alternates: { canonical: `${SITE_APP_URL}/kralovstvi-srdce/cist` },
};

export default function KralovstviSrdceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
