import type { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import GameWorld from '@/components/GameWorld';
import Skeleton from '@/components/Skeleton';

const Scene = dynamic(() => import('./Scene'), { ssr: false, loading: () => <Skeleton /> });
const Panel = dynamic(() => import('./Panel'), { ssr: false });

export const metadata: Metadata = {
  title: 'ZION OASIS · Dashboard',
  description: 'Your pilgrim dashboard, stats, and reward pools.',
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton lines={4} className="m-auto max-w-sm" />}>
      <GameWorld mode="dashboard" panel={<Panel />}>
        <Scene />
      </GameWorld>
    </Suspense>
  );
}
