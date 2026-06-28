'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

/**
 * Fullscreen intro splash — přehraje video při první návštěvě.
 * - sessionStorage: nepřehrává se znovu při navigaci
 * - "Přeskočit" tlačítko + auto-dismiss po skončení videa
 * - Esc klávesa pro skip
 * - Fade-out animace
 */
const STORAGE_KEY = 'zion-intro-played';

export default function IntroSplash() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  // Show on first visit (sessionStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const played = sessionStorage.getItem(STORAGE_KEY);
      if (!played) {
        setVisible(true);
        document.body.style.overflow = 'hidden';
      }
    } catch {
      // sessionStorage not available — skip intro
    }
  }, []);

  const dismiss = useCallback(() => {
    setFading(true);
    document.body.style.overflow = '';
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    // Wait for fade animation
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Esc to skip
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  // Auto-dismiss when video ends
  const handleEnded = useCallback(() => {
    dismiss();
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      aria-modal="true"
      role="dialog"
      aria-label={cs ? 'ZION Intro' : 'ZION Intro'}
    >
      {/* Video — fullscreen cover */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
        className="absolute inset-0 h-full w-full object-cover"
        preload="auto"
      >
        <source src="/zion-intro.webm" type="video/webm" />
        <source src="/zion-intro.mp4" type="video/mp4" />
      </video>

      {/* Vignette overlay for readability */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Skip button — bottom right */}
      <button
        onClick={dismiss}
        className="absolute bottom-6 right-6 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-sm transition-all hover:border-zion-gold/60 hover:bg-black/70 hover:text-zion-gold"
        aria-label={cs ? 'Přeskočit intro' : 'Skip intro'}
      >
        <span>{cs ? 'Přeskočit' : 'Skip'}</span>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 4l10 8-10 8V4z" fill="currentColor" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </button>

      {/* Progress bar — bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-zion-gold via-amber-400 to-zion-gold transition-all"
          style={{
            animation: 'intro-progress 33.32s linear forwards',
          }}
        />
      </div>

      <style>{`
        @keyframes intro-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
