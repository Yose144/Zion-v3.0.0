'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { BookOpen, ExternalLink, FileText, Library } from 'lucide-react';
import { COMPANION_GROUPS, MAIN_BOOKS, type CompanionStatus } from '../library';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Knihovna cesty', en: 'The library of the path' },
  title: { cs: 'Všechny knihy', en: 'All books' },
  sub: {
    cs: 'Celá knihovna na jednom místě — hlavní knihy cesty i doprovodné osy; čte se v jednom readeru.',
    en: 'The whole library in one place — the main books of the path and the companion axes; all read in one reader.',
  },
  mainGroup: { cs: 'Hlavní knihy — cesta', en: 'Main books — the path' },
  mainBlurb: {
    cs: 'Šest knih hlavní osy od Genesis po Nirvanu — čtou se v pořadí.',
    en: 'The six books of the main axis from Genesis to Nirvana — read in order.',
  },
  about: { cs: 'O knize', en: 'About' },
  markerHere: { cs: '· jsme tady', en: '· we are here' },
  markerGoal: { cs: '· cíl cesty', en: '· the goal' },
  status: {
    canon: { cs: 'kanon', en: 'canon' },
    draft: { cs: 'draft', en: 'draft' },
    framework: { cs: 'rámec · evidence', en: 'framework · evidence' },
  } as Record<CompanionStatus, { cs: string; en: string }>,
  chapterTag: { cs: 'kapitola', en: 'chapter' },
  czOnly: { cs: 'česky', en: 'Czech original' },
  enIndex: { cs: 'Anglický index', en: 'English index' },
  czOriginal: { cs: 'Český originál', en: 'Czech original' },
  readChapter: { cs: 'Číst kapitolu', en: 'Read the chapter' },
  openIndex: { cs: 'Otevřít index', en: 'Open the index' },
  openIndexEn: { cs: 'Anglický index', en: 'English index' },
  enIndexNote: {
    cs: 'Anglický index — kapitoly zůstávají české',
    en: 'English index — the chapters remain in Czech',
  },
  moreTitle: { cs: 'Další zdroje', en: 'More resources' },
  docs: { cs: 'Knihovna dokumentů', en: 'Document library' },
  whitepapers: { cs: 'Whitepapery', en: 'Whitepapers' },
  onboarding: { cs: 'Onboarding (CZ/EN)', en: 'Onboarding (CZ/EN)' },
};

function bookCount(n: number, l: Lang) {
  if (l === 'en') return n === 1 ? '1 book' : `${n} books`;
  return `${n} ${n === 1 ? 'kniha' : n < 5 ? 'knihy' : 'knih'}`;
}

// accent-driven card chrome: --rc var feeds border/bg/hover without per-book css
const cardCls =
  'group flex h-full flex-col gap-2.5 rounded-2xl border p-3.5 transition-all duration-200 ' +
  'border-[rgba(var(--rc),0.2)] bg-[rgba(var(--rc),0.05)] hover:border-[rgba(var(--rc),0.45)] ' +
  'hover:bg-[rgba(var(--rc),0.08)] motion-safe:hover:-translate-y-0.5 sm:p-4';
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
  'transition-colors border-[rgba(var(--rc),0.35)] text-[rgb(var(--rc))] hover:border-[rgba(var(--rc),0.6)] ' +
  'hover:bg-[rgba(var(--rc),0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60';
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold ' +
  'text-gray-400 transition-colors hover:border-white/25 hover:text-gray-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60';
const chip =
  'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ' +
  'border-[rgba(var(--rc),0.3)] text-[rgb(var(--rc))]';
const chipNeutral =
  'shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold ' +
  'uppercase tracking-[0.16em] text-gray-400';

