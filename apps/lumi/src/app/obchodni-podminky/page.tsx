import type { Metadata } from 'next';
import { TERMS } from '@/data/legal';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Obchodní podmínky',
  description: 'Obchodní podmínky e-shopu Lumi — Omnity.One s.r.o.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
