'use client';

/**
 * FreeWorldRegistry — live L5 project & grant registry.
 *
 * Reads `/api/free-world/projects` and `/api/free-world/grants` (polled
 * every 60s). Empty/offline states degrade gracefully — the static
 * community sections of the page remain the fallback narrative.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Briefcase, FileCheck2, MapPin, Tag } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { fwApi, type FwGrant, type FwProject } from '@/lib/freeworld-api';
import { formatZion } from './L5FundTracker';

const copy = {
  projectsTitle: { cs: 'Registr projektů', en: 'Project Registry' },
  projectsDesc: {
    cs: 'Živý registr L5 projektů — rozpočty, status a využití prostředků.',
    en: 'Live registry of L5 projects — budgets, status and fund usage.',
  },
  grantsTitle: { cs: 'Registr grantů', en: 'Grant Registry' },
  grantsDesc: {
    cs: 'Žádosti o financování z L5 fondu a jejich stav v řízení.',
    en: 'Funding requests from the L5 fund and their review state.',
  },
  empty: {
    cs: 'Registr se právě naplňuje — data se objeví po prvním seedingu.',
    en: 'The registry is being populated — entries appear after the first seeding.',
  },
  offline: {
    cs: 'Registry je momentálně nedostupný.',
    en: 'The registry is temporarily unavailable.',
  },
  budget: { cs: 'Rozpočet', en: 'Budget' },
  spent: { cs: 'Využito', en: 'Spent' },
  requested: { cs: 'Požadováno', en: 'Requested' },
  applicant: { cs: 'Žadatel', en: 'Applicant' },
  daoProposal: { cs: 'DAO návrh', en: 'DAO proposal' },
};

const PROJECT_STATUS: Record<string, { cs: string; en: string; cls: string }> = {
  planning: { cs: 'Příprava', en: 'Planning', cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' },
  vision: { cs: 'Vize', en: 'Vision', cls: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple' },
  proposed: { cs: 'Návrh', en: 'Proposed', cls: 'border-white/20 bg-white/5 text-gray-300' },
  approved: { cs: 'Schválen', en: 'Approved', cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' },
  active: { cs: 'Aktivní', en: 'Active', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  on_hold: { cs: 'Pozastaven', en: 'On hold', cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  completed: { cs: 'Dokončen', en: 'Completed', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  cancelled: { cs: 'Zrušen', en: 'Cancelled', cls: 'border-red-400/30 bg-red-400/10 text-red-300' },
};

const GRANT_STATUS: Record<string, { cs: string; en: string; cls: string }> = {
  pending: { cs: 'Čeká', en: 'Pending', cls: 'border-white/20 bg-white/5 text-gray-300' },
  under_review: { cs: 'V řízení', en: 'Under review', cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  approved: { cs: 'Schválen', en: 'Approved', cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' },
  funded: { cs: 'Financován', en: 'Funded', cls: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold' },
  completed: { cs: 'Dokončen', en: 'Completed', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  rejected: { cs: 'Zamítnut', en: 'Rejected', cls: 'border-red-400/30 bg-red-400/10 text-red-300' },
  on_dao: { cs: 'Na DAO', en: 'On DAO', cls: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple' },
};

function Badge({ status, table }: { status: string; table: Record<string, { cs: string; en: string; cls: string }> }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const s = table[status] ?? { cs: status, en: status, cls: 'border-white/20 bg-white/5 text-gray-300' };
  return (
    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${s.cls}`}>
      {s[cs ? 'cs' : 'en']}
    </span>
  );
}

export default function FreeWorldRegistry() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [projects, setProjects] = useState<FwProject[] | null>(null);
  const [grants, setGrants] = useState<FwGrant[] | null>(null);
  const [online, setOnline] = useState(true);

  const poll = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([fwApi.projects(), fwApi.grants()]);
      setProjects(p);
      setGrants(g);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  usePolling(poll, 60_000);

  if (!online) {
    return (
      <div className="zion-rainbow-sub p-5 text-sm text-gray-400" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
        {copy.offline[cs ? 'cs' : 'en']}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Projects ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="h-5 w-5 text-zion-gold" />
          <h3 className="text-xl font-semibold text-white">{copy.projectsTitle[cs ? 'cs' : 'en']}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">{copy.projectsDesc[cs ? 'cs' : 'en']}</p>
        {!projects ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="zion-rainbow-sub h-36 animate-pulse bg-white/[0.02]" style={{ '--rc': '6, 105, 40' } as React.CSSProperties} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="zion-rainbow-sub p-4 text-sm text-gray-500" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            {copy.empty[cs ? 'cs' : 'en']}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const pct = p.budget_zion > 0 ? Math.min(100, (p.spent_zion / p.budget_zion) * 100) : 0;
              return (
                <div key={p.id} className="zion-rainbow-sub p-5 flex flex-col gap-3" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-white">{p.name}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                        {p.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {p.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {p.category}
                        </span>
                      </div>
                    </div>
                    <Badge status={p.status} table={PROJECT_STATUS} />
                  </div>
                  {p.description && <p className="text-sm text-gray-400 line-clamp-3">{p.description}</p>}
                  <div className="mt-auto">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {copy.spent[cs ? 'cs' : 'en']}: {formatZion(p.spent_zion, cs)} ZION
                      </span>
                      <span>
                        {copy.budget[cs ? 'cs' : 'en']}: {formatZion(p.budget_zion, cs)} ZION
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-zion-gold to-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Grants ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileCheck2 className="h-5 w-5 text-zion-cyan" />
          <h3 className="text-xl font-semibold text-white">{copy.grantsTitle[cs ? 'cs' : 'en']}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">{copy.grantsDesc[cs ? 'cs' : 'en']}</p>
        {!grants ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="zion-rainbow-sub h-16 animate-pulse bg-white/[0.02]" style={{ '--rc': '6, 105, 40' } as React.CSSProperties} />
            ))}
          </div>
        ) : grants.length === 0 ? (
          <p className="zion-rainbow-sub p-4 text-sm text-gray-500" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            {copy.empty[cs ? 'cs' : 'en']}
          </p>
        ) : (
          <div className="space-y-2">
            {grants.map((g) => (
              <div key={g.id} className="zion-rainbow-sub p-4 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white text-sm truncate">{g.title}</p>
                  <p className="text-xs text-gray-500">
                    {g.category}
                    {g.applicant_name ? ` · ${copy.applicant[cs ? 'cs' : 'en']}: ${g.applicant_name}` : ''}
                  </p>
                </div>
                {g.dao_proposal_id != null && (
                  <Link href="/dao" className="text-xs text-zion-purple/80 hover:text-zion-purple">
                    {copy.daoProposal[cs ? 'cs' : 'en']} #{g.dao_proposal_id}
                  </Link>
                )}
                <span className="text-sm font-semibold text-zion-gold whitespace-nowrap">
                  {formatZion(g.amount_zion, cs)} ZION
                </span>
                <Badge status={g.status} table={GRANT_STATUS} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
