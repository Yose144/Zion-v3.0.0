import type { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import GameWorld from '@/components/GameWorld';
import Skeleton from '@/components/Skeleton';

const Scene = dynamic(() => import('./Scene'), { ssr: false, loading: () => <Skeleton /> });
const Panel = dynamic(() => import('./Panel'), { ssr: false });

export const metadata: Metadata = {
  title: 'ZION OASIS · Avatars',
  description: 'Browse the Avatar Codex and find your guide.',
};

export default function AvatarsPage() {
  return (
    <Suspense fallback={<Skeleton lines={4} className="m-auto max-w-sm" />}>
      <GameWorld mode="avatars" panel={<Panel />}>
        <Scene />
      </GameWorld>
    </Suspense>
  );
}
