'use client';

import { Shell } from '@/core/shell/Shell';

/**
 * Brána (ZAP pas) je v `app/layout.tsx` pro **všechny** routy — tady by
 * byla druhá a po odemčení by se mountovala znovu.
 */
export default function HomePage() {
  return <Shell />;
}
