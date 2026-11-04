'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Library,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { COMPANION_GROUPS, type CompanionStatus } from '../library';
import {
  LIBRARY,
  LIBRARY_GROUPS,
  LIBRARY_STATS,
  normalizeText,
  searchHaystack,
  type LibraryEntry,
} from '../library-index';
import { downloadForBook } from '@/lib/books/downloads';
import { progressPercent, useReadingProgress } from '@/lib/books/progress';
import { Panel, PanelHeader, type Lang } from './shared';

type LangFilter = 'all' | 'cz' | 'cz-en';

const Copy = {
  kicker: { cs: 'Knihovna cesty', en: 'The library of the path' },
  title: { cs: 'Všechny knihy', en: 'All books' },
  sub: {
    cs: 'Celá knihovna na jednom místě — hlavní osa i doprovodné knihy, jeden reader a paměť místa, kde jsi skončil.',
    en: 'The whole library in one place — the main axis and the companion books, one reader and a memory of where you stopped.',
  },
  steps: {
    cs: [
      { title: 'Vyber knihu', body: 'Začni hlavní osou od Genesis po Nirvanu, nebo si otevři kteroukoli doprovodnou knihu.' },
      { title: 'Čti v jednom readeru', body: 'Stejné ovládání i obsah pro všech 18 knih; anglický text se načte tam, kde existuje.' },
      { title: 'Pokračuj, kde jsi', body: 'Archiv si pamatuje poslední kapitolu — jen ve tvém prohlížeči, bez účtu.' },
    ],
    en: [
      { title: 'Pick a book', body: 'Start with the main axis from Genesis to Nirvana, or open any companion book.' },
      { title: 'Read in one reader', body: 'Same controls and content for all 18 books; English text loads wherever it exists.' },
      { title: 'Continue where you stopped', body: 'The archive remembers your last chapter — in your browser only, no account.' },
    ],
  },
  searchPlaceholder: { cs: 'Hledat knihu, kapitolu, téma…', en: 'Search books, chapters, themes…' },
  searchLabel: { cs: 'Hledat v knihovně', en: 'Search the library' },
  clearSearch: { cs: 'Vymazat hledání', en: 'Clear search' },
  allGroups: { cs: 'Vše', en: 'All' },
  allLangs: { cs: 'Všechny jazyky', en: 'All languages' },
  langCz: { cs: 'Jen česky', en: 'Czech only' },
  langBoth: { cs: 'CZ + EN', en: 'CZ + EN' },
  results: { cs: 'knih', en: 'books' },
  reset: { cs: 'Zrušit filtry', en: 'Reset filters' },
  emptyTitle: { cs: 'Nic nenalezeno', en: 'Nothing found' },
  emptyBody: {
    cs: 'Zkus jiné slovo, nebo filtry zruš.',
    en: 'Try another word, or reset the filters.',
  },
  read: { cs: 'Číst', en: 'Read' },
  continueReading: { cs: 'Pokračovat', en: 'Continue' },
  open: { cs: 'Otevřít', en: 'Open' },
  enIndex: { cs: 'EN index', en: 'English index' },
  about: { cs: 'O knize', en: 'About' },
  status: {
    canon: { cs: 'kanon', en: 'canon' },
    draft: { cs: 'draft', en: 'draft' },
    framework: { cs: 'rámec · evidence', en: 'framework · evidence' },
  } as Record<CompanionStatus, { cs: string; en: string }>,
  markerHere: { cs: 'jsme tady', en: 'we are here' },
  markerGoal: { cs: 'cíl cesty', en: 'the destination' },
  czOnly: { cs: 'CZ', en: 'CZ' },
  downloadTitle: { cs: 'Stáhnout kompletní edici (ZIP)', en: 'Download the complete edition (ZIP)' },
  moreTitle: { cs: 'Další zdroje', en: 'More resources' },
  docs: { cs: 'Knihovna dokumentů', en: 'Document library' },
  whitepapers: { cs: 'Whitepapery', en: 'Whitepapers' },
  onboarding: { cs: 'Onboarding (CZ/EN)', en: 'Onboarding (CZ/EN)' },
  libraryNote: {
    cs: 'Anglické kapitoly existují u části knih; reader u ostatních poctivě přizná český originál.',
    en: 'English chapters exist for some books; the reader honestly marks the Czech original for the rest.',
  },
};

function chaptersLabel(n: number, l: Lang): string {
  if (!n) return '';
  if (l === 'en') return n === 1 ? '1 chapter' : `${n} chapters`;
  if (n === 1) return '1 kapitola';
  if (n < 5) return `${n} kapitoly`;
  return `${n} kapitol`;
}

function bookCountLabel(n: number, l: Lang): string {
  if (l === 'en') return `${n} ${n === 1 ? 'book' : 'books'}`;
  return `${n} ${n === 1 ? 'kniha' : n < 5 ? 'knihy' : 'knih'}`;
}

const chipBase =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors';

