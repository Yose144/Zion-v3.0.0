import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Issobella — číst knihu',
  description: 'Číst knihu Issobella — orbitální stanice L6, kvantový oheň, příběh nebe nad námi.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/issobella/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
