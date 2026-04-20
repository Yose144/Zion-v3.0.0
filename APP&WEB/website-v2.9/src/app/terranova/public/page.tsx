import type { Metadata } from 'next';
import TerraNovaPublicClient from './TerraNovaPublicClient';

export const metadata: Metadata = {
  title: 'Terra Nova — Úplná Veřejná Edice · ZION',
  description:
    'Terra Nova: úplná veřejná edice čtvrté knihy komplexu ZION. Veškerý materiál — kosmologie, volná energie, komunity, AI Native, medicína, architektura L1–L6, WARP, Issobella, NVIDIA compute, proroctví a Zlatý Kompas.',
  openGraph: {
    title: 'Terra Nova — Complete Public Edition',
    description:
      'The complete unified edition of the fourth ZION book: from cosmology through free energy, communities, AI, medicine, L1–L6 architecture, WARP drive, orbital observatory, to the Golden Compass.',
  },
};

export default function TerraNovaPublicPage() {
  return <TerraNovaPublicClient />;
}
