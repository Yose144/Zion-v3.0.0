import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { fmtNumber, t } from '@zion/i18n';
import { api } from '@/core/api';
import { manifest } from './manifest';

const FLOWERS_PER_ZION = 1_000_000;

interface DaoStats {
  active?: number;
  active_proposals?: number;
  awaiting_tally?: number;
  executed?: number;
  failed?: number;
  circulating_supply?: number;
  governable_parameters?: string[];
}

interface Guardian {
  address: string;
  name: string;
}

interface Proposal {
  id: string;
  title?: string;
  status?: string;
}

export default async function DaoPortal({ locale }: { locale: Locale }) {
  const [stats, guardians, proposals] = await Promise.all([
    api.tryRead<{ data: DaoStats }>(readSpec(manifest, 'stats')),
    api.tryRead<{ data: { guardians: Guardian[] } }>(readSpec(manifest, 'guardians')),
    api.tryRead<{ data: { proposals: Proposal[]; total: number } }>(readSpec(manifest, 'proposals')),
  ]);

  if (!stats?.data) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

  const guardianList = guardians?.data?.guardians ?? [];
  const proposalList = proposals?.data?.proposals ?? [];

  return (
    <>
      <div className="k-stats">
        <Stat label={t(locale, 'proposals')} value={fmtNumber(locale, stats.data.active_proposals ?? 0)} />
        <Stat label={t(locale, 'guardians')} value={fmtNumber(locale, guardianList.length)} />
        <Stat
          label={t(locale, 'circulatingSupply')}
          value={fmtNumber(locale, (stats.data.circulating_supply ?? 0) / FLOWERS_PER_ZION)}
          unit="ZION"
        />
        <Stat label="executed" value={fmtNumber(locale, stats.data.executed ?? 0)} />
      </div>

      {guardianList.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 22 }}>
            <h2 className="k-section-title">{t(locale, 'guardians')}</h2>
          </div>
          <div className="k-grid">
            {guardianList.map((guardian) => (
              <article key={guardian.address} className="k-card">
                <div className="k-card-title">{guardian.name}</div>
                <p className="k-code">{guardian.address}</p>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="k-stage-head" style={{ marginTop: 26 }}>
        <h2 className="k-section-title">{t(locale, 'proposals')}</h2>
      </div>

      {proposalList.length === 0 ? (
        <div className="k-empty">{t(locale, 'noData')}</div>
      ) : (
        <div className="k-grid">
          {proposalList.map((proposal) => (
            <article key={proposal.id} className="k-card">
              <div className="k-card-title">{proposal.title ?? proposal.id}</div>
              <div className="k-meta">
                <span className="k-badge" data-tone={proposal.status === 'active' ? 'live' : 'soon'}>
                  {proposal.status ?? '—'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="k-stat">
      <div className="k-stat-label">{label}</div>
      <div className="k-stat-value">
        {value}
        {unit ? <span className="k-stat-unit">{unit}</span> : null}
      </div>
    </div>
  );
}
