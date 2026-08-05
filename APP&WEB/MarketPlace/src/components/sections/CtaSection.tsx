'use client';

import { ExternalLink, MessageCircle } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function CtaSection() {
  const { t } = useLangT();
  return (
    <section className="zion-cta-banner">
      <h2 className="text-2xl md:text-3xl font-black mb-4 font-display">
        <span className="text-gradient-animated">{t('cta.title')}</span>
      </h2>
      <p className="text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
        {t('cta.description')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="https://oasis.zionterranova.com" className="zion-button-primary text-base px-7 py-3 group">
          {t('cta.ctaOasis')}
          <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
        <a href="https://discord.gg/uq4Az97hG" className="zion-button-secondary text-base px-7 py-3 inline-flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          {t('cta.ctaDiscord')}
        </a>
      </div>
    </section>
  );
}
