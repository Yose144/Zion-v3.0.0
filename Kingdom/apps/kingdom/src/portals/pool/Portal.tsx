import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { t } from '@zion/i18n';
import { api } from '@/core/api';
import { manifest } from './manifest';

interface Leg {
  id: string;
  kind: string;
  connected: boolean;
  enabled: boolean;
  job_age_ms?: number;
}

interface Coin {
  coin: string;
  fee_bps: number;
  payout_mode: string;
  legs: Leg[];
}

interface CoinsPayload {
  coins: Coin[];
}

export default async function PoolPortal({ locale }: { locale: Locale }) {
  const payload = await api.tryRead<CoinsPayload>(readSpec(manifest, 'coins'));

  if (!payload?.coins?.length) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

  const coins = [...payload.coins].sort((a, b) => a.coin.localeCompare(b.coin));
  const connected = coins.filter((coin) => coin.legs.some((leg) => leg.connected)).length;

  return (
    <>
      <div className="k-stats">
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'coins')}</div>
          <div className="k-stat-value">{coins.length}</div>
        </div>
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'connected')}</div>
          <div className="k-stat-value">
            {connected}
            <span className="k-stat-unit">/ {coins.length}</span>
          </div>
        </div>
      </div>

      <div className="k-grid">
        {coins.map((coin) => {
          const legs = coin.legs ?? [];
          const live = legs.some((leg) => leg.connected && leg.enabled);
          return (
            <div key={coin.coin} className="k-card">
              <div className="k-card-title">
                <span
                  className="k-rail-dot"
                  style={{ background: live ? 'var(--k-accent)' : 'var(--k-err)' }}
                />
                {coin.coin.toUpperCase()}
              </div>
              <div className="k-meta">
                <span>
                  {t(locale, 'payout')}: {coin.payout_mode}
                </span>
                <span>fee {coin.fee_bps / 100}%</span>
              </div>
              <div className="k-meta">
                {legs.map((leg) => (
                  <span key={leg.id} title={leg.id}>
                    {leg.kind === 'native' ? '◆' : '↥'} {leg.connected ? 'ok' : 'down'}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
