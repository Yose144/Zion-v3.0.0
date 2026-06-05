'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const BACKGROUND_DISABLED_PREFIXES = [
  '/api-reference',
  '/bridge',
  '/defi',
  '/docs',
  '/download',
  '/explorer',
  '/monitoring',
  '/network',
];

const BackgroundOrchestrator = dynamic(
  () => import('./BackgroundOrchestrator'),
  { ssr: false }
);

const BackgroundToggle = dynamic(
  () => import('./BackgroundToggle'),
  { ssr: false }
);

const WarpSpeedBackground = dynamic(
  () => import('./WarpSpeedBackground'),
  { ssr: false }
);

export default function ClientBackgrounds() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const backgroundsDisabled = BACKGROUND_DISABLED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (pathname === '/warp') {
    return <WarpSpeedBackground starColor={[200, 160, 255]} speed={24} density={500} />;
  }

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
