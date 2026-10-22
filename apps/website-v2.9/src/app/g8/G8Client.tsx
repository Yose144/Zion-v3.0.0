'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Globe, HeartPulse,
  RefreshCw, ShieldCheck, Timer, TrendingUp,
} from 'lucide-react';

const G8Copy = {
  title: { cs: `30denní stabilitní běh`, en: `30-Day Stability Run` },
  subtitle: {
    cs: `Průběžná veřejná validace produkční sítě ZION — nepřetržitý 30denní běh s cílem ≥99,9 % dostupnosti klíčových služeb a nulovými kritickými incidenty.`,
    en: `Continuous public validation of the ZION production network — an uninterrupted 30-day run targeting ≥99.9% availability of key services with zero critical incidents.`,
  },
  statusRunning: { cs: `Běží`, en: `Running` },
  statusPassed: { cs: `Splněno`, en: `Passed` },
  statusFailed: { cs: `Nesplněno`, en: `Failed` },
  statusWindowElapsed: { cs: `Okno ukončeno`, en: `Window elapsed` },
  statusNotStarted: { cs: `Nezahájeno`, en: `Not started` },
  statusUnavailable: { cs: `Nedostupné`, en: `Unavailable` },
  gatePending: { cs: `verdikt: čeká se`, en: `verdict: pending` },
  gatePassed: { cs: `verdikt: splněno`, en: `verdict: passed` },
  gateFailed: { cs: `verdikt: nesplněno`, en: `verdict: failed` },
  gateIncomplete: { cs: `verdikt: neúplná evidence`, en: `verdict: incomplete evidence` },
  gateReasonCriticalIncident: { cs: `kritický incident`, en: `critical incident` },
  gateReasonDowntimeBudget: { cs: `vyčerpán downtime budget`, en: `downtime budget exhausted` },
  gateReasonStoppedEarly: { cs: `běh ukončen předčasně`, en: `stopped before window end` },
  gateReasonCoverage: { cs: `nízké pokrytí evidence`, en: `coverage below threshold` },
  gateReasonUptime: { cs: `dostupnost pod prahem`, en: `uptime below threshold` },
  uptime: { cs: `Dostupnost`, en: `Uptime` },
  uptimeTarget: { cs: `cíl ≥ 99,9 %`, en: `target ≥ 99.9%` },
  progress: { cs: `Průběh`, en: `Progress` },
  elapsed: { cs: `Uběhlo`, en: `Elapsed` },
  remaining: { cs: `Zbývá`, en: `Remaining` },
  started: { cs: `Zahájeno`, en: `Started` },
  targetEnd: { cs: `Cílové ukončení`, en: `Target end` },
  runId: { cs: `ID běhu`, en: `Run ID` },
  signals: { cs: `Monitorované signály`, en: `Monitored signals` },
  signalSub: {
    cs: `Každý signál se vzorkuje každých 60 s. Chybějící vzorek se počítá jako výpadek — ne jako úspěch.`,
    en: `Every signal is sampled every 60 s. A missing sample counts as downtime — never as success.`,
  },
  evidenceCoverage: { cs: `Pokrytí evidence`, en: `Evidence coverage` },
  samples: { cs: `vzorků`, en: `samples` },
  alerts: { cs: `Aktivní alerty`, en: `Active alerts` },
  incidents: { cs: `Incidenty`, en: `Incidents` },
  criticalIncidents: { cs: `kritické`, en: `critical` },
  rules: { cs: `Pravidla běhu`, en: `Run rules` },
  rule1: {
    cs: `Okno trvá minimálně 30 × 24 hodin; čas sám o sobě verdikt neznamená.`,
    en: `The window lasts at least 30 × 24 hours; elapsed time alone never decides the verdict.`,
  },
  rule2: {
    cs: `Dostupnost se měří na 60s vzorcích napříč chainem, poolem, stratumem, bridge relayí, governance a identitou.`,
    en: `Availability is measured on 60-second samples across the chain, pool, stratum, bridge relay, governance and identity.`,
  },
  rule3: {
    cs: `Chain tip starší než 15 minut se počítá jako outage; kritický incident běh automaticky posoudí.`,
    en: `A chain tip older than 15 minutes counts as an outage; a critical incident affects the verdict.`,
  },
  rule4: {
    cs: `Verdikt může být „splněno“, „nesplněno“ nebo „neúplná evidence“ — vyhodnocuje ho nezávislý evidence tracker, ne dashboard.`,
    en: `The verdict can be “passed”, “failed” or “incomplete evidence” — decided by an independent evidence tracker, not the dashboard.`,
  },
  lastUpdate: { cs: `Poslední update evidence`, en: `Last evidence update` },
  refresh: { cs: `Obnovit`, en: `Refresh` },
  autoRefresh: { cs: `auto-refresh 30 s`, en: `auto-refresh 30 s` },
  backToMonitoring: { cs: `← Monitoring`, en: `← Monitoring` },
  errorLoad: { cs: `Stav běhu se nepodařilo načíst — zkuste to za chvíli.`, en: `Could not load run status — please try again shortly.` },
};

