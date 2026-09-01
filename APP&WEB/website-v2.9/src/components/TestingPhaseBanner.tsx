'use client';

import { AlertTriangle } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import type { CSSProperties } from 'react';

interface TestingPhaseBannerProps {
  type: 'dex' | 'multichain';
  className?: string;
}

const bannerCopy = {
  dex: {
    title: { cs: 'ZionDEX — fáze testování', en: 'ZionDEX — Testing Phase' },
    body: {
      cs: 'DEX je v rané testovací fázi. Swapy, likvidita a kontrakty se teprve stabilizují. Používejte pouze malé částky a očekávejte změny.',
      en: 'The DEX is in an early testing phase. Swaps, liquidity, and contracts are still stabilizing. Use only small amounts and expect changes.',
    },
  },
  multichain: {
    title: { cs: 'Multichain — fáze testování', en: 'Multichain — Testing Phase' },
    body: {
      cs: 'Multichain služby, bridge a peněženka jsou v testovací fázi. Necostujte a neobchodujte víc, než si můžete dovolit ztratit.',
      en: 'Multichain services, bridge, and wallet are in a testing phase. Do not deposit or trade more than you can afford to lose.',
    },
  },
};

export default function TestingPhaseBanner({ type, className = '' }: TestingPhaseBannerProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const copy = bannerCopy[type];

  return (
    <div className={className}>
      <div
        className="zion-rainbow-card p-4 border-zion-gold/30 bg-zion-gold/10"
        style={{ '--rc': '252, 209, 22' } as CSSProperties }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-zion-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-200">
              {cs ? copy.title.cs : copy.title.en}
            </p>
            <p className="text-xs text-amber-200/70 mt-1">
              {cs ? copy.body.cs : copy.body.en}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
