'use client';

import dynamic from 'next/dynamic';

const MissionControlDashboard = dynamic(
  () => import('@/components/MissionControlDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="zion-container py-20 text-center text-gray-400">
        Loading Mission Control…
      </div>
    ),
  }
);

export default function MissionControlLoader() {
  return <MissionControlDashboard />;
}
