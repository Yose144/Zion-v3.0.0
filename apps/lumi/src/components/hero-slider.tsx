'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_SLIDES } from '@/data/hero-slides';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { imageVariant } from '@/lib/images';
import { cn } from '@/lib/utils';

const INTERVAL_MS = 6500;
const SWIPE_PX = 48;

/**
 * Promo slider nad 3D sekcí. Snímky se střídají křížovým přechodem,
 * autoplay se pozastaví při hover/fokusu a u `prefers-reduced-motion`.
 * Na mobilu funguje swipe; šipky jsou jen od `sm` výš.
 */
export default function HeroSlider() {
  const { lang } = useLang();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const autoPlay = useRef(true);

  const count = HERO_SLIDES.length;
  const multi = count > 1;

  const go = useCallback(
    (delta: number) => setIndex((current) => (current + delta + count) % count),
    [count],
  );

  const goTo = useCallback((target: number) => setIndex(target), []);

  useEffect(() => {
    autoPlay.current = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!autoPlay.current || paused || !multi) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, count, multi]);

  return (
    <section
      className="relative aspect-[16/9] min-h-[360px] max-h-[72rem] overflow-hidden bg-ink"
      role="region"
      aria-roledescription="carousel"
      aria-label={pick(
        { cs: 'Vybrané momenty pro lampion', en: 'Selected moments for the lantern', de: 'Ausgewählte Momente für die Laterne' },
        lang,
      )}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(1);
        }
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        touchX.current = null;
        if (start === null) return;
        const dx = (event.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
      }}
    >
      {HERO_SLIDES.map((slide, i) => {
        const active = i === index;
        const src = slide.image;
        return (
          <div
            key={src}
            className={cn('absolute inset-0 transition-opacity duration-700 ease-out', active ? 'opacity-100' : 'opacity-0')}
            aria-hidden={!active}
            inert={!active}
          >
            <img
              src={src}
              srcSet={`${imageVariant(src, 640)} 640w, ${imageVariant(src, 1280)} 1280w, ${src} ${slide.width}w`}
              sizes="100vw"
              alt={pick(slide.alt, lang)}
              width={slide.width}
              height={slide.height}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : undefined}
              decoding="async"
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain 2xl:object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5" />
            <div className="container-lumi absolute inset-x-0 bottom-0 flex h-full items-end pb-12 sm:pb-16">
              <div className="max-w-xl text-parchment">
                <p className="eyebrow text-amber-300">{pick(slide.kicker, lang)}</p>
                <h2 className="h2 mt-3 text-balance text-parchment">{pick(slide.title, lang)}</h2>
                {slide.lead ? (
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-parchment/75 sm:text-base">
                    {pick(slide.lead, lang)}
                  </p>
                ) : null}
                <Link href={slide.href} className="btn-amber mt-6">
                  {pick(slide.cta, lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        );
      })}

      {multi && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={pick({ cs: 'Předchozí snímek', en: 'Previous slide', de: 'Vorheriges Bild' }, lang)}
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-parchment/25 bg-ink/35 text-parchment backdrop-blur transition-colors hover:bg-ink/60 sm:flex lg:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={pick({ cs: 'Další snímek', en: 'Next slide', de: 'Nächstes Bild' }, lang)}
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-parchment/25 bg-ink/35 text-parchment backdrop-blur transition-colors hover:bg-ink/60 sm:flex lg:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div
            className="absolute bottom-5 right-5 flex items-center gap-2 sm:right-8 sm:bottom-7"
            role="group"
            aria-label={pick({ cs: 'Vybrat snímek', en: 'Choose slide', de: 'Bild wählen' }, lang)}
          >
            {HERO_SLIDES.map((slide, i) => (
              <button
                key={slide.image}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${pick({ cs: 'Snímek', en: 'Slide', de: 'Bild' }, lang)} ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === index ? 'w-7 bg-amber-400' : 'w-2 bg-parchment/45 hover:bg-parchment/75',
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
