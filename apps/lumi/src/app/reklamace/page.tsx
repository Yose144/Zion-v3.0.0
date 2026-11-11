import type { Metadata } from 'next';
import { CLAIMS } from '@/data/legal';
import LegalPage from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Reklamace a vrácení',
  description: 'Reklamace a vrácení zboží Lumi.',
};

export default function ClaimsPage() {
  return <LegalPage doc={CLAIMS} />;
}
