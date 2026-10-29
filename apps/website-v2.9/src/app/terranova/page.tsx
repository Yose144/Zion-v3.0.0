import type { Metadata } from 'next';
import TerraNovaBookLoader from './TerraNovaBookLoader';

export const metadata: Metadata = {
  alternates: { canonical: '/terranova' },
  title: 'Terra Nova — kniha Zlatého Kompasu · ZION',
  description:
    'Terra Nova ve webové čtečce ZION: kompletní kniha — prolog, 12 kapitol a přílohy A–D, česky i anglicky. Každé tvrzení nese vrstvu: realita, roadmap, horizont.',
  openGraph: {
    title: 'Terra Nova — Zlatý Kompas Nové Země',
    description:
      'Kompletní kniha Terra Nova v interaktivní čtečce: od Genesis přes komunity, AI a WARP až po Issobellu a Zlatý Kompas.',
  },
};

export default function TerraNovaPage() {
  return <TerraNovaBookLoader />;
}
