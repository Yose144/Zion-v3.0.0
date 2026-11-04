'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function HeroSection() {
  const { t } = useLangT();
  return (
    <section className="kralovstvi-hero" aria-label="Hero">
      {/* Art nese vlastní text („Merry Christmas & Happy New Year 2027"),
          takže se přes něj nic nepřekládá: tesař u archy, děti s lucernou,
          zářící strom a srdcový lampion — vánoční kolekce 2027. */}
      <div
        className="kralovstvi-hero-art"
        role="img"
        aria-label="Vánoční kolekce 2027 — tesař u archy, děti s lucernou, zářící strom a srdcový lampion / Merry Christmas and a Happy New Year 2027"
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
