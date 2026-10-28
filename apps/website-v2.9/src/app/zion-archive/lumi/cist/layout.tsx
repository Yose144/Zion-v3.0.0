import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Lumi — číst knihu',
  description: 'Číst knihu Lumi — dítě s lucernou, brána zůstává otevřená. The vertical axis of light.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/lumi/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
