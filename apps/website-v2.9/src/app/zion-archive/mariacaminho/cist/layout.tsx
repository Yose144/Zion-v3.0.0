import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'MariaCaminho — číst knihu',
  description: 'Číst knihu MariaCaminho — osa prostoru, tři zjevení, credencial, flotila Tres Marías.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/mariacaminho/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
