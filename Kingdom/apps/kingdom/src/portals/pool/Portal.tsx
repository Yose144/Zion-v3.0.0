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

interface HistorySample {
  ts: number;
  accepted?: number;
  rejected?: number;
  hashrate?: number;
  miners_online?: number;
}

interface HistoryPayload {
  interval_s?: number;
  samples?: HistorySample[];
}

interface Payout {
  address: string;
  coin?: string;
  amount_flowers?: number;
  status?: string;
  confirmed?: boolean;
  confirmations?: number;
  height?: number;
  ts?: number | null;
}

interface CoinBlockStats {
  luck_100?: number;
  luck_500?: number;
  found?: number;
  confirmed?: number;
  orphaned?: number;
  pending?: number;
}

interface CoinStats {
  blocks?: CoinBlockStats;
  payouts_24h?: string;
}

interface FoundBlock {
  height?: number;
  hash?: string;
  miner?: string;
  luck_pct?: number;
  status?: string;
  ts?: number;
}

interface BlocksPayload {
  blocks?: FoundBlock[];
}

interface PayoutsPayload {
  payouts?: Payout[];
}

interface MinerWorker {
  name?: string;
  accepted?: number;
  rejected?: number;
  hashrate?: number;
}

interface MinerDetail {
  wallet?: string;
  coin?: string;
  active?: boolean;
  unpaid?: string;
  unpaid_unit?: string;
  est_daily?: number;
  window_share?: number;
  worker_count?: number;
  shares?: { accepted?: number; rejected?: number };
  workers?: MinerWorker[];
}

/** flowers = 1e6 jednotek mince (tak to pool hlásí u všech coinů). */
const FLOWERS = 1_000_000;

/**
 * Jméno workera z poolu je tečkovaná cesta
 * (`adresa.worker.adresa.worker.gpu0`) — do karty stačí poslední dva úseky.
 */
