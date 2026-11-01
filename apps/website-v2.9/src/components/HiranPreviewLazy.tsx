'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const HiranPreview = dynamic(() => import('./HiranPreview'), {
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

export default function HiranPreviewLazy({
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
    // R3F měří plátno jednou při mountu; když karta dostane rozměr později,
    // zůstane 300×150 a náhled je prázdný. Dokud se neshoduje, posíláme resize.
    let cancelled = false;
    const timers: number[] = [];
    const nudge = (attempt: number) => {
      if (cancelled) return;
      const box = shell.current?.getBoundingClientRect();
      const rect = shell.current?.querySelector('canvas')?.getBoundingClientRect();
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

  if (!mounted) return <PreviewSkeleton />;

  return (
    <div ref={shell} className={`w-full h-[420px] md:h-[520px] ${className}`}>
      <HiranPreview lang={lang} className="h-full w-full" />
    </div>
  );
}
