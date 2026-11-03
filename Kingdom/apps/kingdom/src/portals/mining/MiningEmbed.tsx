'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';

/**
 * Mining — povrch desktop klienta. Agent UI (`src/ui/index.html`, kompletní
 * ZION Miner dashboard) se servíruje v embedded bundlu jako `/agent/` a
 * renderuje se v iframu; jeho `electronAPI` přichází přes preload do
 * subframu — klíče a mining zůstávají v main procesu.
 *
 * V prohlížeči `window.zion` chybí → fallback s textem o klientovi.
 */
export function MiningEmbed({ locale }: { locale: Locale }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(typeof window !== 'undefined' && !!window.zion);
  }, []);

  if (!isClient) {
    return (
      <div className="k-card" style={{ maxWidth: 640 }}>
        <div className="k-card-title">Mining</div>
        <p className="k-sub" style={{ marginTop: 8 }}>{t(locale, 'miningClientOnly')}</p>
      </div>
    );
  }

  return (
    <iframe
      src="/agent/index.html"
      title="ZION Miner"
      style={{
        width: '100%',
        height: 'calc(100vh - 170px)',
        minHeight: 560,
        border: '1px solid var(--k-line)',
        borderRadius: 14,
        background: '#0d0d0d',
      }}
    />
  );
}
