import type { Metadata } from "next";
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: `Live systems dashboard: health checks, validator status, blockchain vitals, and operational roadmap for the ${SITE_RELEASE_LABEL} public line over ${SITE_RUNTIME_LABEL}.`,
  keywords: "ZION dashboard, mission control, blockchain metrics, validator status, ML orchestrator, WARP bridge",
};
