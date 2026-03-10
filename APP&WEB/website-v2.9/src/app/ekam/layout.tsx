import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `EKAM · Golden Egg · ZION TerraNova ${SITE_RELEASE_LABEL}`,
  description:
    'A public-facing concept page for the ZION Golden Egg, Hiranyagarbha, and a future lightweight museum path from cosmic origin to consciousness.',
  keywords:
    'EKAM, Hiranyagarbha, Golden Egg, cosmology museum, consciousness, ZION TerraNova',
};

export default function EkamLayout({ children }: { children: React.ReactNode }) {
  return children;
}