import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — Maitreya Buddha',
  description:
    'Číst celou knihu Maitreya Buddha — prolog, 17 kapitol a epilog. Příběh o pádu věží Babylonu a zrození Nového světa. Read the full Book Five, in Czech and English.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya/cist` },
};

export default function MaitreyaCistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