export default function SpolecniciPanel({ lang }: { lang: Lang }) {
  const l = lang;
  return (
    <Panel id="spolecnici">
      <div className="space-y-8">
        <PanelHeader
          id="spolecnici"
          rc="168, 85, 247"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        <div className="space-y-7">
          {/* main spine books first — the whole library lives in this panel */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
                {Copy.mainGroup[l]}
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                {bookCount(MAIN_BOOKS.length, l)}
              </span>
              <p className="w-full text-xs text-gray-500">{Copy.mainBlurb[l]}</p>
            </div>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
              {MAIN_BOOKS.map((b) => (
                <li key={b.id}>
                  <article className={cardCls} style={{ '--rc': b.rc } as CSSProperties}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <h4 className="min-w-0 flex-1 basis-40 text-sm font-bold leading-snug text-white">
                        <Link
                          href={b.readHref}
                          className="transition-colors hover:text-zion-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
                        >
                          {b.title[l]}
                        </Link>
                      </h4>
                      <span className={chip}>
                        {b.position} · {b.mantra}
                      </span>
                      {b.marker && (
                        <span className={chipNeutral}>
                          {b.marker === 'here' ? Copy.markerHere[l] : Copy.markerGoal[l]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-gray-400">{b.role[l]}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <Link href={b.readHref} className={primaryBtn}>
                        <BookOpen className="h-3.5 w-3.5" />
                        {Copy.readChapter[l]}
                      </Link>
                      {b.aboutHref && b.aboutHref !== b.readHref && (
                        <Link href={b.aboutHref} className={ghostBtn}>
                          <FileText className="h-3.5 w-3.5" />
                          {Copy.about[l]}
                        </Link>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>

          {COMPANION_GROUPS.map((g) => (
            <div key={g.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
                  {g.title[l]}
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                  {bookCount(g.items.length, l)}
                </span>
                <p className="w-full text-xs text-gray-500">{g.blurb[l]}</p>
              </div>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {g.items.map((item) => {
                  // Localized primary: EN readers land on the English index when it
                  // exists (chapters stay Czech — flagged by the action label).
                  const primaryHref = l === 'en' && item.enHref ? item.enHref : item.href;
                  const primaryLabel =
                    item.kind === 'chapter'
                      ? Copy.readChapter[l]
                      : l === 'en' && item.enHref
                        ? Copy.openIndexEn[l]
                        : Copy.openIndex[l];
                  const secondaryHref = l === 'en' && item.enHref ? item.href : item.enHref;
                  const secondaryLabel =
                    l === 'en' && item.enHref ? Copy.czOriginal[l] : Copy.enIndex[l];
                  return (
                    <li key={item.id}>
                      <article className={cardCls} style={{ '--rc': item.rc } as CSSProperties}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <h4 className="min-w-0 flex-1 basis-40 text-sm font-bold leading-snug text-white">
                            <Link
                              href={primaryHref}
                              className="transition-colors hover:text-zion-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
                            >
                              {item.title[l]}
                            </Link>
                          </h4>
                          <span className={chip}>{Copy.status[item.status][l]}</span>
                          {item.kind === 'chapter' && (
                            <span className={chipNeutral}>{Copy.chapterTag[l]}</span>
                          )}
                          {item.czOnly && <span className={chipNeutral}>{Copy.czOnly[l]}</span>}
                        </div>
                        <p className="text-xs leading-relaxed text-gray-400">{item.description[l]}</p>
                        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                          <Link
                            href={primaryHref}
                            title={l === 'en' && item.enHref ? Copy.enIndexNote[l] : undefined}
                            className={primaryBtn}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            {primaryLabel}
                          </Link>
                          {secondaryHref && secondaryHref !== primaryHref && (
                            <Link
                              href={secondaryHref}
                              title={l === 'en' ? undefined : Copy.enIndexNote[l]}
                              className={ghostBtn}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {secondaryLabel}
                            </Link>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* extra resources row */}
        <div className="space-y-2 border-t border-white/8 pt-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
            {Copy.moreTitle[l]}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <Library className="h-3.5 w-3.5" />
              {Copy.docs[l]}
            </Link>
            <Link
              href="/whitepapers"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              {Copy.whitepapers[l]}
            </Link>
            <Link
              href={`/docs/view/korpus/ZION_ONBOARDING_PUBLIC_${l === 'cs' ? 'CZ' : 'EN'}.md`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {Copy.onboarding[l]}
            </Link>
          </div>
        </div>
      </div>
    </Panel>
  );
}
