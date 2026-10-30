'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function HeroSection() {
  const { t } = useLangT();
  return (
    <section className="kralovstvi-hero" aria-label="Hero">
      {/* The art carries its own title band (Království Srdce · Nirvana ·
          Zion TerraNova · One Love) — rendered clean, no text overlay. */}
      <div
        className="kralovstvi-hero-art"
        role="img"
        aria-label="Království Srdce — Nirvana · Zion TerraNova · One Love"
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
            href="/create"
            className="rasta-hero-btn rasta-hero-btn-ghost"
          >
            {t('hero.ctaSecondary')}
          </Link>
        </div>
      </div>
    </section>
  );
}
