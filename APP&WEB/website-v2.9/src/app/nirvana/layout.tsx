import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'NIRVANA — Kniha Západu · Příběhy Nové Země',
  description:
    'NIRVANA — Západní kniha kompasu ZION a kanon pro 3.3: dvanáct zastavení od prvního paprsku přes Ararat, Novou zemi a vrstvy L1–L6 až k Velkému sjednocení. Plus most L5 — flotila Tres Marías.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya` },
};

export default function NirvanaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
