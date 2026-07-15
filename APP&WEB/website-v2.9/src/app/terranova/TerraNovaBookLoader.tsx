'use client';

import dynamic from 'next/dynamic';

const TerraNovaBookClient = dynamic(
  () => import('./TerraNovaBookClient'),
  {
    ssr: false,
    loading: () => (
      <div className="zion-container py-20 text-center text-gray-400">
        Načítání Terra Nova…
      </div>
    ),
  }
);

export default function TerraNovaBookLoader() {
  return <TerraNovaBookClient />;
}
