'use client';

import { Component, memo, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useLang } from '@/contexts/LanguageContext';

const NirvanaUniverse = dynamic(
  () => import('./NirvanaUniverse'),
  { ssr: false, loading: () => null }
);

function UniverseStaticFallback() {
  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-[22px] border border-rasta-gold/30 bg-[#02030a] sm:h-[440px] lg:h-[520px]">
      <Image
        src="/images/nirvana-preview-v2.webp"
        alt="Nirvana — vesmír prvního světa OASIS"
        fill
        className="object-cover opacity-90"
        sizes="100vw"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
    </div>
  );
}

/** Local boundary — a broken 3D chunk/WebGL context must never take the page down. */
class UniverseErrorBoundary extends Component<
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

function NirvanaUniverseSection() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  // mount the 3D chunk only when the section scrolls into view
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setMounted(true);
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative px-4 pb-10">
      <div className="zion-container">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-rasta-gold/60 sm:text-[11px]">
              {cs ? 'Okno do světa' : 'A window into the world'}
            </p>
            <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
              NIRVANA{' '}
              <span className="text-sm font-medium text-zion-gold/80 sm:text-base">
                {cs ? '— první svět OASIS' : '— the first OASIS world'}
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-right text-[11px] leading-relaxed text-white/40 sm:text-xs">
            {cs
              ? 'Vesmír s 7 hrami, chatem a multiplayerem — táhni a rozhlédni se, vstup je na ZAP kód.'
              : 'A universe with 7 games, chat and multiplayer — drag to look around, entry via ZAP code.'}
          </p>
        </div>

        <div ref={wrapRef} className="relative">
          {/* static poster — SSR-friendly, hidden once the real scene renders */}
          <div aria-hidden={ready || undefined} className={ready ? 'invisible' : ''}>
            <UniverseStaticFallback />
          </div>

          {mounted && !failed && (
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${
                ready ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!ready}
            >
              <UniverseErrorBoundary onError={() => setFailed(true)}>
                <NirvanaUniverse
                  active={visible}
                  onReady={() => setReady(true)}
                  onUnavailable={() => setFailed(true)}
                />
              </UniverseErrorBoundary>
            </div>
          )}

          {!ready && !failed && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-gray-400 backdrop-blur">
                {cs ? 'Načítám 3D vesmír…' : 'Loading the 3D universe…'}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default memo(NirvanaUniverseSection);
