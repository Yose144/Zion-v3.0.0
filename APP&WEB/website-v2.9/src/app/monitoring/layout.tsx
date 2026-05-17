import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Monitoring · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Live Prometheus + Grafana monitoring: chain height, pool metrics, active miners, system health.',
};

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
