'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function HeroSection() {
  const { t } = useLangT();
  return (
    <section className="kralovstvi-hero" aria-label="Hero">
      {/* The art is a scene, no text overlay: the carpenter builds the ark,
          children with the lantern, the glowing tree and the heart lantern —
          Merry Christmas & Happy New Year 2027. */}
      <div
        className="kralovstvi-hero-art"
        role="img"
        aria-label="Veselé vánoce a šťastný nový rok — tesař u archy, děti s lucernou a zářící strom / Merry Christmas & Happy New Year 2027"
      />
      <div className="kralovstvi-hero-actions">
        <div className="rasta-hero-kicker">
          <span className="dot" />
          {t('hero.kicker')}
        </div>
        <p className="rasta-hero-desc">{t('hero.description')}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/explore"
            className="rasta-hero-btn rasta-hero-btn-primary group"
          >
            {t('hero.ctaPrimary')}
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/shop?category=books"
            className="rasta-hero-btn rasta-hero-btn-ghost"
          >
            {t('hero.ctaSecondary')}
          </Link>
        </div>
      </div>
    </section>
  );
}
