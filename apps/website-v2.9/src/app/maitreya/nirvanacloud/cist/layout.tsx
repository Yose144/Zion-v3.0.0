import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'NirvanaCloud — číst knihu',
  description: 'Číst knihu NirvanaCloud — kosmologie za horizontem, bardo, Amenti. Kanonický společník.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya/nirvanacloud/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
