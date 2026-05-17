import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mining Pool · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION mining pool dashboard — PPLNS rewards, real-time stats, and miner telemetry.',
};

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
