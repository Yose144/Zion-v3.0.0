import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { fmtNumber, t } from '@zion/i18n';
import { api } from '@/core/api';
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

export default async function ChainPortal({ locale }: { locale: Locale }) {
  const stats = await api.tryRead<ChainStats>(readSpec(manifest, 'stats'));

  if (!stats) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

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
        <Stat
          label={t(locale, 'hashrate')}
          value={stats.network_hashrate_formatted ?? '—'}
        />
        <Stat
          label="Block time"
          value={stats.avg_block_time ? `${fmtNumber(locale, stats.avg_block_time, 1)} s` : '—'}
        />
      </div>

      <div className="k-card">
        <div className="k-card-title">Top block</div>
        <p className="k-code">{stats.top_block_hash || '—'}</p>
        <div className="k-meta">
          {stats.version ? <span>node {stats.version}</span> : null}
          <span>{stats.mainnet ? 'mainnet' : 'testnet'}</span>
          {stats.circulating_supply ? (
            <span>circulating {fmtNumber(locale, stats.circulating_supply / 1e6)} ZION</span>
          ) : null}
        </div>
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
