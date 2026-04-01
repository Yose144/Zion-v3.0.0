'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const BACKGROUND_DISABLED_PREFIXES = [
  '/api-reference',
  '/bridge',
  '/dashboard',
  '/defi',
  '/docs',
  '/download',
  '/explorer',
  '/monitoring',
  '/network',
  '/pool',
];

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
  const backgroundsDisabled = BACKGROUND_DISABLED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (backgroundsDisabled) {
    return null;
  }

  return (
    <>
      <BackgroundOrchestrator variant={isHome ? 'home' : 'default'} />
      <BackgroundToggle />
    </>
  );
}
