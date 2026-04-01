'use client';

import { useEffect, useEffectEvent, useState } from 'react';

interface PollingOptions {
  enabled?: boolean;
  immediate?: boolean;
  runWhenHidden?: boolean;
}

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState !== 'hidden');
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: PollingOptions = {},
) {
  const { enabled = true, immediate = true, runWhenHidden = false } = options;
  const isVisible = usePageVisibility();
  const onTick = useEffectEvent(callback);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const tick = () => {
      if (!runWhenHidden && !isVisible) {
        return;
      }

      void onTick();
    };

    if (immediate) {
      tick();
    }

    const timerId = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timerId);
  }, [enabled, immediate, intervalMs, isVisible, runWhenHidden]);

  return isVisible;
}