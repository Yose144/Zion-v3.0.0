import type { Metadata } from 'next';
import { PRIVACY } from '@/data/legal';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Ochrana osobních údajů',
  description: 'Jak Lumi (Omnity.One s.r.o.) zpracovává osobní údaje.',
};

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
