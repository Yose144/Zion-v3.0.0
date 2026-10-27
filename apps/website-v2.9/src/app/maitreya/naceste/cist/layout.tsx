import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Na Cestě — číst knihu',
  description: 'Číst knihu Na Cestě — Lumen na flotile, pracovní deník cesty.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya/naceste/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
