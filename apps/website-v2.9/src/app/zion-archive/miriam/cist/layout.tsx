import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Miriam — číst knihu',
  description: 'Číst knihu Miriam — osa času, Maria Magdaléna, metoda kámen / hlína / sen.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/miriam/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
