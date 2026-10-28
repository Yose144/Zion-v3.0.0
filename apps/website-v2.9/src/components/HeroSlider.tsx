'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

interface Slide {
  src: string;
  srcM: string;
  alt: { cs: string; en: string };
  label: { cs: string; en: string };
  href: string;
}

const SLIDES: Slide[] = [
  {
    src: '/images/home/hero.webp',
    srcM: '/images/home/hero-m.webp',
    alt: {
      cs: 'Strom života, Maitreya a cesta, která pokračuje — One Love · One Human · One World',
      en: 'Tree of Life, Maitreya and the journey that continues — One Love · One Human · One World',
    },
    label: { cs: 'Maitreya · Strom života', en: 'Maitreya · Tree of Life' },
    href: '/zion-archive#cesta',
  },
  {
    src: '/images/zion-archive/hero.webp',
    srcM: '/images/zion-archive/hero-m.webp',
    alt: {
      cs: 'Oasis — jedna rodina pod Stromem života: Maitreya, Krišna, tesař a děti nové země',
      en: 'Oasis — one family under the Tree of Life: Maitreya, Krishna, the carpenter and the children of the new earth',
    },
    label: { cs: 'Oasis · jedna rodina', en: 'Oasis · one family' },
    href: '/l4-oasis',
  },
  {
    src: '/images/l5-free-world/hero.webp',
    srcM: '/images/l5-free-world/hero-m.webp',
    alt: {
      cs: 'Mapa L5 Free World — dvanáct ohňů rozesetých po planetě',
      en: 'L5 Free World map — twelve fires spread across the planet',
    },
    label: { cs: 'L5 Free World · dvanáct ohňů', en: 'L5 Free World · twelve fires' },
    href: '/l5-free-world',
  },
  {
    src: '/images/maria-del-camino/hero.webp',
    srcM: '/images/maria-del-camino/hero-m.webp',
    alt: {
      cs: 'Flotila Tres Marías — tři lodě pro tři oceány',
      en: 'Tres Marías fleet — three ships for three oceans',
    },
    label: { cs: 'María del Camino · Tres Marías', en: 'María del Camino · Tres Marías' },
    href: '/terranova/maria-del-camino',
  },
  {
    src: '/images/ekam/hero.webp',
    srcM: '/images/ekam/hero-m.webp',
    alt: {
      cs: 'Ekam Oneness Temple — uzel, který už stojí',
      en: 'Ekam Oneness Temple — the node that already stands',
    },
    label: { cs: 'Ekam · Oneness Temple', en: 'Ekam · Oneness Temple' },
    href: '/terranova/ekam',
  },
  {
    src: '/images/genesis-garden/hero.webp',
    srcM: '/images/genesis-garden/hero-m.webp',
    alt: {
      cs: 'Genesis Garden — první zahrada nového světa',
      en: 'Genesis Garden — the first garden of the new world',
    },
    label: { cs: 'Genesis Garden', en: 'Genesis Garden' },
    href: '/terranova/genesis',
  },
  {
    src: '/images/amenti/hero.webp',
    srcM: '/images/amenti/hero-m.webp',
    alt: {
      cs: 'Amenti · Gíza — zlaté vejce nad pyramidou, síň záznamů, dvanáctý uzel',
      en: 'Amenti · Giza — the golden egg above the pyramid, hall of records, twelfth node',
    },
    label: { cs: 'Amenti · Gíza', en: 'Amenti · Giza' },
    href: '/terranova/amenti',
  },
];

const AUTOPLAY_MS = 7000;

