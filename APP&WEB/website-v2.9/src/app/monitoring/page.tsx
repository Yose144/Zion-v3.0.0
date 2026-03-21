import type { Metadata } from 'next';
import MonitoringClient from './MonitoringClient';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Monitoring · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Live Prometheus + Grafana monitoring: chain height, pool metrics, active miners, system health. ZION TerraNova V3 observability stack.',
};

export default function MonitoringPage() {
  return <MonitoringClient />;
}
