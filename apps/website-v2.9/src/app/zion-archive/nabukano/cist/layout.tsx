import type { Metadata } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Nabukano — číst knihu Nebeské flotily',
  description: 'Číst knihu Nabukano — nebeská flotila L6: jméno z Babylonu, tři nebeské Marie, dok s lucernou a osa mezi LUMI a Issobellou. Mýtus a vize, ne slib technologie.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive/nabukano/cist` },
};

export default function CistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
