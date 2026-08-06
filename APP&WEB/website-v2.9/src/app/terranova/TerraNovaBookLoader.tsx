'use client';

import dynamic from 'next/dynamic';

const TerraNovaBookClient = dynamic(
  () => import('./TerraNovaBookClient'),
  {
    ssr: false,
    loading: () => (
      <div className="zion-container py-20 text-center text-white/70">
        Načítání Terra Nova…
      </div>
    ),
  }
);

export default function TerraNovaBookLoader() {
  return <TerraNovaBookClient />;
}