export default function KnihovnaPanel({ lang }: { lang: Lang }) {
  const l = lang;
  const progress = useReadingProgress();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [langFilter, setLangFilter] = useState<LangFilter>('all');

  const normalizedQuery = normalizeText(query);
  const hasFilters = Boolean(normalizedQuery) || groupId !== 'all' || langFilter !== 'all';

  const filtered = useMemo(() => {
    return LIBRARY_GROUPS.flatMap((g) => g.entries).filter((entry) => {
      if (groupId !== 'all' && entry.groupId !== groupId) return false;
      if (langFilter === 'cz' && entry.languages !== 'cz') return false;
      if (langFilter === 'cz-en' && entry.languages !== 'cz-en') return false;
      if (normalizedQuery && !searchHaystack(entry).includes(normalizedQuery)) return false;
      return true;
    });
  }, [groupId, langFilter, normalizedQuery]);

  const reset = () => {
    setQuery('');
    setGroupId('all');
    setLangFilter('all');
  };

  const renderCard = (entry: LibraryEntry) => {
    const Icon = entry.icon;
    const saved = progress[entry.id];
    const pct = progressPercent(saved);
    const download = downloadForBook(entry.id);
    const primaryHref = saved && entry.reader ? `${saved.path}#${saved.chapterSlug}` : entry.href;
    const primaryLabel = !entry.reader
      ? Copy.open[l]
      : saved
        ? Copy.continueReading[l]
        : Copy.read[l];

    return (
      <li key={entry.id} className="h-full">
        <article
          className="group flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-200 motion-safe:hover:-translate-y-0.5"
          style={
            {
              borderColor: `rgba(${entry.accent}, 0.22)`,
              background: `linear-gradient(160deg, rgba(${entry.accent}, 0.10), rgba(${entry.accent}, 0.02) 55%, rgba(255,255,255,0.01))`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            } as CSSProperties
          }
        >
          {/* cover header */}
          <div
            className="relative h-24 overflow-hidden border-b"
            style={{
              borderColor: `rgba(${entry.accent}, 0.16)`,
              background: `radial-gradient(120% 120% at 85% 15%, rgba(${entry.accent}, 0.30), rgba(${entry.accent}, 0.06) 55%, transparent 75%)`,
            }}
          >
            <Icon
              aria-hidden
              className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 opacity-25 transition-transform duration-500 group-hover:scale-110"
              style={{ color: `rgb(${entry.accent})` }}
            />
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {entry.status && (
                <span
                  className={chipBase}
                  style={{
                    borderColor: `rgba(${entry.accent}, 0.4)`,
                    color: `rgb(${entry.accent})`,
                    backgroundColor: `rgba(${entry.accent}, 0.10)`,
                  }}
                >
                  {Copy.status[entry.status][l]}
                </span>
              )}
              {entry.marker === 'here' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zion-gold">
                  <Sparkles className="h-3 w-3" />
                  {Copy.markerHere[l]}
                </span>
              )}
              {entry.marker === 'goal' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                  {Copy.markerGoal[l]}
                </span>
              )}
              {!entry.status && !entry.marker && entry.position && (
                <span
                  className={chipBase}
                  style={{
                    borderColor: `rgba(${entry.accent}, 0.4)`,
                    color: `rgb(${entry.accent})`,
                    backgroundColor: `rgba(${entry.accent}, 0.10)`,
                  }}
                >
                  {entry.position}. {entry.mantra}
                </span>
              )}
            </div>
            <p className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: `rgb(${entry.accent})` }}
              />
              {entry.groupLabel[l]}
              {entry.chapterCount > 0 && (
                <span className="text-white/30">· {chaptersLabel(entry.chapterCount, l)}</span>
              )}
            </p>
          </div>

          {/* body */}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <h4 className="text-sm font-bold leading-snug text-white">
              <Link
                href={primaryHref}
                prefetch={false}
                className="transition-colors hover:text-zion-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
              >
                {entry.title[l]}
              </Link>
            </h4>
            <p className="line-clamp-3 text-xs leading-relaxed text-gray-400">{entry.subtitle[l]}</p>

            {(entry.facts.length > 0 || entry.languages === 'cz') && (
              <div className="flex flex-wrap gap-1.5">
                {entry.facts.slice(0, 2).map((fact) => (
                  <span
                    key={`${fact.label.cs}-${fact.value}`}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-gray-400"
                  >
                    <span className="text-gray-500">{fact.label[l]}:</span>{' '}
                    <span className="font-semibold text-gray-300">{fact.value}</span>
                  </span>
                ))}
                {entry.languages === 'cz' && (
                  <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    {Copy.czOnly[l]}
                  </span>
                )}
              </div>
            )}

            {saved && entry.reader && (
              <div className="space-y-1.5">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: `rgb(${entry.accent})` }}
                  />
                </div>
                <p className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <CheckCircle2 className="h-3 w-3" style={{ color: `rgb(${entry.accent})` }} />
                  <span className="truncate">{saved.chapterLabel}</span>
                  <span className="ml-auto shrink-0 font-semibold text-gray-400">{pct} %</span>
                </p>
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
              <Link
                href={primaryHref}
                prefetch={false}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
                style={{
                  borderColor: `rgba(${entry.accent}, 0.4)`,
                  color: `rgb(${entry.accent})`,
                  backgroundColor: `rgba(${entry.accent}, 0.08)`,
                }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {primaryLabel}
              </Link>
              {entry.enHref && entry.enHref !== entry.href && (
                <Link
                  href={entry.enHref}
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:border-white/25 hover:text-gray-200"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {Copy.enIndex[l]}
                </Link>
              )}
              {download && (
                <a
                  href={`/api/archive/downloads/${download.id}`}
                  title={Copy.downloadTitle[l]}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400/60 hover:bg-emerald-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
                >
                  <Download className="h-3.5 w-3.5" />
                  ZIP
                </a>
              )}
            </div>
          </div>
        </article>
      </li>
    );
  };

  return (
    <Panel id="knihovna">
      <div className="space-y-8">
        <PanelHeader
          id="knihovna"
          rc="236, 72, 153"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        {/* how to read — three honest steps, no marketing */}
        <ol className="grid gap-2.5 sm:grid-cols-3">
          {Copy.steps[l].map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(236,72,153,0.35)] bg-[rgba(236,72,153,0.12)] text-xs font-bold text-[rgb(236,72,153)]">
                {i + 1}
              </span>
              <h3 className="mt-2.5 text-sm font-bold text-white">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{step.body}</p>
            </li>
          ))}
        </ol>

        {/* search + filters */}
        <div
          className="zion-rainbow-sub space-y-3 p-3 sm:p-4"
          style={{ '--rc': '236, 72, 153' } as CSSProperties}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={Copy.searchPlaceholder[l]}
              aria-label={Copy.searchLabel[l]}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-gray-600 focus:border-[rgba(236,72,153,0.5)] focus:outline-none focus:ring-2 focus:ring-[rgba(236,72,153,0.25)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={Copy.clearSearch[l]}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label={Copy.kicker[l]}>
            <button
              type="button"
              onClick={() => setGroupId('all')}
              aria-pressed={groupId === 'all'}
              className={`${chipBase} ${
                groupId === 'all'
                  ? 'border-[rgba(236,72,153,0.5)] bg-[rgba(236,72,153,0.15)] text-[rgb(236,72,153)]'
                  : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/25 hover:text-white'
              }`}
            >
              {Copy.allGroups[l]}
              <span className="text-[10px] font-bold text-gray-500">{LIBRARY.length}</span>
            </button>
            {LIBRARY_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setGroupId(group.id)}
                aria-pressed={groupId === group.id}
                className={`${chipBase} ${
                  groupId === group.id
                    ? 'border-[rgba(236,72,153,0.5)] bg-[rgba(236,72,153,0.15)] text-[rgb(236,72,153)]'
                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/25 hover:text-white'
                }`}
              >
                {group.label[l]}
                <span className="text-[10px] font-bold text-gray-500">{group.entries.length}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', Copy.allLangs[l]],
                ['cz', Copy.langCz[l]],
                ['cz-en', Copy.langBoth[l]],
              ] as [LangFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLangFilter(id)}
                aria-pressed={langFilter === id}
                className={`${chipBase} ${
                  langFilter === id
                    ? 'border-zion-cyan/50 bg-zion-cyan/15 text-zion-cyan'
                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/25 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}

            <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-gray-500">
              {bookCountLabel(filtered.length, l)}
              {hasFilters && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-400 transition-colors hover:border-white/25 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  {Copy.reset[l]}
                </button>
              )}
            </span>
          </div>
        </div>

        {/* books */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-gray-600" />
            <h3 className="mt-3 text-sm font-bold text-white">{Copy.emptyTitle[l]}</h3>
            <p className="mt-1 text-xs text-gray-500">{Copy.emptyBody[l]}</p>
          </div>
        ) : hasFilters ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(renderCard)}
          </ul>
        ) : (
          <div className="space-y-7">
            {LIBRARY_GROUPS.map((group) => (
              <section key={group.id} className="space-y-3" aria-labelledby={`knihovna-${group.id}`}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3
                    id={`knihovna-${group.id}`}
                    className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200"
                  >
                    {group.label[l]}
                  </h3>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                    {bookCountLabel(group.entries.length, l)}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.entries.map(renderCard)}
                </ul>
              </section>
            ))}
            <p className="text-xs italic leading-relaxed text-gray-500">{Copy.libraryNote[l]}</p>
            <p className="text-xs leading-relaxed text-gray-500">
              {bookCountLabel(LIBRARY_STATS.books, l)} · {LIBRARY_STATS.groups}{' '}
              {l === 'cs' ? 'skupin' : 'groups'} ·{' '}
              {COMPANION_GROUPS.reduce((n, g) => n + g.items.length, 0)}{' '}
              {l === 'cs' ? 'doprovodných textů' : 'companion texts'}
            </p>
          </div>
        )}

        {/* extra resources row */}
        <div className="space-y-2 border-t border-white/8 pt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500">
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
