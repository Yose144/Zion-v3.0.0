import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Číst knihu — KRÁLOVSTVÍ SRDCE · Loď, kterou postavil tesař',
  description:
    'Číst knihu KRÁLOVSTVÍ SRDCE — tesař z Nazareta staví loď pro moře, které není na mapě. Bible + tradice navicelly + nové zjevení: Tres Marías a mantra Maitreyi.',
  alternates: { canonical: `${SITE_APP_URL}/kralovstvi-srdce/cist` },
};

export default function KralovstviSrdceCistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
