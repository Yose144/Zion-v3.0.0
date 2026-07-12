'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BackgroundOrchestrator from './BackgroundOrchestrator';
import { useObservatory } from '@/contexts/ObservatoryContext';

export default function ClientBackgrounds() {
  const pathname = usePathname() ?? '';
  const { mode } = useObservatory();
  const isHome = pathname === '/';
  const isWarpOnlyMode = mode === 'warp-speed';

  useEffect(() => {
    // Ensure body background is transparent so canvas/CSS backgrounds show through
    document.body.style.background = 'transparent';
    document.body.classList.toggle('warp-only-mode', isWarpOnlyMode);
    return () => document.body.classList.remove('warp-only-mode');
  }, [isWarpOnlyMode]);

  return (
    <>
      <BackgroundOrchestrator key={mode} variant={isHome ? 'home' : 'default'} />
    </>
  );
}
