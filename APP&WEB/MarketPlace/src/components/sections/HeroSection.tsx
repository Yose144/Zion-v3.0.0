'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function HeroSection() {
  const { t } = useLangT();
  return (
    <section className="rasta-hero" aria-label="Hero">
      <div className="rasta-hero-inner">
        <div className="rasta-hero-kicker">
          <span className="dot" />
          {t('hero.kicker')}
        </div>
        <h1 className="rasta-hero-title">
          {t('hero.title1')} {t('hero.title2')}
        </h1>
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
