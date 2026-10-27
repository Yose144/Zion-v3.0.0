'use client';

import { Component, memo, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';

const HolographicEarth = dynamic(
  () => import('./HolographicEarth'),
  { ssr: false, loading: () => null }
);

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
      <p className="pointer-events-none absolute inset-x-0 top-2.5 z-10 truncate text-center text-[9px] font-medium uppercase tracking-[0.42em] text-rasta-gold/50">
        ZION Terra Nova · Earth · Solar System
      </p>
      <div className="absolute inset-x-0 bottom-0 top-9 flex items-center justify-center sm:top-10">
        <div className="relative aspect-square h-[80%]">
          <div className="absolute inset-0 overflow-hidden rounded-full shadow-[inset_-18px_-14px_40px_rgba(0,0,0,0.55),inset_10px_8px_24px_rgba(255,255,255,0.08)]">
            <Image
              src="/textures/earth-blue-marble.webp"
              alt="ZION Terra Nova — holographic Earth"
              fill
              className="object-cover opacity-95"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 80vw, 340px"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(252,209,22,0.16),transparent_50%)]" />
          <div className="pointer-events-none absolute -inset-2 rounded-full border border-rasta-gold/20 shadow-[0_0_40px_rgba(252,209,22,0.15)]" />
        </div>
      </div>
    </div>
  );
}

/** Local boundary — a broken 3D chunk/WebGL context must never take the page down. */
class EarthErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function HolographicEarthLazy({ className }: { className?: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: '200px',
    });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const show3D = !failed;

  const handleUnavailable = () => {
    setFailed(true);
    setReady(false);
  };

  return (
    <div ref={wrapRef} className={clsx('relative', className)}>
      {/* static textured poster — always useful, SSR-friendly. Keeps the
          layout height; hidden once the real scene is on screen so its
          caption/earth can't bleed through the transparent 3D canvas. */}
      <div aria-hidden={ready || undefined} className={ready ? 'invisible' : ''}>
        <EarthStaticFallback />
      </div>

      {/* 3D layer mounts automatically (native mode — no opt-in); poster stays
          until the day texture actually rendered (onReady). Bounds match the
          card area exactly — never covers the status row. */}
      {show3D && (
        <div
          className={`absolute inset-x-0 top-0 aspect-[5/4] max-h-[300px] sm:max-h-[340px] transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!ready}
        >
          <EarthErrorBoundary onError={handleUnavailable}>
            <HolographicEarth
              active={visible && pageVisible}
              onReady={() => setReady(true)}
              onUnavailable={handleUnavailable}
            />
          </EarthErrorBoundary>
        </div>
      )}

      {/* status row — loading note while the scene comes up; failure note
          when WebGL is unavailable (poster stays as the fallback). */}
      {!ready && !failed && (
        <div className="mt-2 flex items-center justify-center">
          <span className="text-xs text-gray-400">{cs ? 'Načítám 3D…' : 'Loading 3D…'}</span>
        </div>
      )}
      {failed && (
        <div className="mt-2 flex items-center justify-center">
          <span className="text-xs text-gray-500">
            {cs ? 'Interaktivní 3D není k dispozici' : 'Interactive 3D is not available'}
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(HolographicEarthLazy);
