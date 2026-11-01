'use client';

import { Shell } from '@/core/shell/Shell';
import { PassGate } from '@/core/shell/PassGate';

export default function HomePage() {
  return (
    <PassGate>
      <Shell />
    </PassGate>
  );
}
