'use client';

import { Lock } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import { MARKET_LOCKED } from '@/lib/market-lock';

/**
 * "Artifact marketplace opens with OASIS" banner — used on the homepage
 * below the HIRAN panel and inside the item page price card while
 * MARKET_LOCKED is on.
 */
export default function MarketLockedNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useLangT();
  if (!MARKET_LOCKED) return null;
  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-rasta-gold/10 border border-rasta-gold/30 p-4">
        <Lock className="w-5 h-5 text-rasta-gold shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-rasta-gold">{t('marketLock.title')}</div>
          <div className="text-xs text-gray-400 mt-0.5">{t('marketLock.desc')}</div>
        </div>
      </div>
    );
  }
  return (
    <section>
      <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-14 h-14 shrink-0 rounded-xl bg-rasta-gold/10 border border-rasta-gold/25 flex items-center justify-center">
            <Lock className="w-7 h-7 text-rasta-gold" />
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-rasta-gold/15 border border-rasta-gold/30 px-3 py-1 text-[11px] font-bold text-rasta-gold uppercase tracking-wider mb-2">
              {t('marketLock.badge')}
            </div>
            <h3 className="font-bold text-white text-lg md:text-xl font-display">
              {t('marketLock.title')}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed mt-1 max-w-2xl">
              {t('marketLock.desc')}
            </p>
          </div>
          <a
            href="https://oasis.zionterranova.com"
            target="_blank"
            rel="noreferrer"
            className="rasta-hero-btn rasta-hero-btn-primary shrink-0 self-start md:self-center"
          >
            {t('marketLock.ctaOasis')}
          </a>
        </div>
      </div>
    </section>
  );
}
