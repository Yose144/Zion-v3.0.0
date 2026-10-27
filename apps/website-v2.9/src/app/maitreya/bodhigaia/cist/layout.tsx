import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'BodhiGaia — číst knihu',
  description: 'Číst knihu BodhiGaia — zahrady Nové Země, do nichž trupy dovážejí sůl.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya/bodhigaia/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
