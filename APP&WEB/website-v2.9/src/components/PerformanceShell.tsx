'use client';

import dynamic from 'next/dynamic';

const ClientBackgrounds = dynamic(() => import('@/components/ClientBackgrounds'), { ssr: false, loading: () => null });
const BackgroundToggle = dynamic(() => import('@/components/BackgroundToggle'), { ssr: false, loading: () => null });
const ServiceWorkerRegistration = dynamic(() => import('@/components/ServiceWorkerRegistration'), { ssr: false, loading: () => null });

export default function PerformanceShell() {
  return (
    <>
      <ClientBackgrounds />
      <BackgroundToggle />
      <ServiceWorkerRegistration />
    </>
  );
}
