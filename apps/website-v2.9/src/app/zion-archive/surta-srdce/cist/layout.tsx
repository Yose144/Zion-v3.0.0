import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — SURTA SRDCE · sūtra srdce',
  description: 'Číst knihu Surta Srdce — otcův dopis synovi a soupis cesty mantrou od gate gate po om mani padme hūṃ. Zpáteční kniha ZION kompasu.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/surta-srdce/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
