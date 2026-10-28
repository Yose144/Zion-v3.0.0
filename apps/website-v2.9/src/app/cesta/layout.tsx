import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Cesta — od vejce k Nirváně · ZION',
  description:
    'Roadmapa příběhu ZION: kompas čtyř knih a posvátného středu, šest mantra-zastavení od Geneze přes Maitreyu k Nirváně, dvanáct+1 stanic L1–L6 a knihy os.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive` },
};

export default function CestaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