export default function HeroSlider() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  // displayed = what is on screen; pending loads the next image invisibly
  // and swaps only once it has actually decoded — never a blank frame.
  const [displayed, setDisplayed] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [intersecting, setIntersecting] = useState(false);
  const [prefersStatic, setPrefersStatic] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayedRef = useRef(0);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () =>
      setPrefersStatic(
        mq.matches ||
          !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
      );
    update();
    mq.addEventListener('change', update);
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mq.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // autoplay only while actually on screen
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setIntersecting(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const autoplayOn =
    !paused && !userPaused && !prefersStatic && intersecting && pageVisible;

  useEffect(() => {
    if (!autoplayOn) return;
    const id = setInterval(() => {
      if (pendingRef.current === null) goRef.current(displayedRef.current + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoplayOn]);

  const goRef = useRef<(i: number) => void>(() => {});
  goRef.current = (i: number) => {
    const next = ((i % SLIDES.length) + SLIDES.length) % SLIDES.length;
    if (next === displayed) { pendingToken.current = -1; pendingRef.current = null; setPending(null); return; }
    if (next === pending) return;
    pendingToken.current = next; // stale loads from earlier clicks lose
    pendingRef.current = next;
    setPending(next);
  };
  const go = (i: number) => goRef.current(i);

  const pendingToken = useRef(-1);
  // swap only once the requested image finished loading — never blank while loading
  const handleLoaded = (i: number) => {
    if (pendingToken.current !== i) return;
    pendingToken.current = -1;
    displayedRef.current = i;
    pendingRef.current = null;
    setDisplayed(i);
    setPending(null);
  };

  return (
    <div
      ref={rootRef}
      className="relative z-10 mt-10 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_24px_80px_rgba(0,0,0,0.45)] group/slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
    >
      {/* slides — only displayed + pending-next are mounted */}
      <div className="relative aspect-[16/9] w-full">
        {[displayed, ...(pending !== null ? [pending] : [])].map((i) => {
          const slide = SLIDES[i];
          const isLive = i === displayed;
          return (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-700 ${isLive ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden={!isLive}
            >
              <img
                src={slide.src}
                srcSet={`${slide.srcM} 960w, ${slide.src} 1672w`}
                sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
                alt={slide.alt[cs ? 'cs' : 'en']}
                loading={isLive && displayed === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="h-full w-full object-cover"
                onLoad={() => { if (!isLive) handleLoaded(i); }}
                onError={() => { if (!isLive && pendingToken.current === i) { pendingToken.current = -1; setPending(null); } }}
              />
            </div>
          );
        })}
      </div>

      {/* caption bar below the image — wraps instead of overlapping dots */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5 sm:px-4">
        <Link
          href={SLIDES[displayed].href}
          prefetch={false}
          className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-zion-gold/50 hover:text-zion-gold sm:text-sm"
        >
          <span className="min-w-0 whitespace-normal">{SLIDES[displayed].label[cs ? 'cs' : 'en']}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Link>
        <div className="flex items-center gap-3">
          {/* pause/resume */}
          <button
            type="button"
            onClick={() => setUserPaused((v) => !v)}
            aria-label={cs ? (userPaused ? 'Přehrát slideshow' : 'Pozastavit slideshow') : (userPaused ? 'Play slideshow' : 'Pause slideshow')}
            aria-pressed={userPaused}
            className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-white/70 transition-colors hover:border-zion-gold/40 hover:text-zion-gold"
          >
            {userPaused ? '▶' : '❚❚'}
          </button>
          {/* dots */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => go(i)}
                aria-label={`${cs ? 'Slajd' : 'Slide'} ${i + 1}`}
                className="flex h-[44px] items-center justify-center"
                style={{ minWidth: 32 }}
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === displayed ? 'w-6 bg-zion-gold' : 'w-1.5 bg-white/35 hover:bg-white/60'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* arrows */}
      <button
        type="button"
        onClick={() => go(displayed - 1)}
        aria-label={cs ? 'Předchozí obrázek' : 'Previous slide'}
        className="absolute left-2 top-[42%] z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 backdrop-blur-sm transition-all hover:border-zion-gold/50 hover:text-zion-gold sm:opacity-0 sm:group-hover/slider:opacity-100 sm:focus-visible:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => go(displayed + 1)}
        aria-label={cs ? 'Další obrázek' : 'Next slide'}
        className="absolute right-2 top-[42%] z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 backdrop-blur-sm transition-all hover:border-zion-gold/50 hover:text-zion-gold sm:opacity-0 sm:group-hover/slider:opacity-100 sm:focus-visible:opacity-100"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
