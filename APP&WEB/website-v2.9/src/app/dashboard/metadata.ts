import type { Metadata } from "next";
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Live systems dashboard: health checks, validator status, blockchain vitals, and operational roadmap for the Deeksha release line.',
  keywords: "ZION dashboard, mission control, blockchain metrics, validator status, ML orchestrator, WARP bridge",
};
