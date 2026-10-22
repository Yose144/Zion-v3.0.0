"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import LucideIcon from "./LucideIcon";

export interface Slide {
  src: string;
  alt: string;
  caption?: string;
}

interface ImageSliderProps {
  slides: Slide[];
  aspect?: string;
  objectFit?: "cover" | "contain";
  autoplay?: boolean;
  interval?: number;
  showDots?: boolean;
  className?: string;
}

export default function ImageSlider({
  slides,
  aspect = "aspect-[4/3]",
  objectFit = "contain",
  autoplay = false,
  interval = 5000,
  showDots = true,
  className = "",
}: ImageSliderProps) {
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const total = slides.length;

  const next = useCallback(
    () => setIndex((i) => (i + 1 >= total ? 0 : i + 1)),
    [total],
  );
  const prev = useCallback(
    () => setIndex((i) => (i - 1 < 0 ? total - 1 : i - 1)),
    [total],
  );

  // reset on slide list change (e.g. language switch)
  useEffect(() => {
    setIndex(0);
  }, [slides]);

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // autoplay
  useEffect(() => {
    if (!autoplay || total <= 1) return;
    const id = setInterval(next, interval);
    return () => clearInterval(id);
  }, [autoplay, interval, next, total]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) next();
      else prev();
    }
    setTouchStart(null);
  };

  if (total === 0) return null;

  return (
    <div
      className={`relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2 ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image gallery"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div
            key={`${s.src}-${i}`}
            className="w-full flex-shrink-0 p-2 text-center"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${total}`}
          >
            <div className={`relative mx-auto w-full overflow-hidden rounded-xl ${aspect}`}>
              <Image
                src={s.src}
                alt={s.alt}
                fill
                sizes="(max-width: 768px) 100vw, 576px"
                loading="eager"
                decoding="async"
                className={`rounded-xl ${objectFit === "cover" ? "object-cover" : "object-contain"}`}
                draggable={false}
              />
            </div>
            {s.caption && (
              <p className="mt-3 text-[#fcd116]">{s.caption}</p>
            )}
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-[#fcd116] shadow-lg transition hover:scale-110 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-[#fcd116]"
            aria-label="Previous slide"
            type="button"
          >
            <LucideIcon name="fa-chevron-left" size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-[#fcd116] shadow-lg transition hover:scale-110 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-[#fcd116]"
            aria-label="Next slide"
            type="button"
          >
            <LucideIcon name="fa-chevron-right" size={20} />
          </button>

          {showDots && (
            <div className="mt-4 flex justify-center gap-2 pb-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    i === index ? "bg-[#fcd116]" : "bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                  type="button"
                >
                  <span className="sr-only">{i + 1}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
