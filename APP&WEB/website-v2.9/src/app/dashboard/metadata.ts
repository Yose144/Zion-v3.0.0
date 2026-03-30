import type { Metadata } from "next";
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: `Test-mainnet systems dashboard: rehearsal health checks, launch blockers, blockchain vitals, and operational roadmap for the ${SITE_RELEASE_LABEL} controlled line over ${SITE_RUNTIME_LABEL}.`,
  keywords: "ZION dashboard, test mainnet, mission control, blockchain metrics, launch rehearsal, validator status, WARP bridge",
};
