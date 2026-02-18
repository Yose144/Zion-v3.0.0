'use client';

import dynamic from 'next/dynamic';

const BackgroundOrchestrator = dynamic(
  () => import('./BackgroundOrchestrator'),
  { ssr: false }
);

const BackgroundToggle = dynamic(
  () => import('./BackgroundToggle'),
  { ssr: false }
);

export default function ClientBackgrounds() {
  return (
    <>
      <BackgroundOrchestrator />
      <BackgroundToggle />
    </>
  );
}
