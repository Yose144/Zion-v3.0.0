import type { Metadata } from 'next';
import TerraNovaBookLoader from './TerraNovaBookLoader';

export const metadata: Metadata = {
  title: 'Terra Nova — více edic knihy ZION · ZION',
  description:
    'Terra Nova ve webové čtečce ZION: organická ORG větev, technická FINAL/Cloud edice a sci-fi Gemini odysea v jednom lokálním readeru.',
  openGraph: {
    title: 'Terra Nova — ORG, FINAL a Gemini',
    description:
      'Lokální čtečka Terra Novy se třemi verzemi: ORG, FINAL/Cloud a Gemini sci-fi odysea.',
  },
};

export default function TerraNovaPage() {
  return <TerraNovaBookLoader />;
}
