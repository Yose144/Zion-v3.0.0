'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
    href: '/news',
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
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (paused || reducedMotion.current) return;
    const id = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused]);

  const go = (i: number) => setActive(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);

  return (
    <div
      className="relative z-10 mt-10 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_24px_80px_rgba(0,0,0,0.45)] group/slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* slides — všechny namountované, crossfade přes opacity */}
      <div className="relative aspect-[16/9] w-full">
        {SLIDES.map((slide, i) => (
          <motion.div
            key={slide.src}
            initial={false}
            animate={{ opacity: i === active ? 1 : 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0"
            aria-hidden={i !== active}
          >
            <img
              src={slide.src}
              srcSet={`${slide.srcM} 960w, ${slide.src} 1672w`}
              sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
              alt={slide.alt[cs ? 'cs' : 'en']}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </motion.div>
        ))}
      </div>

      {/* caption — aktuální slajd jako odkaz */}
      <Link
        href={SLIDES[active].href}
        className="absolute left-3 bottom-3 sm:left-4 sm:bottom-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 backdrop-blur-md px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white/90 transition-colors hover:border-zion-gold/50 hover:text-zion-gold"
      >
        <motion.span
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2"
        >
          {SLIDES[active].label[cs ? 'cs' : 'en']}
          <ArrowRight className="h-3.5 w-3.5 opacity-60" />
        </motion.span>
      </Link>

      {/* arrows */}
      <button
        type="button"
        onClick={() => go(active - 1)}
        aria-label={cs ? 'Předchozí obrázek' : 'Previous slide'}
        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 opacity-0 backdrop-blur-sm transition-all hover:border-zion-gold/50 hover:text-zion-gold group-hover/slider:opacity-100 focus-visible:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => go(active + 1)}
        aria-label={cs ? 'Další obrázek' : 'Next slide'}
        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 opacity-0 backdrop-blur-sm transition-all hover:border-zion-gold/50 hover:text-zion-gold group-hover/slider:opacity-100 focus-visible:opacity-100"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* dots */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center gap-1.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => go(i)}
            aria-label={`${cs ? 'Slajd' : 'Slide'} ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active
                ? 'w-6 bg-zion-gold'
                : 'w-1.5 bg-white/35 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
