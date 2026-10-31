'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a preview canvas idle until it is actually on screen.
 *
 * The project pages mount a 3D preview below the fold; before this hook every canvas
 * rendered continuously from page load, which is why the website measured 7–18 fps while
 * Nirvana (a single full-screen canvas) measured 40–60. Returning `false` lets the caller
 * switch the canvas to `frameloop="never"`, so an off-screen preview costs nothing.
 */
export function usePreviewVisibility<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    );
    observer.observe(node);
    // Pause again when the tab is hidden; a background tab should not render at all.
    const onVisibility = () => setVisible(!document.hidden && node.getBoundingClientRect().top < window.innerHeight + 200);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { ref, visible };
}
