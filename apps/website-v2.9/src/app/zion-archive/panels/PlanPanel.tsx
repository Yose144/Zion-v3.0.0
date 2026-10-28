'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { NIRVANA_WORKSTREAMS, type NirvanaWorkstream } from '@/lib/nirvana-roadmap';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Mise Amenti · prováděcí rámec', en: 'Mise Amenti · execution framework' },
  title: { cs: 'Plán v3.3 „Nirvana“', en: 'The v3.3 “Nirvana” plan' },
  sub: {
    cs: 'Šest oblastí práce pro horizont 3.3 — každá má předpoklady a ověřitelný výsledek, ne slíbený termín.',
    en: 'Six areas of work on the 3.3 horizon — each has prerequisites and a verifiable outcome, not a promised date.',
  },
  baseline: {
    cs: 'Nejdřív základ: stabilní provoz, bezpečnostní review a otestovaná obnova musí být doloženy předtím, než se šest stop posune dál.',
    en: 'Baseline first: stable operation, a security review and a tested restore must be evidenced before the six tracks move further.',
  },
  prereq: {
    cs: 'Předpoklad: 3.2 „One Love“ je operační síť v aktivním vývoji — veřejný launch je odložen.',
    en: 'Prerequisite: 3.2 “One Love” is an operating network in active development — the public launch is postponed.',
  },
  prereqRoadmap: { cs: 'Roadmapa', en: 'Roadmap' },
  prereqG8: { cs: 'Stabilita a připravenost', en: 'Stability & readiness' },
  legendReading: { cs: 'dostupné čtení', en: 'available reading' },
  legendGoal: { cs: 'vývojový cíl', en: 'development goal' },
  legendHypo: { cs: 'hypotéza · literární obraz', en: 'hypothesis · literary image' },
  chainTitle: { cs: 'Řetězec závislostí', en: 'The dependency chain' },
  chainSub: {
    cs: 'Identita a settlement → AI v sandboxu → rozhraní záměru. Pořadí je podmínkou, ne kalendářem.',
    en: 'Identity & settlement → sandboxed AI → the intent interface. The order is a condition, not a calendar.',
  },
  parallelTitle: { cs: 'Paralelní stopy', en: 'Parallel tracks' },
  parallelSub: {
    cs: 'OASIS navazuje na bezpečnou identitu; péče o Zemi a otevřená věda běží souběžně.',
    en: 'OASIS follows safe identity; care for Earth and open science run alongside.',
  },
  goalLabel: { cs: 'Cíl', en: 'Goal' },
  acceptLabel: { cs: 'Kritérium přijetí', en: 'Acceptance' },
  prereqLabel: { cs: 'Předpoklad', en: 'Prerequisite' },
  layerLink: { cs: 'Stránka vrstvy', en: 'Layer page' },
  episodeLink: { cs: 'Související epizoda', en: 'Related episode' },
  gateTitle: { cs: 'Brána vydání 3.3', en: 'The 3.3 release gate' },
  gateBody: {
    cs: '3.3 se označí za hotovou teprve s důkazem: nezávislý restore/failover drill bez hlavního serveru, předání komunitě a nezávislé bezpečnostní, faktické i kulturní review. Žádné slíbené datum, žádná procenta hotovosti.',
    en: '3.3 is called done only with evidence: an independent restore/failover drill without the main server, a community handover, and independent security, factual and cultural reviews. No promised date, no completion percentages.',
  },
};

const CHAIN_IDS = ['identity', 'orchestration', 'intent'];
const PARALLEL_IDS = ['oasis', 'earth', 'science'];

function WorkstreamCard({ w, lang }: { w: NirvanaWorkstream; lang: Lang }) {
  const l = lang;
  return (
    <article
      data-workstream={w.id}
      className="h-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300">
          {w.layer}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          {Copy.legendGoal[l]}
        </span>
      </div>
      <h3 className="text-base font-bold leading-snug text-white">{w.title[l]}</h3>
      <dl className="space-y-2 text-sm leading-relaxed">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            {Copy.goalLabel[l]}
          </dt>
          <dd className="text-gray-300">{w.goal[l]}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            {Copy.acceptLabel[l]}
          </dt>
          <dd className="text-gray-400">{w.acceptance[l]}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            {Copy.prereqLabel[l]}
          </dt>
          <dd className="text-gray-400">{w.prerequisite[l]}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href={w.layerHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {Copy.layerLink[l]}
        </Link>
        <Link
          href={`/zion-archive/nirvana/cist#${w.chapterSlug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 px-3 py-1.5 text-xs font-semibold text-amber-300/90 transition-colors hover:border-amber-400/50"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {Copy.episodeLink[l]}
        </Link>
      </div>
    </article>
  );
}

export default function PlanPanel({ lang }: { lang: Lang }) {
  const l = lang;
  const chain = NIRVANA_WORKSTREAMS.filter((w) => CHAIN_IDS.includes(w.id));
  const parallel = NIRVANA_WORKSTREAMS.filter((w) => PARALLEL_IDS.includes(w.id));

  return (
    <Panel id="plan-v33">
      <div className="space-y-8">
        <PanelHeader
          id="plan-v33"
          rc="168, 85, 247"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        {/* prerequisite strip — stacked on narrow screens, split at xl */}
        <div className="grid gap-3 rounded-xl border border-zion-cyan/25 bg-zion-cyan/[0.06] px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <p className="text-sm leading-relaxed text-gray-200">{Copy.prereq[l]}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/roadmap#nirvana"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zion-cyan/30 px-3 py-1.5 text-xs font-semibold text-zion-cyan transition-colors hover:bg-zion-cyan/10"
            >
              {Copy.prereqRoadmap[l]}
            </Link>
            <Link
              href="/g8"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zion-cyan/30 px-3 py-1.5 text-xs font-semibold text-zion-cyan transition-colors hover:bg-zion-cyan/10"
            >
              {Copy.prereqG8[l]}
            </Link>
          </div>
        </div>

        {/* baseline gate — required before the six tracks */}
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-gray-300">
          {Copy.baseline[l]}
        </p>

        {/* status legend */}
        <ul className="flex flex-wrap gap-2" aria-label={l === 'cs' ? 'Legenda stavů' : 'Status legend'}>
          <li className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
            {Copy.legendReading[l]}
          </li>
          <li className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            {Copy.legendGoal[l]}
          </li>
          <li className="rounded-full border border-zion-purple/30 bg-zion-purple/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zion-purple">
            {Copy.legendHypo[l]}
          </li>
        </ul>

        {/* dependency chain */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.chainTitle[l]}
            </h3>
            <p className="text-xs text-gray-500">{Copy.chainSub[l]}</p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-3">
            {chain.map((w, i) => (
              <li key={w.id} className="relative">
                <WorkstreamCard w={w} lang={l} />
                {i < chain.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-amber-400/60 lg:block"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* parallel tracks */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.parallelTitle[l]}
            </h3>
            <p className="text-xs text-gray-500">{Copy.parallelSub[l]}</p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-3">
            {parallel.map((w) => (
              <li key={w.id}>
                <WorkstreamCard w={w} lang={l} />
              </li>
            ))}
          </ul>
        </div>

        {/* release gate */}
        <div className="flex items-start gap-3 rounded-2xl border border-zion-purple/25 bg-zion-purple/[0.05] p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zion-purple/30 bg-zion-purple/10">
            <ShieldCheck className="h-5 w-5 text-zion-purple" />
          </span>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-white">{Copy.gateTitle[l]}</h3>
            <p className="text-sm leading-relaxed text-gray-300">{Copy.gateBody[l]}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
