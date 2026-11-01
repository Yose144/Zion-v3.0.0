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

export default async function ChainPortal({ locale }: { locale: Locale }) {
  const [stats, blocks, transactions] = await Promise.all([
    api.tryRead<ChainStats>(readSpec(manifest, 'stats')),
    api.tryRead<Block[]>(readSpec(manifest, 'blocks')),
    api.tryRead<TransactionsPayload>(readSpec(manifest, 'transactions')),
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
