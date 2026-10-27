import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Mise Amenti — číst rámec',
  description: 'Číst Mise Amenti — prováděcí rámec plánu 3.3: evidence, brány a review.',
  alternates: { canonical: `${SITE_APP_URL}/maitreya/miseamenti/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
