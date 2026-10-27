import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — KVANTOVÁ REVOLUCE · povídka u ohně',
  description: 'Číst knihu Kvantová revoluce — příběh u ohně o Nové Zemi: ZION jako Strom Života, kvantová magie, technologie vědomí. Kniha druhá kompasu ZION.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya/quantum-revolution/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
