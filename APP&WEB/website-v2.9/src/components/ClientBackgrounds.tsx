'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

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
  const [enableHeavyScene, setEnableHeavyScene] = useState(!isHome);

  useEffect(() => {
    if (!isHome) {
      setEnableHeavyScene(true);
      return;
    }

    setEnableHeavyScene(false);

    const onWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const activate = () => setEnableHeavyScene(true);

    if (typeof onWindow.requestIdleCallback === 'function') {
      idleId = onWindow.requestIdleCallback(activate, { timeout: 1800 });
    } else {
      timeoutId = window.setTimeout(activate, 1200);
    }

    return () => {
      if (idleId !== null && typeof onWindow.cancelIdleCallback === 'function') {
        onWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isHome]);

  return (
    <>
      {enableHeavyScene ? (
        <BackgroundOrchestrator />
      ) : (
        <div className="pointer-events-none fixed inset-0 -z-40 bg-[radial-gradient(circle_at_50%_18%,rgba(34,43,82,0.55),rgba(4,6,14,0.95)_62%,rgba(0,0,0,0.99)_100%)]" />
      )}
      <BackgroundToggle />
    </>
  );
}
