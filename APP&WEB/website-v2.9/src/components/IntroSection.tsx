'use client';

import { useRef } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

/**
 * Intro sekce na homepage — loop muted video v rámu (jako na newearth.cz).
 * - Portrait video (480x712) zobrazené v elegantním rámu
 * - Loop muted playsinline
 * - Klik na video otevře fullscreen overlay
 */
export default function IntroSection() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);

  const openFullscreen = () => {
    const overlay = document.getElementById('intro-fullscreen-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlayRef.current?.play();
    }
  };

  const closeFullscreen = () => {
    const overlay = document.getElementById('intro-fullscreen-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlayRef.current?.pause();
    }
  };

  return (
    <section className="relative px-4 py-16 md:py-20">
      <div className="zion-container">
        <div className="grid gap-8 lg:grid-cols-[0.4fr_1fr] lg:items-center">
          {/* ── Left: Video in frame ── */}
          <div className="space-y-3">
            <div
              className="relative overflow-hidden rounded-2xl border border-zion-gold/20 shadow-[0_18px_60px_rgba(0,0,0,0.45)] cursor-pointer group"
              onClick={openFullscreen}
            >
              <video
                ref={videoRef}
                loop
                muted
                playsInline
                autoPlay
                preload="metadata"
                className="aspect-[480/712] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              >
                <source src="/zion-intro.webm" type="video/webm" />
                <source src="/zion-intro.mp4" type="video/mp4" />
              </video>
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="rounded-full border border-zion-gold/50 bg-black/60 p-4 backdrop-blur-sm">
                  <svg className="h-8 w-8 text-zion-gold" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              {/* Badge */}
              <div className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100 backdrop-blur-sm">
                {cs ? 'Klikni pro fullscreen' : 'Click for fullscreen'}
              </div>
            </div>
          </div>

          {/* ── Right: Content ── */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/20 bg-zion-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.32em] text-zion-gold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zion-gold" />
              {tr('intro', 'badge', lang)}
            </div>

            <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              {cs ? 'ZION Intro — Brána do Terra Nova' : 'ZION Intro — Gateway to Terra Nova'}
            </h2>

            <p className="max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
              {cs
                ? 'Původní intro video z newearth.cz — naše vizuální brána do světa ZION TerraNova. Kosmická cesta vědomí, Deeksha požehnání a Hiran jako AI brána.'
                : 'The original intro video from newearth.cz — our visual gateway into the world of ZION TerraNova. Cosmic journey of consciousness, Deeksha blessing, and Hiran as the AI gateway.'}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openFullscreen}
                className="zion-button-primary group"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {cs ? 'Přehrát fullscreen' : 'Play fullscreen'}
              </button>
              <a
                href="https://newearth.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                {cs ? 'newearth.cz' : 'newearth.cz'}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fullscreen overlay (hidden by default) ── */}
      <div
        id="intro-fullscreen-overlay"
        className="fixed inset-0 z-[9998] hidden items-center justify-center bg-black/90"
        onClick={closeFullscreen}
      >
        <video
          ref={overlayRef}
          loop
          muted
          playsInline
          controls
          className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.8)]"
        >
          <source src="/zion-intro.webm" type="video/webm" />
          <source src="/zion-intro.mp4" type="video/mp4" />
        </video>
        <button
          className="absolute top-6 right-6 rounded-full border border-white/20 bg-black/50 p-3 text-white backdrop-blur-sm transition-all hover:border-zion-gold/60 hover:text-zion-gold"
          onClick={closeFullscreen}
          aria-label={cs ? 'Zavřít' : 'Close'}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </section>
  );
}
