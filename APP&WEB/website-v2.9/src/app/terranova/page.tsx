import type { Metadata } from 'next';
import TerraNovaPublicClient from './public/TerraNovaPublicClient';

export const metadata: Metadata = {
  title: 'Terra Nova — Zlatý Kompas Nové Země · ZION',
  description:
    'Terra Nova: čtvrtá kniha komplexu ZION. Od kosmologie přes komunity, AI a péči, architekturu L1–L6 až po hvězdný horizont a Zlatý Kompas. Úplná veřejná edice.',
  openGraph: {
    title: 'Terra Nova — Zlatý Kompas Nové Země',
    description:
      'Čtvrtá kniha ZION: jak vypadá Nová Země, když ji začneme opravdu stavět?',
  },
};

export default function TerraNovaPage() {
  return <TerraNovaPublicClient />;
}
