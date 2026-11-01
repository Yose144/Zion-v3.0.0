'use client';

import { type ReactNode } from 'react';
import { FileText, ShoppingBag } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import Link from 'next/link';

interface InfoPageProps {
  title?: string;
  /** Dot path into the translation dictionary, e.g. `info.termsTitle`. Wins over `title`. */
  titleKey?: string;
  subtitle?: string;
  /** Dot path into the translation dictionary, e.g. `info.termsSubtitle`. Wins over `subtitle`. */
  subtitleKey?: string;
  icon?: string;
  children: ReactNode;
  showToc?: boolean;
}

export default function InfoPage({
  title,
  titleKey,
  subtitle,
  subtitleKey,
  icon = '📄',
  children,
  showToc = false,
}: InfoPageProps) {
  const { t } = useLangT();
  const heading = titleKey ? t(titleKey) : title;
  const subheading = subtitleKey ? t(subtitleKey) : subtitle;

  return (
    <div className="rasta-info-page">
      {/* Hero */}
      <section className="rasta-info-hero">
        <div className="rasta-info-hero-inner">
          <span className="rasta-info-version-badge">
            <FileText className="w-4 h-4 inline-block mr-2" /> {t('info.kicker')}
          </span>
          <h1>{heading}</h1>
          {subheading && <p className="rasta-info-subtitle">{subheading}</p>}
        </div>
      </section>

      {/* Divider */}
      <div className="rasta-divider">
        <div className="line" />
        <span className="icon">{icon}</span>
        <div className="line" />
      </div>

      {/* Content */}
      <section className="rasta-info-section">
        <div className="rasta-info-content">
          {children}
        </div>

        {/* Bottom CTA */}
        <div className="rasta-info-cta">
          <div className="rasta-divider">
            <div className="line" />
            <span className="icon">🦁</span>
            <div className="line" />
          </div>
          <Link href="/shop" className="zion-button-primary">
            <ShoppingBag className="w-4 h-4" /> {t('shop.cta') || 'Zpět do obchodu'}
          </Link>
        </div>
      </section>
    </div>
  );
}
