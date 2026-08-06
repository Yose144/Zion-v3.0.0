'use client';

import { ExternalLink, MessageCircle } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

export default function CtaSection() {
  const { t } = useLangT();
  return (
    <section className="rasta-cta-banner">
      <h2 className="text-2xl md:text-3xl font-black mb-4 font-display rasta-heading">
        {t('cta.title')}
      </h2>
      <p className="text-gray-300 max-w-xl mx-auto mb-8 leading-relaxed relative z-10">
        {t('cta.description')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
        <a href="https://oasis.zionterranova.com" className="rasta-hero-btn rasta-hero-btn-primary group">
          {t('cta.ctaOasis')}
          <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
        <a href="https://discord.gg/uq4Az97hG" className="rasta-hero-btn rasta-hero-btn-ghost inline-flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          {t('cta.ctaDiscord')}
        </a>
      </div>
    </section>
  );
}
