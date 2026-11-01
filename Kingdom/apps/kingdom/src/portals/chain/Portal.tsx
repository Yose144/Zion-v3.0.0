import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { fmtNumber, t } from '@zion/i18n';
import { api, EXTERNAL } from '@/core/api';
import { manifest } from './manifest';

interface ChainStats {
  block_height?: number;
  difficulty?: number;
  total_connections?: number;
  tx_pool_size?: number;
  network_hashrate_formatted?: string;
  avg_block_time?: number;
  target_block_time?: number;
  circulating_supply?: number;
  top_block_hash?: string;
  version?: string;
  mainnet?: boolean;
}

interface Block {
  height: number;
  hash: string;
  timestamp?: number;
  transactions?: number;
  num_txes?: number;
  miner?: string;
}

interface Tx {
  tx_hash: string;
  type?: string;
  from?: string;
  to?: string;
  amount?: number;
  block_height?: number;
  timestamp?: number;
}

interface TransactionsPayload {
  transactions?: Tx[];
  total_tx_count?: number;
}

interface AddressInfo {
  address?: string;
  known_label?: string | null;
  known_type?: string | null;
  balance?: { total?: number; utxo_count?: number; pool_pending?: number };
  total_received?: number;
  total_sent?: number;
}

/** `zion1abcd…wxyz` — do seznamu stačí konce, celá adresa patří do eXploreru. */
function shortAddress(value: string | undefined): string {
  if (!value) return '—';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/** Relativní čas z unixové značky (sekundy). */
function ago(locale: Locale, timestamp: number | undefined): string {
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return locale === 'cs' ? `${seconds} s` : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === 'cs' ? `${minutes} min` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return locale === 'cs' ? `${hours} h` : `${hours}h`;
}

export default async function ChainPortal({
  locale,
  search,
}: {
  locale: Locale;
  search?: Record<string, string | string[] | undefined>;
}) {
  const rawAddress = typeof search?.addr === 'string' ? search.addr.trim() : '';
  /* Základ cesty je v manifestu, konkrétní adresa je vstup od člověka. */
  const addressSpec = rawAddress
    ? { ...readSpec(manifest, 'address'), path: `${readSpec(manifest, 'address').path}?addr=${encodeURIComponent(rawAddress)}` }
    : null;

  const [stats, blocks, transactions, account] = await Promise.all([
    api.tryRead<ChainStats>(readSpec(manifest, 'stats')),
    api.tryRead<Block[]>(readSpec(manifest, 'blocks')),
    api.tryRead<TransactionsPayload>(readSpec(manifest, 'transactions')),
    addressSpec ? api.tryRead<AddressInfo>(addressSpec) : Promise.resolve(null),
  ]);

  if (!stats) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

  const blockList = (blocks ?? []).slice(0, 8);
  const txList = (transactions?.transactions ?? []).slice(0, 8);

  return (
    <>
      <div className="k-stats">
        <Stat label={t(locale, 'height')} value={fmtNumber(locale, stats.block_height ?? 0)} />
        <Stat label={t(locale, 'difficulty')} value={fmtNumber(locale, stats.difficulty ?? 0)} />
        <Stat
          label={t(locale, 'peers')}
          value={fmtNumber(locale, stats.total_connections ?? 0)}
        />
        <Stat label={t(locale, 'mempool')} value={fmtNumber(locale, stats.tx_pool_size ?? 0)} />
        <Stat label={t(locale, 'hashrate')} value={stats.network_hashrate_formatted ?? '—'} />
        <Stat
          label="Block time"
          value={stats.avg_block_time ? `${fmtNumber(locale, stats.avg_block_time, 1)} s` : '—'}
        />
      </div>

      {/*
       * Hledání adresy (F5 P1). Formulář je `method="get"` — žádný klientský
       * stav, žádný fetch v portálu: server komponenta přečte `?addr=`,
       * doběhne přes @zion/api a vrátí hotové HTML.
       */}
      <form method="get" action="/portal/chain" className="k-card" style={{ marginTop: 18, gap: 10 }}>
        <div className="k-card-title">{t(locale, 'checkAddress')}</div>
        <div className="k-row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            name="addr"
            defaultValue={rawAddress}
            placeholder={t(locale, 'addressPlaceholder')}
            aria-label={t(locale, 'checkAddress')}
            className="k-input"
            style={{ flex: '1 1 320px', fontFamily: 'var(--k-mono, monospace)' }}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="k-btn">
            {t(locale, 'checkAddress')}
          </button>
        </div>
        <p className="k-sub" style={{ margin: 0 }}>
          {t(locale, 'addressHint')}
        </p>
      </form>

      {rawAddress ? (
        account ? (
          <div className="k-card" style={{ marginTop: 14 }}>
            <div className="k-card-title">
              {account.known_label ?? shortAddress(account.address ?? rawAddress)}
            </div>
            <div className="k-stats" style={{ marginTop: 10 }}>
              <Stat
                label={t(locale, 'balance')}
                value={`${fmtNumber(locale, account.balance?.total ?? 0, 4)} ZION`}
              />
              <Stat
                label={t(locale, 'received')}
                value={fmtNumber(locale, account.total_received ?? 0, 4)}
              />
              <Stat label={t(locale, 'sent')} value={fmtNumber(locale, account.total_sent ?? 0, 4)} />
              <Stat label={t(locale, 'utxo')} value={fmtNumber(locale, account.balance?.utxo_count ?? 0)} />
              {account.balance?.pool_pending ? (
                <Stat
                  label={t(locale, 'pending')}
                  value={fmtNumber(locale, account.balance.pool_pending, 4)}
                />
              ) : null}
            </div>
            <p style={{ marginTop: 10 }}>
              <a
                href={`${EXTERNAL.explorer}/address?addr=${encodeURIComponent(account.address ?? rawAddress)}`}
                target="_blank"
                rel="noreferrer"
                className="k-sub"
              >
                {t(locale, 'openExplorer')} →
              </a>
            </p>
          </div>
        ) : (
          <div className="k-empty" style={{ marginTop: 14 }}>
            {t(locale, 'noData')}
          </div>
        )
      ) : null}

      {blockList.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 24 }}>
            <h2 className="k-section-title">{t(locale, 'blocks')}</h2>
          </div>
          <div className="k-grid">
            {blockList.map((block) => (
              <a
                key={block.height}
                className="k-card"
                data-link="true"
                href={`${EXTERNAL.explorer}/block?id=${block.height}`}
                target="_blank"
                rel="noreferrer"
              >
                <div className="k-card-title">
                  {t(locale, 'block')} {fmtNumber(locale, block.height)}
                </div>
                <div className="k-meta">
                  <span>{ago(locale, block.timestamp)}</span>
                  <span>
                    {fmtNumber(locale, block.num_txes ?? block.transactions ?? 0)}{' '}
                    {t(locale, 'txs')}
                  </span>
                </div>
                <p className="k-code" style={{ marginTop: 6 }}>
                  {shortAddress(block.miner)}
                </p>
              </a>
            ))}
          </div>
        </>
      ) : null}

      {txList.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 26 }}>
            <h2 className="k-section-title">{t(locale, 'transactions')}</h2>
          </div>
          <div className="k-grid">
            {txList.map((tx) => (
              <a
                key={tx.tx_hash}
                className="k-card"
                data-link="true"
                href={`${EXTERNAL.explorer}?tx=${tx.tx_hash}`}
                target="_blank"
                rel="noreferrer"
              >
                <div className="k-card-title">
                  {fmtNumber(locale, tx.amount ?? 0, 4)}
                  <span className="k-stat-unit">ZION</span>
                </div>
                <div className="k-meta">
                  <span className="k-badge" data-tone={tx.type === 'coinbase' ? 'live' : 'soon'}>
                    {tx.type ?? 'tx'}
                  </span>
                  <span>{ago(locale, tx.timestamp)}</span>
                </div>
                <p className="k-code" style={{ marginTop: 6 }}>
                  {shortAddress(tx.from)} → {shortAddress((tx.to ?? '').split(',')[0])}
                </p>
              </a>
            ))}
          </div>
        </>
      ) : null}

      {/*
       * F5 parita: eXplorer zůstává plnohodnotný povrch (adresy, historie, richlist).
       * Portál drží okno — neslibuje, že nahradí archiv.
       */}
      <div className="k-card" style={{ marginTop: 26, maxWidth: 640 }}>
        <div className="k-card-title">{t(locale, 'openExplorer')}</div>
        <p className="k-card-desc">{t(locale, 'explorerNote')}</p>
        <a
          className="k-btn"
          href={EXTERNAL.explorer}
          target="_blank"
          rel="noreferrer"
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          {t(locale, 'openExplorer')} →
        </a>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="k-stat">
      <div className="k-stat-label">{label}</div>
      <div className="k-stat-value">{value}</div>
    </div>
  );
}
