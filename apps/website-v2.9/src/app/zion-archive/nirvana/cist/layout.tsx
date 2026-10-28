import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — NIRVANA · Příběhy Nové Země',
  description: 'Číst knihu NIRVANA — dvanáct zastavení na cestě k Velkému sjednocení + most L5 flotily Tres Marías. Západní kniha kompasu ZION, kanon pro 3.3.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/nirvana/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