interface G8Status {
  schema_version: number | null;
  run_id: string | null;
  status: string | null;
  window_status: string | null;
  gate_status: string | null;
  gate_reason: string | null;
  started: string | null;
  target_end: string | null;
  elapsed_seconds: number | null;
  remaining_seconds: number | null;
  progress_percent: number | null;
  uptime_percent: number | null;
  evidence_coverage_percent: number | null;
  service_uptime_percent: Record<string, number | null>;
  active_alert_count: number;
  incident_count: number;
  critical_incident_count: number;
  sample_counts: { expected?: number; covered?: number; good?: number } | null;
  last_evidence_update: string | null;
  policy: { uptime_threshold_percent: number; critical_outage_seconds: number };
}

function fmtDuration(seconds: number | null, lang: string): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return lang === 'cs' ? `${d} d ${h} h ${m} min` : `${d}d ${h}h ${m}m`;
  if (h > 0) return lang === 'cs' ? `${h} h ${m} min` : `${h}h ${m}m`;
  return lang === 'cs' ? `${m} min` : `${m}m`;
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(v >= 99.9 ? 2 : 1)}%`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function G8Client() {
  const { lang } = useLang();
  const t = (k: keyof typeof G8Copy) => G8Copy[k][lang as 'cs' | 'en'] || G8Copy[k].en;
  const [data, setData] = useState<G8Status | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/g8', { cache: 'no-store' });
      if (!res.ok) throw new Error('unavailable');
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(load, 30000);

  const windowStatus = data?.window_status || data?.status || null;
  const gate = data?.gate_status || null;
  const statusLabel = !data && error
    ? t('statusUnavailable')
    : windowStatus === 'running'
      ? t('statusRunning')
      : windowStatus === 'window_elapsed'
        ? t('statusWindowElapsed')
        : windowStatus === 'passed'
          ? t('statusPassed')
          : windowStatus === 'failed'
            ? t('statusFailed')
            : windowStatus
              ? windowStatus
              : t('statusNotStarted');
  const statusColor = error || !data
    ? 'bg-gray-700/60 text-gray-300 border-gray-600'
    : windowStatus === 'running'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : windowStatus === 'passed'
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
        : windowStatus === 'failed'
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/40';
  const gateLabel = gate === 'passed'
    ? t('gatePassed')
    : gate === 'failed'
      ? t('gateFailed')
      : gate === 'evidence_incomplete'
        ? t('gateIncomplete')
        : gate
          ? t('gatePending')
          : null;
  const gateReason = data?.gate_reason || null;
  const gateReasonLabel = gateReason === 'critical_incident'
    ? t('gateReasonCriticalIncident')
    : gateReason === 'downtime_budget_exhausted'
      ? t('gateReasonDowntimeBudget')
      : gateReason === 'stopped_before_window_end'
        ? t('gateReasonStoppedEarly')
        : gateReason === 'coverage_below_threshold'
          ? t('gateReasonCoverage')
          : gateReason === 'uptime_below_threshold'
            ? t('gateReasonUptime')
            : null;

  const uptime = data?.uptime_percent ?? null;
  const threshold = data?.policy?.uptime_threshold_percent ?? 99.9;
  const uptimeOk = uptime != null && uptime >= threshold;
  const progress = data?.progress_percent ?? 0;

  return (
    <main className="min-h-screen bg-[#070a14] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link href="/monitoring" className="text-xs text-cyan-300/80 hover:text-cyan-200 transition">
          {t('backToMonitoring')}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <HeartPulse className="h-7 w-7 text-cyan-300" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-purple-300 to-amber-300 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          {gateLabel && (
            <span className="text-[10px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-gray-400">
              {gateLabel}
              {gateReasonLabel ? ` — ${gateReasonLabel}` : ''}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm text-gray-400 leading-relaxed">{t('subtitle')}</p>

        {error && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {t('errorLoad')}
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
              <TrendingUp className="h-3.5 w-3.5" /> {t('uptime')}
            </div>
            <div className={`mt-2 text-2xl font-extrabold font-mono ${uptime == null ? 'text-gray-400' : uptimeOk ? 'text-emerald-300' : 'text-rose-300'}`}>
              {loading && !data ? '…' : fmtPct(uptime)}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">{t('uptimeTarget')}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
              <Activity className="h-3.5 w-3.5" /> {t('evidenceCoverage')}
            </div>
            <div className="mt-2 text-2xl font-extrabold font-mono text-cyan-300">
              {loading && !data ? '…' : fmtPct(data?.evidence_coverage_percent ?? null)}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">
              {data?.sample_counts ? `${data.sample_counts.good ?? '—'}/${data.sample_counts.expected ?? '—'} ${t('samples')}` : '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
              <Clock className="h-3.5 w-3.5" /> {t('elapsed')}
            </div>
            <div className="mt-2 text-2xl font-extrabold font-mono text-white">
              {loading && !data ? '…' : fmtDuration(data?.elapsed_seconds ?? null, lang)}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">{t('started')}: {fmtTime(data?.started ?? null)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
              <Timer className="h-3.5 w-3.5" /> {t('remaining')}
            </div>
            <div className="mt-2 text-2xl font-extrabold font-mono text-white">
              {loading && !data ? '…' : fmtDuration(data?.remaining_seconds ?? null, lang)}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">{t('targetEnd')}: {fmtTime(data?.target_end ?? null)}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">{t('progress')}</span>
            <span className="text-xs font-mono text-gray-300">{(progress ?? 0).toFixed(2)}%</span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-300 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400">
            <span>{t('runId')}: <span className="font-mono text-gray-300">{data?.run_id ?? '—'}</span></span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('alerts')}: <span className={`font-mono ${((data?.active_alert_count ?? 0) > 0) ? 'text-amber-300' : 'text-emerald-300'}`}>{data?.active_alert_count ?? '—'}</span>
            </span>
            <span>
              {t('incidents')}: <span className="font-mono text-gray-300">{data?.incident_count ?? '—'}</span>
              {' · '}{t('criticalIncidents')}: <span className={`font-mono ${((data?.critical_incident_count ?? 0) > 0) ? 'text-rose-300' : 'text-gray-300'}`}>{data?.critical_incident_count ?? '—'}</span>
            </span>
            <span className="ml-auto text-[10px] text-gray-500">{t('autoRefresh')}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{t('signals')}</div>
          <p className="mb-4 text-xs text-gray-500">{t('signalSub')}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data?.service_uptime_percent ?? {}).map(([name, v]) => (
              <div key={name} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-gray-300">{name}</span>
                <span className={`text-sm font-mono font-bold ${v == null ? 'text-gray-500' : v >= 99.9 ? 'text-emerald-300' : v >= 99 ? 'text-amber-300' : 'text-rose-300'}`}>
                  {v == null ? '—' : `${v.toFixed(1)}%`}
                </span>
              </div>
            ))}
            {!data && !error && <div className="col-span-full text-xs text-gray-500">…</div>}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" /> {t('rules')}
          </div>
          <ul className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/70" />{t('rule1')}</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/70" />{t('rule2')}</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/70" />{t('rule3')}</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/70" />{t('rule4')}</li>
          </ul>
          {data?.last_evidence_update && (
            <div className="mt-4 text-[10px] text-gray-600">
              {t('lastUpdate')}: {fmtTime(data.last_evidence_update)} · <Globe className="inline h-3 w-3" /> live
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
