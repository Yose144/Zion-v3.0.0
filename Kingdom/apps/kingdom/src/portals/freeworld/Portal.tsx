import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { fmtNumber, t } from '@zion/i18n';
import { api } from '@/core/api';
import { manifest } from './manifest';

/* Služba ukládá flowers; UI mluví v ZIONech (1 ZION = 1e6 flowers). */
const FLOWERS_PER_ZION = 1_000_000;

interface FundBalance {
  total_accumulated?: number;
  total_disbursed?: number;
  last_block_height?: number;
}

interface Grant {
  id: string;
  title: string;
  applicant_name: string | null;
  amount_zion: number;
  status: string;
  category: string;
}

interface Project {
  id: string;
  name: string;
  category: string;
  status: string;
  budget_zion: number;
  spent_zion?: number | null;
  location?: string | null;
}

interface Envelope<T> {
  data: T;
}

export default async function FreeWorldPortal({ locale }: { locale: Locale }) {
  const [fund, grants, projects] = await Promise.all([
    api.tryRead<Envelope<FundBalance>>(readSpec(manifest, 'fund')),
    api.tryRead<Envelope<Grant[]>>(readSpec(manifest, 'grants')),
    api.tryRead<Envelope<Project[]>>(readSpec(manifest, 'projects')),
  ]);

  if (!fund?.data) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

  const zion = (flowers: number) => fmtNumber(locale, flowers / FLOWERS_PER_ZION);
  const grantList = grants?.data ?? [];
  const projectList = projects?.data ?? [];

  return (
    <>
      <div className="k-stats">
        <Stat label={t(locale, 'accumulated')} value={zion(fund.data.total_accumulated ?? 0)} unit="ZION" />
        <Stat label={t(locale, 'disbursed')} value={zion(fund.data.total_disbursed ?? 0)} unit="ZION" />
        <Stat label={t(locale, 'lastBlock')} value={fmtNumber(locale, fund.data.last_block_height ?? 0)} />
        <Stat label={t(locale, 'grants')} value={fmtNumber(locale, grantList.length)} />
      </div>

      {grantList.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 22 }}>
            <h2 className="k-section-title">{t(locale, 'grants')}</h2>
          </div>
          <div className="k-grid">
            {grantList.slice(0, 6).map((grant) => (
              <article key={grant.id} className="k-card">
                <div className="k-card-title">{grant.title}</div>
                <p className="k-card-desc">{grant.applicant_name ?? grant.category}</p>
                <div className="k-meta">
                  <span>
                    {zion(grant.amount_zion)} ZION
                  </span>
                  <span className="k-badge" data-tone={grant.status === 'approved' ? 'live' : 'soon'}>
                    {grant.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {projectList.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 26 }}>
            <h2 className="k-section-title">{t(locale, 'projects')}</h2>
          </div>
          <div className="k-grid">
            {projectList.slice(0, 9).map((project) => (
              <article key={project.id} className="k-card">
                <div className="k-card-title">{project.name}</div>
                <p className="k-card-desc">
                  {project.location ?? project.category}
                </p>
                <div className="k-meta">
                  <span>
                    {t(locale, 'budget')} {zion(project.budget_zion)} ZION
                  </span>
                  <span className="k-badge" data-tone={project.status === 'completed' ? 'live' : 'soon'}>
                    {project.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
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
