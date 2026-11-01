import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { fmtCompact, fmtNumber, t } from '@zion/i18n';
import { api, EXTERNAL } from '@/core/api';
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

interface MinerStream {
  hps_live?: number;
  valid_shares?: number;
  invalid_shares?: number;
  accept_rate?: number;
}

interface Miner {
  worker?: string;
  display_coin?: string;
  display_hps?: number;
  streams?: Record<string, MinerStream>;
}

interface MinersPayload {
  count?: number;
  miners?: Miner[];
}

/**
 * Jméno workera z poolu je tečkovaná cesta
 * (`adresa.worker.adresa.worker.gpu0`) — do karty stačí poslední dva úseky.
 */
function shortWorker(worker: string | undefined): string {
  const parts = (worker ?? '').split('.').filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.slice(-2).join(' · ');
}

/** Součet přijatých/odmítnutých share přes všechny streamy workera. */
function shareRatio(miner: Miner): { accepted: number; rate: number | null } {
  let accepted = 0;
  let invalid = 0;
  for (const stream of Object.values(miner.streams ?? {})) {
    accepted += stream.valid_shares ?? 0;
    invalid += stream.invalid_shares ?? 0;
  }
  const total = accepted + invalid;
  return { accepted, rate: total > 0 ? (accepted / total) * 100 : null };
}

export default async function PoolPortal({ locale }: { locale: Locale }) {
  const [payload, minersPayload] = await Promise.all([
    api.tryRead<CoinsPayload>(readSpec(manifest, 'coins')),
    api.tryRead<MinersPayload>(readSpec(manifest, 'miners')),
  ]);

  if (!payload?.coins?.length) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

  const coins = [...payload.coins].sort((a, b) => a.coin.localeCompare(b.coin));
  const connected = coins.filter((coin) => coin.legs.some((leg) => leg.connected)).length;

  /* Nejmocnější worker nahoře — pořadí je pro člověka, ne pro stroj. */
  const miners = [...(minersPayload?.miners ?? [])].sort(
    (a, b) => (b.display_hps ?? 0) - (a.display_hps ?? 0),
  );
  const poolHps = miners.reduce((sum, miner) => sum + (miner.display_hps ?? 0), 0);

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
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'miners')}</div>
          <div className="k-stat-value">{fmtNumber(locale, miners.length)}</div>
        </div>
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'hashrate')}</div>
          <div className="k-stat-value">
            {fmtCompact(locale, poolHps)}
            <span className="k-stat-unit">H/s</span>
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

      <div className="k-stage-head" style={{ marginTop: 26 }}>
        <h2 className="k-section-title">{t(locale, 'miners')}</h2>
      </div>

      {miners.length === 0 ? (
        <div className="k-empty">{t(locale, 'noData')}</div>
      ) : (
        <div className="k-grid">
          {miners.map((miner, index) => {
            const { accepted, rate } = shareRatio(miner);
            return (
              <article key={`${miner.worker ?? 'miner'}-${index}`} className="k-card">
                <div className="k-card-title">{shortWorker(miner.worker)}</div>
                <div className="k-meta">
                  <span className="k-badge" data-tone="live">
                    {(miner.display_coin ?? '—').toUpperCase()}
                  </span>
                  <span>
                    {fmtCompact(locale, miner.display_hps ?? 0)} H/s
                  </span>
                </div>
                <div className="k-meta">
                  <span>
                    {t(locale, 'acceptRate')}: {rate === null ? '—' : `${fmtNumber(locale, rate, 1)} %`}
                  </span>
                  <span>{fmtNumber(locale, accepted)} shares</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/*
       * Handoff (F4): ovládání poolu zůstává operátorovi. Kingdom umí jen číst —
       * tlačítko „restartuj pool“ v klientovi by bylo lhaní o oprávněních.
       */}
      <div className="k-card" style={{ marginTop: 26, maxWidth: 640 }}>
        <div className="k-card-title">{t(locale, 'openOps')}</div>
        <p className="k-card-desc">{t(locale, 'opsBehindLogin')}</p>
        <a
          className="k-btn"
          href={EXTERNAL.poolOps}
          target="_blank"
          rel="noreferrer"
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          {t(locale, 'openOps')} →
        </a>
      </div>
    </>
  );
}
