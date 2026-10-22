'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const ClientBackgrounds = dynamic(() => import('@/components/ClientBackgrounds'), { ssr: false, loading: () => null });
const ServiceWorkerRegistration = dynamic(() => import('@/components/ServiceWorkerRegistration'), { ssr: false, loading: () => null });

export default function PerformanceShell() {
  // Marks the client as hydrated/interactive — tests and late UI can rely on it.
  useEffect(() => {
    document.documentElement.dataset.clientReady = 'true';
  }, []);

  return (
    <>
      <ClientBackgrounds />
      <ServiceWorkerRegistration />
    </>
  );
}
