'use client';

import dynamic from 'next/dynamic';

const BackgroundToggle = dynamic(() => import('@/components/BackgroundToggle'), {
  ssr: false,
  loading: () => null,
});
const HiranFloatingChat = dynamic(() => import('@/components/HiranFloatingChat'), {
  ssr: false,
  loading: () => null,
});

/**
 * Floating global controls share the page stacking context at z-40 (below the
 * global nav overlay z-50): background toggle at bottom/right 1rem, chat FAB
 * one slot above — never overlapping.
 */
export default function FloatingUtilities() {
  return (
    <>
      <BackgroundToggle />
      <HiranFloatingChat />
    </>
  );
}
