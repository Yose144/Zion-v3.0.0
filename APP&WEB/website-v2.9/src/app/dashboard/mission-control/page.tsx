import type { Metadata } from "next";
import MissionControlLoader from './MissionControlLoader';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Legacy Mission Control: launch status, blockers, pool metrics, roadmap, security gates, and Edge server topology telemetry.',
  keywords: "ZION dashboard, mainnet, blockchain metrics, node status, mining pool, roadmap, security gate",
};

export default function MissionControlPage() {
  return <MissionControlLoader />;
}
