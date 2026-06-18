import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terra Nova · ZION',
  description: 'Terra Nova — Zlaty Kompas Nove Zeme. Webova ctecka se tremi verzemi: ORG, FINAL/Cloud a Gemini.',
};

export default function TerranovaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
