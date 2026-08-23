import type { Metadata } from "next";
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `ZION Dashboard · ${SITE_RELEASE_LABEL}`,
  description: `One Love mainnet systems dashboard: health checks, launch blockers, blockchain vitals, and operational roadmap for ${SITE_RELEASE_LABEL}.`,
  keywords: "ZION dashboard, One Love mainnet, mission control, blockchain metrics, launch blockers, validator status, WARP bridge",
};
