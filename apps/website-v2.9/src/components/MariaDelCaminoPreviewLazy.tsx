'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const MariaDelCaminoPreview = dynamic(() => import('./MariaDelCaminoPreview'), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
});

function PreviewSkeleton() {
  return (
    <div className="flex h-[420px] md:h-[520px] w-full items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40">
      <div className="flex flex-col items-center gap-3 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin text-zion-gold" />
        <span className="text-xs uppercase tracking-widest">Načítání 3D preview / Loading 3D preview…</span>
      </div>
    </div>
  );
}

export default function MariaDelCaminoPreviewLazy({
  lang = 'cs',
  className = '',
}: {
  lang?: 'cs' | 'en';
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // R3F measures the canvas once, when it first mounts. On routes where the
    // surrounding card lays out a frame later the canvas keeps its 300x150
    // default and the preview stays blank, because no further measurement
    // arrives. Nudge a resize until the canvas reports a real width.
    let cancelled = false;
    const timers: number[] = [];
    const nudge = (attempt: number) => {
      if (cancelled) return;
      const box = shell.current?.getBoundingClientRect();
      const canvas = shell.current?.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      // A canvas that has not been measured yet still reports the 300x150 default,
      // so compare it against the wrapper instead of its raw width.
      if (box && rect && Math.abs(rect.width - box.width) < 4) return;
      window.dispatchEvent(new Event('resize'));
      if (attempt < 24) timers.push(window.setTimeout(() => nudge(attempt + 1), 200));
    };
    timers.push(window.setTimeout(() => nudge(0), 200));
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  if (!mounted) {
    return <PreviewSkeleton />;
  }

  return (
    // The wrapper owns the height: relying on the scene root keeps the canvas at 0 px
    // when its own utilities are not applied for a route.
    <div ref={shell} className={`w-full h-[420px] md:h-[520px] ${className}`}>
      <MariaDelCaminoPreview lang={lang} className="h-full w-full" />
    </div>
  );
}
