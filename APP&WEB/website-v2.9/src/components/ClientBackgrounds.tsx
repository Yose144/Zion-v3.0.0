'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BackgroundOrchestrator from './BackgroundOrchestrator';
import WarpSpeedBackground from './WarpSpeedBackground';
import { useObservatory } from '@/contexts/ObservatoryContext';

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

export default function ClientBackgrounds() {
  const pathname = usePathname() ?? '';
  const { mode } = useObservatory();
  const isHome = pathname === '/';
  const backgroundsDisabled = BACKGROUND_DISABLED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isWarpOnlyMode = mode === 'warp-speed';

  useEffect(() => {
    document.body.classList.toggle('warp-only-mode', isWarpOnlyMode);
    return () => document.body.classList.remove('warp-only-mode');
  }, [isWarpOnlyMode]);

  if (pathname === '/warp') {
    return (
      <WarpSpeedBackground
        starColor={[80, 230, 210]}
        speed={24}
        density={500}
        backgroundGradient="radial-gradient(ellipse at center, #0a2e2a 0%, #020a0a 100%)"
      />
    );
  }

  if (backgroundsDisabled) {
    return null;
  }

  return (
    <>
      <BackgroundOrchestrator variant={isHome ? 'home' : 'default'} />
    </>
  );
}
