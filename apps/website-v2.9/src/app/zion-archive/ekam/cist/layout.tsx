import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — EKAM DEEKSHA · algoritmus jednoty',
  description: 'Číst knihu Ekam Deeksha — filozofie, kosmologie a praxe Zlatého věku v sedmi částech + glosář. Kniha třetí kompasu ZION.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/ekam/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
