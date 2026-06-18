import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `EKAM · Virtual Tour · ZION TerraNova ${SITE_RELEASE_LABEL}`,
  description:
    'Virtual tour of Ekam — sacred architecture, Surya Yantra geometry, Sri Chakra, Deeksha ceremony, and the Hiranyagarbha Golden Egg temple.',
  keywords:
    'EKAM, Hiranyagarbha, Golden Egg, Deeksha, Sri Chakra, Surya Yantra, sacred geometry, Oneness, ZION TerraNova',
};

export default function EkamLayout({ children }: { children: React.ReactNode }) {
  return children;
}