/** `zion1abcd…wxyz` — do seznamu stačí konce, celá adresa patří do eXploreru. */
function shortAddress(value: string | undefined): string {
  if (!value) return '—';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/** Relativní čas z unixové značky (sekundy). */
function agoSeconds(locale: Locale, timestamp: number | undefined): string {
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return locale === 'cs' ? `${seconds} s` : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === 'cs' ? `${minutes} min` : `${minutes}m`;
  return locale === 'cs' ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)}h`;
}

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

export default async function PoolPortal({
  locale,
  search,
}: {
  locale: Locale;
  search?: Record<string, string | string[] | undefined>;
}) {
  const rawWallet = typeof search?.miner === 'string' ? search.miner.trim() : '';
  /* Základ cesty je v manifestu, peněženka je vstup od člověka. */
  const minerSpec = rawWallet
    ? { ...readSpec(manifest, 'miner'), path: `${readSpec(manifest, 'miner').path}/${encodeURIComponent(rawWallet)}` }
    : null;

  const [payload, minersPayload, historyPayload, payoutsPayload, coinStats, blocksPayload, minerDetail] =
    await Promise.all([
      api.tryRead<CoinsPayload>(readSpec(manifest, 'coins')),
      api.tryRead<MinersPayload>(readSpec(manifest, 'miners')),
      api.tryRead<HistoryPayload>(readSpec(manifest, 'history')),
      api.tryRead<PayoutsPayload>(readSpec(manifest, 'payouts')),
      api.tryRead<CoinStats>(readSpec(manifest, 'coinStats')),
      api.tryRead<BlocksPayload>(readSpec(manifest, 'blocks')),
      minerSpec ? api.tryRead<MinerDetail>(minerSpec) : Promise.resolve(null),
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

  /* Historie: posledních 60 vzorků (typicky hodina při 60s intervalu). */
  const interval = historyPayload?.interval_s ?? 60;
  const windowSize = Math.max(1, Math.round(3600 / interval));
  const historySamples = (historyPayload?.samples ?? []).slice(-windowSize);
  const historyMax = historySamples.reduce((max, sample) => Math.max(max, sample.hashrate ?? 0), 0);
  const historyLast = historySamples[historySamples.length - 1];
  const historyAccepted = historySamples.reduce((sum, sample) => sum + (sample.accepted ?? 0), 0);
  const payouts = (payoutsPayload?.payouts ?? []).slice(0, 12);
  const foundBlocks = (blocksPayload?.blocks ?? []).slice(0, 8);

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
       * P3: štěstí a nalezené bloky. `coins/zion/stats` je agregace (luck 100/500,
       * počty bloků, výplaty za 24 h), `blocks` jsou konkrétní bloky.
       * Obojí čtení, cache 60 s — pool to počítá z ledgeru, ne z RPC.
       */}
      {coinStats?.blocks || foundBlocks.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 26 }}>
            <h2 className="k-section-title">{t(locale, 'foundBlocks')}</h2>
          </div>

          {coinStats?.blocks ? (
            <div className="k-stats" style={{ marginBottom: 12 }}>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'luck')} 100</div>
                <div className="k-stat-value">
                  {fmtNumber(locale, coinStats.blocks.luck_100 ?? 0, 1)}
                  <span className="k-stat-unit">%</span>
                </div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'luck')} 500</div>
                <div className="k-stat-value">
                  {fmtNumber(locale, coinStats.blocks.luck_500 ?? 0, 1)}
                  <span className="k-stat-unit">%</span>
                </div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'foundBlocks')}</div>
                <div className="k-stat-value">{fmtNumber(locale, coinStats.blocks.found ?? 0)}</div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'confirmedBlocks')}</div>
                <div className="k-stat-value">{fmtNumber(locale, coinStats.blocks.confirmed ?? 0)}</div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'orphanedBlocks')}</div>
                <div className="k-stat-value">{fmtNumber(locale, coinStats.blocks.orphaned ?? 0)}</div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'payouts24h')}</div>
                <div className="k-stat-value">
                  {fmtNumber(locale, Number(coinStats.payouts_24h ?? 0) / FLOWERS)}
                  <span className="k-stat-unit">ZION</span>
                </div>
              </div>
            </div>
          ) : null}

          {foundBlocks.length > 0 ? (
            <div className="k-grid">
              {foundBlocks.map((block) => (
                <article key={`${block.height}-${block.hash}`} className="k-card">
                  <div className="k-card-title">
                    {t(locale, 'block')} {fmtNumber(locale, block.height ?? 0)}
                  </div>
                  <div className="k-meta">
                    <span
                      className="k-badge"
                      data-tone={block.status === 'confirmed' ? 'live' : 'soon'}
                    >
                      {block.status ?? '—'}
                    </span>
                    <span>
                      {t(locale, 'luck')}: {fmtNumber(locale, block.luck_pct ?? 0, 1)} %
                    </span>
                    <span>{agoSeconds(locale, block.ts)}</span>
                  </div>
                  <p className="k-code" style={{ marginTop: 6 }}>
                    {shortAddress(block.miner)}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {/*
       * Hledání těžaře (F5 P2). Stejný vzorec jako adresa v Řetězu: GET formulář,
       * server čte `?miner=`, žádný klientský stav, žádný fetch v portálu.
       */}
      <form method="get" action="/portal/pool" className="k-card" style={{ marginTop: 26, gap: 10 }}>
        <div className="k-card-title">{t(locale, 'lookupMiner')}</div>
        <div className="k-row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            name="miner"
            defaultValue={rawWallet}
            placeholder={t(locale, 'minerPlaceholder')}
            aria-label={t(locale, 'lookupMiner')}
            className="k-input"
            style={{ flex: '1 1 320px', fontFamily: 'var(--k-mono, monospace)' }}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="k-btn">
            {t(locale, 'lookupMiner')}
          </button>
        </div>
        <p className="k-sub" style={{ margin: 0 }}>
          {t(locale, 'minerHint')}
        </p>
      </form>

      {rawWallet ? (
        minerDetail ? (
          <div className="k-card" style={{ marginTop: 14 }}>
            <div className="k-card-title">{shortAddress(minerDetail.wallet ?? rawWallet)}</div>
            <div className="k-stats" style={{ marginTop: 10 }}>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'unpaid')}</div>
                <div className="k-stat-value">
                  {fmtNumber(locale, Number(minerDetail.unpaid ?? 0) / FLOWERS, 4)}
                  <span className="k-stat-unit">{(minerDetail.coin ?? '').toUpperCase()}</span>
                </div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'estDaily')}</div>
                <div className="k-stat-value">
                  {fmtNumber(locale, (minerDetail.est_daily ?? 0) / FLOWERS, 4)}
                </div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'windowShare')}</div>
                <div className="k-stat-value">
                  {fmtNumber(locale, (minerDetail.window_share ?? 0) * 100, 2)}
                  <span className="k-stat-unit">%</span>
                </div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'acceptRate')}</div>
                <div className="k-stat-value">
                  {(() => {
                    const ok = minerDetail.shares?.accepted ?? 0;
                    const bad = minerDetail.shares?.rejected ?? 0;
                    return ok + bad > 0 ? `${fmtNumber(locale, (ok / (ok + bad)) * 100, 1)} %` : '—';
                  })()}
                </div>
              </div>
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'workers')}</div>
                <div className="k-stat-value">{fmtNumber(locale, minerDetail.worker_count ?? 0)}</div>
              </div>
            </div>
            {(minerDetail.workers ?? []).length > 0 ? (
              <div className="k-meta" style={{ marginTop: 10 }}>
                {(minerDetail.workers ?? []).map((worker) => (
                  <span key={worker.name} title={`${fmtNumber(locale, worker.accepted ?? 0)} shares`}>
                    {worker.name || '—'} · {fmtCompact(locale, worker.hashrate ?? 0)} H/s
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="k-empty" style={{ marginTop: 14 }}>
            {t(locale, 'noData')}
          </div>
        )
      ) : null}

      {payouts.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 26 }}>
            <h2 className="k-section-title">{t(locale, 'payouts')}</h2>
          </div>
          <div className="k-grid">
            {payouts.map((payout, index) => (
              <article key={`${payout.address}-${payout.height}-${index}`} className="k-card">
                <div className="k-card-title">
                  {fmtNumber(locale, (payout.amount_flowers ?? 0) / FLOWERS, 4)}
                  <span className="k-stat-unit">{(payout.coin ?? '').toUpperCase()}</span>
                </div>
                <div className="k-meta">
                  <span className="k-badge" data-tone={payout.confirmed ? 'live' : 'soon'}>
                    {payout.status ?? '—'}
                  </span>
                  {typeof payout.height === 'number' ? (
                    <span>
                      {t(locale, 'block')} {fmtNumber(locale, payout.height)}
                    </span>
                  ) : null}
                  <span>
                    {t(locale, 'confirmations')}: {fmtNumber(locale, payout.confirmations ?? 0)}
                  </span>
                </div>
                <p className="k-code" style={{ marginTop: 6 }}>
                  {shortAddress(payout.address)}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {historySamples.length > 1 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 26 }}>
            <h2 className="k-section-title">{t(locale, 'history')}</h2>
          </div>
          <div className="k-card">
            <div className="k-meta" style={{ marginBottom: 10 }}>
              <span>{t(locale, 'lastHour')}</span>
              <span>
                {historySamples.length} {t(locale, 'samples')} · {interval} s
              </span>
              <span>
                {fmtNumber(locale, historyAccepted)} shares
              </span>
              {historyLast?.miners_online !== undefined ? (
                <span>
                  {t(locale, 'miners')}: {fmtNumber(locale, historyLast.miners_online)}
                </span>
              ) : null}
            </div>
            {/*
             * Sloupcový pruh bez knihovny: výška = podíl na maximu okna.
             * Čísla jsou v `title`, takže se dají přečíst i bez hoveru v a11y.
             */}
            <div
              role="img"
              aria-label={`${t(locale, 'history')} — ${historySamples.length} ${t(locale, 'samples')}`}
              style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 68 }}
            >
              {historySamples.map((sample) => {
                const height = historyMax > 0 ? Math.max(2, ((sample.hashrate ?? 0) / historyMax) * 100) : 2;
                return (
                  <div
                    key={sample.ts}
                    title={`${new Date(sample.ts * 1000).toISOString().slice(11, 16)} · ${fmtCompact(locale, sample.hashrate ?? 0)} H/s · ${fmtNumber(locale, sample.accepted ?? 0)} shares`}
                    style={{
                      flex: 1,
                      height: `${height}%`,
                      background: 'var(--k-accent)',
                      opacity: 0.35 + 0.65 * (height / 100),
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </>
      ) : null}

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
