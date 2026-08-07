'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import clsx from 'clsx';

const HolographicEarth = dynamic(
  () => import('./HolographicEarth'),
  { ssr: false, loading: () => <EarthSkeleton className="" /> }
);

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function EarthSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('relative animate-pulse aspect-[5/4] w-full max-h-[300px] overflow-hidden rounded-[22px] border border-rasta-gold/30 bg-gradient-to-b from-rasta-black/85 via-rasta-dark/82 to-rasta-black/86 sm:max-h-[340px]', className)}>
      <div className="absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_50%_42%,rgba(252,209,22,0.2),transparent_58%)]" />
    </div>
  );
}

function EarthStaticFallback({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'relative aspect-[5/4] w-full max-h-[300px] overflow-hidden rounded-[22px] sm:max-h-[340px]',
        'border border-rasta-gold/30 bg-gradient-to-b from-rasta-black/85 via-rasta-dark/82 to-rasta-black/86',
        'shadow-[0_12px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(252,209,22,0.06)_inset,0_0_64px_rgba(6,105,40,0.12)]',
        'ring-1 ring-rasta-gold/10',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_50%_42%,rgba(252,209,22,0.22),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_50%_88%,rgba(228,30,43,0.10),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-3 rounded-[16px] border border-white/[0.06]" />
      <p className="pointer-events-none absolute inset-x-0 top-2.5 z-10 text-center text-[9px] font-medium uppercase tracking-[0.42em] text-rasta-gold/50">
        ZION Terra Nova · Earth · Solar System
      </p>
      <div className="absolute inset-x-0 bottom-0 top-9 flex items-center justify-center sm:top-10">
        <div className="relative h-[80%] w-[80%]">
          <Image
            src="/textures/earth-blue-marble.jpg"
            alt="ZION Terra Nova — holographic Earth"
            fill
            className="object-contain opacity-95"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 100vw, 400px"
          />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(252,209,22,0.20),transparent_50%)]" />
          <div className="pointer-events-none absolute -inset-2 rounded-full border border-rasta-gold/20 shadow-[0_0_40px_rgba(252,209,22,0.15)]" />
        </div>
      </div>
    </div>
  );
}

export default function HolographicEarthLazy({ className }: { className?: string }) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (webglOk === null) {
    return <EarthSkeleton className={className} />;
  }

  // Always try 3D if WebGL is available; only fallback for no WebGL or very small screens
  if (!webglOk || isMobile) {
    return <EarthStaticFallback className={className} />;
  }

  return <HolographicEarth className={className} />;
}
