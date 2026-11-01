import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { t } from '@zion/i18n';
import { api } from '@/core/api';
import { HiranChat } from '@/core/hiran/HiranChat';
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
      <div className="k-stats" style={{ maxWidth: 720 }}>
        <div className="k-stat">
          {/* Probe měří gateway, ne model — ten může spát i když gateway běží.
              Proto „gateway", ne „online": UI neslibuje víc, než ví. */}
          <div className="k-stat-label">gateway</div>
          <div className="k-stat-value">{probe?.available ? 'up' : 'down'}</div>
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

      <div style={{ marginTop: 16 }}>
        <HiranChat locale={locale} />
      </div>

      <p className="k-sub" style={{ marginTop: 14, maxWidth: 640 }}>
        {locale === 'cs'
          ? 'Odpovědi jdou přes server Kingdomu — prohlížeč nemá žádný klíč ani interní adresu. Když inference uzel spí, Hiran to řekne místo chybové stránky.'
          : 'Answers are proxied through the Kingdom server — the browser holds no key and no internal address. When the inference node sleeps, Hiran says so instead of failing.'}
      </p>
    </>
  );
}
