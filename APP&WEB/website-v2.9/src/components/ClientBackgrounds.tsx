'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const BackgroundOrchestrator = dynamic(
  () => import('./BackgroundOrchestrator'),
  { ssr: false }
);

const BackgroundToggle = dynamic(
  () => import('./BackgroundToggle'),
  { ssr: false }
);

export default function ClientBackgrounds() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <>
      <BackgroundOrchestrator variant={isHome ? 'home' : 'default'} />
      <BackgroundToggle />
    </>
  );
}
