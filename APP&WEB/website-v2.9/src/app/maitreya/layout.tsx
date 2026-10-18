import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Maitreya Buddha — Book Five',
  description:
    'Maitreya Buddha — Pán Hiranyagarbhy, Dědic Zionu. Příběh o tom, jak padají věže Babylonu a jak láska a pravda rodí Nový svět. Prolog, 17 kapitol a epilog — česky i anglicky, s ověřitelnými fakty.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya` },
};

export default function MaitreyaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
