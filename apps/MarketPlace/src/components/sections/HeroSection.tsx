'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function HeroSection() {
  const { t } = useLangT();
  return (
    <section className="kralovstvi-hero" aria-label="Hero">
      {/* Art nese vlastní text („Lumi · Království Srdce“), takže se přes něj
          nic nepřekládá: tesař, Lumi a Malý princ u rozsvícené lucerny
          v pobřežní dílně. Je to `<img>` (ne CSS pozadí), aby měl skutečné
          `width`/`height` — místo se rezervuje před načtením, obsah neskáče —
          a aby šel načíst prioritně. */}
      <img
        src="/hero-lumi-kralovstvi-srdce.webp"
        alt={t('hero.artAlt')}
        width={1672}
        height={941}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="kralovstvi-hero-art"
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
