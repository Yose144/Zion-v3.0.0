'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import styles from './HeroSection.module.css';

export default function HeroSection() {
  const { t } = useLangT();
  return (
    <section className={styles.workshop} aria-labelledby="market-home-title">
      <img
        className={styles.art}
        src="/images/design-v1/lumi-vanocni-kralovstvi-srdce.webp"
        srcSet="/images/design-v1/lumi-vanocni-kralovstvi-srdce-m.webp 960w, /images/design-v1/lumi-vanocni-kralovstvi-srdce.webp 1600w"
        sizes="(max-width: 1152px) calc(100vw - 2rem), 1120px"
        width={1600}
        height={900}
        alt={t('hero.artAlt')}
        fetchPriority="high"
        decoding="async"
      />
      <div className={styles.actions}>
        <div className="rasta-hero-kicker">
          <span className="dot" />
          {t('hero.kicker')}
        </div>
        <h1 id="market-home-title" className={styles.title}>ZION Market</h1>
        <p className={styles.description}>{t('hero.description')}</p>
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
