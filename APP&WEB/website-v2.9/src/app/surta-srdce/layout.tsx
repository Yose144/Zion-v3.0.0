import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'SURTA SRDCE — Kniha pro Surtu · Příběh Návratu',
  description:
    'SURTA SRDCE — zpáteční kniha kompasu ZION: otcův dopis synovi a soupis celé cesty od gate gate po om mani padme hūṃ. Bodhisattva nové země, Dharma Temple na La Palmě.',
  alternates: { canonical: `${SITE_APP_URL}/surta-srdce/cist` },
};

export default function SurtaSrdceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
