'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Sailboat, Sun } from 'lucide-react';
import { NIRVANA_CHAPTERS } from '../../nirvana/chapters';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Kniha Západu', en: 'The Book of the West' },
  title: { cs: 'Nirvana — dvanáct zastavení', en: 'Nirvana — twelve stations' },
  sub: {
    cs: 'Publikovaná kniha pro horizont 3.3: od pevné půdy konsensu přes mosty, vědomí a zahrady po Velké sjednocení.',
    en: 'The published book for the 3.3 horizon: from the solid ground of consensus through bridges, consciousness and gardens to the Grand Unification.',
  },
  disclaimer: {
    cs: 'Kniha Nirvana je publikovaná — ale 3.3 je cíl na horizontu, ne hotové vydání. Dostupnost čtení ≠ dodaný plán.',
    en: 'The Nirvana book is published — but 3.3 is a horizon, not a shipped release. Reading availability ≠ a delivered plan.',
  },
  groups: [
    {
      title: { cs: 'Základ a domov', en: 'Foundation & home' },
      desc: {
        cs: 'Epizody 1–5 — půda konsensu, archa, Nová země, identita a návrat domů.',
        en: 'Episodes 1–5 — the ground of consensus, the ark, the New Earth, identity and the way home.',
      },
      layer: 'L1 · ZIS · OPS',
    },
    {
      title: { cs: 'Mosty, AI a světy', en: 'Bridges, AI & worlds' },
      desc: {
        cs: 'Epizody 6–9 — přenos hodnoty, zlaté lůno, hlas záměru, krystalické světy.',
        en: 'Episodes 6–9 — value transfer, the golden womb, the voice of intent, crystalline worlds.',
      },
      layer: 'L2 · L3 · L4',
    },
    {
      title: { cs: 'Země, věda a syntéza', en: 'Earth, science & synthesis' },
      desc: {
        cs: 'Epizody 10–12 — prameny života, kvantový oheň, Velké sjednocení.',
        en: 'Episodes 10–12 — the springs of life, the quantum fire, the Grand Unification.',
      },
      layer: 'L5 · L6',
    },
  ],
  bridgeKicker: { cs: 'Pozdější most', en: 'The later bridge' },
  bridgeTitle: { cs: 'Epizoda 13 — Tres Marías, flotila Cesty', en: 'Episode 13 — Tres Marías, the Fleet of the Path' },
  bridgeBody: {
    cs: 'Most k L5 byl dopsán až po uzavření dvanácti: epizoda 10 (Prameny Života) → společníci BodhiGaia a MariaCaminho / Tres Marías → epizoda 13. Kanon dvanácti zastavení zůstává nedotčen.',
    en: 'The L5 bridge was written after the twelve closed: episode 10 (The Springs of Life) → the BodhiGaia and MariaCaminho / Tres Marías companions → episode 13. The canon of the twelve stations stays untouched.',
  },
  readBridge: { cs: 'Číst epizodu 13', en: 'Read episode 13' },
  readBook: { cs: 'Číst celou knihu Nirvana', en: 'Read the whole Nirvana book' },
  companions: { cs: 'Společníci mostu', en: 'Bridge companions' },
  project: { cs: 'Projekt Maria del Camino — vize, ne hotová flotila', en: 'The Maria del Camino project — a vision, not a finished fleet' },
  planCta: { cs: 'Jak se 3.3 stává prací → Plán v3.3', en: 'How 3.3 becomes work → the v3.3 plan' },
};

const EPISODES = NIRVANA_CHAPTERS.filter((c) => c.part === 1);
const BRIDGE = NIRVANA_CHAPTERS.find((c) => c.slug === '13-Tres-Marias');

const GROUPS = [EPISODES.slice(0, 5), EPISODES.slice(5, 9), EPISODES.slice(9, 12)];

export default function NirvanaPanel({ lang }: { lang: Lang }) {
  const l = lang;
  return (
    <Panel id="nirvana">
      <div className="space-y-8">
        <PanelHeader
          id="nirvana"
          rc="251, 146, 60"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm leading-relaxed text-amber-100/90">
          {Copy.disclaimer[l]}
        </p>

        <div className="space-y-6">
          {GROUPS.map((eps, gi) => (
            <div key={gi} className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
                  {Copy.groups[gi].title[l]}
                </h3>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                  {Copy.groups[gi].layer}
                </span>
              </div>
              <p className="text-xs text-gray-500">{Copy.groups[gi].desc[l]}</p>
              <ol className="grid gap-2 sm:grid-cols-2">
                {eps.map((ep) => (
                  <li key={ep.slug}>
                    <Link
                      href={`/nirvana/cist#${ep.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-amber-400/30"
                    >
                      <span className="text-xs font-mono text-gray-600">{ep.slug.slice(0, 2)}</span>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-amber-300">
                        {ep.title[l]}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {BRIDGE && (
          <div
            className="zion-rainbow-sub space-y-4 p-5 sm:p-6"
            style={{ '--rc': '6, 182, 212' } as CSSProperties}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zion-cyan/30 bg-zion-cyan/10">
                <Sailboat className="h-5 w-5 text-zion-cyan" />
              </span>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zion-cyan">
                  {Copy.bridgeKicker[l]}
                </p>
                <h3 className="text-base font-bold text-white sm:text-lg">{Copy.bridgeTitle[l]}</h3>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-300">{Copy.bridgeBody[l]}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/nirvana/cist#${BRIDGE.slug}`}
                className="group inline-flex items-center gap-1.5 rounded-lg border border-zion-cyan/40 bg-zion-cyan/10 px-3 py-1.5 text-xs font-semibold text-zion-cyan transition-colors hover:bg-zion-cyan/15"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {Copy.readBridge[l]}
              </Link>
              <Link
                href={
                  l === 'en'
                    ? '/docs/view/korpus/BodhiGaia/00-README_EN.md'
                    : '/docs/view/korpus/BodhiGaia/00-README.md'
                }
                className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                BodhiGaia
              </Link>
              <Link
                href="/docs/view/korpus/MariaCaminho/00-README.md"
                title={l === 'en' ? 'Czech original' : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                MariaCaminho
                {l === 'en' && <span className="text-[9px] uppercase tracking-wider text-gray-500">(CZ)</span>}
              </Link>
              <Link
                href="/terranova/maria-del-camino"
                className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
              >
                {Copy.project[l]}
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/nirvana/cist" className="zion-button-primary group">
            <Sun className="h-5 w-5" />
            {Copy.readBook[l]}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#plan-v33"
            className="zion-button-secondary border-amber-400/25 hover:border-amber-400/50 hover:text-amber-300"
          >
            {Copy.planCta[l]}
          </a>
        </div>
      </div>
    </Panel>
  );
}
