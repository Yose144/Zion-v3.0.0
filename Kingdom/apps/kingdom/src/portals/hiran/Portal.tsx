import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { t } from '@zion/i18n';
import { api } from '@/core/api';
import { manifest } from './manifest';

interface ChatProbe {
  available?: boolean;
  backend?: string;
  model?: string;
}

export default async function HiranPortal({ locale }: { locale: Locale }) {
  const probe = await api.tryRead<ChatProbe>(readSpec(manifest, 'probe'));

  return (
    <>
      <div className="k-stats">
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'available')}</div>
          <div className="k-stat-value">
            {probe?.available ? 'online' : 'offline'}
          </div>
        </div>
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'model')}</div>
          <div className="k-stat-value" style={{ fontSize: 15 }}>
            {probe?.model ?? '—'}
          </div>
        </div>
        <div className="k-stat">
          <div className="k-stat-label">backend</div>
          <div className="k-stat-value" style={{ fontSize: 15 }}>
            {probe?.backend ?? '—'}
          </div>
        </div>
      </div>

      <div className="k-empty" style={{ textAlign: 'left' }}>
        <strong>{t(locale, 'comingSoon')}</strong>
        <br />
        {locale === 'cs'
          ? 'Rozhovor s Hiranem je zápisová operace — otevírá se ve F4 spolu s podpisem session. Dnes Věž ukazuje jen stav inference.'
          : 'Talking to Hiran is a write operation — it opens in F4 together with session signing. Today the Tower shows inference status only.'}
      </div>
    </>
  );
}
