import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — SURTA SRDCE · Sūtra srdce pro Surtu',
  description:
    'Číst knihu SURTA SRDCE — otcův dopis synovi a soupis celé cesty od gate gate po om mani padme hūṃ. Malý Buddha na Santa María la Mayor do Dharma Temple na La Palmě; zlaté vejce Hiranyagarbhy, bodhisattva nové země.',
  alternates: { canonical: `${SITE_APP_URL}/surta-srdce/cist` },
};

export default function SurtaSrdceCistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
