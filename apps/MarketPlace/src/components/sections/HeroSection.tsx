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
        src="/images/design-v1/carpenter-workshop.webp?v=engine-v1"
        srcSet="/images/design-v1/carpenter-workshop-m.webp 960w, /images/design-v1/carpenter-workshop.webp 1672w"
        sizes="(max-width: 1152px) calc(100vw - 2rem), 1120px"
        width={1672}
        height={941}
        alt=""
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
        <div className={styles.signature}>
          <img
            className={styles.heritage}
            src="/images/design-v1/evoluzion-2008.jpeg"
            width={719}
            height={281}
            alt="evoluZion · 2008"
            loading="lazy"
            decoding="async"
          />
          <img
            className={styles.whale}
            src="/images/design-v1/keporkak-original.png"
            width={800}
            height={500}
            alt="Omnity.One"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
