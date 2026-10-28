import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — KRÁLOVSTVÍ SRDCE · příběh lodi',
  description: 'Číst knihu Království srdce — loď, kterou postavil tesař z Nazareta pro moře, které není na mapě. Bible + nové zjevení, flotila Tres Marías.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/kralovstvi-srdce/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
