import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const G8Client = dynamic(() => import('./G8Client'));

export const metadata: Metadata = {
  title: `30-Day Stability Run · ZION ${SITE_RELEASE_LABEL}`,
  description:
    'Live public view of the ZION network 30-day continuous stability run: uptime, evidence coverage, monitored signals and run verdict.',
};

export default function G8Page() {
  return <G8Client />;
}
