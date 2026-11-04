// One flat index of the whole Zion Archive library, built from the three
// existing sources of truth:
//   • BOOK_NAV    — reading order + groups (registry.ts)
//   • BOOKS       — real book definitions with accents, icons and facts
//   • library.ts  — editorial roles, markers and companion statuses
//
// The hub, the library panel and the lock page all render from this index, so
// a book added to the registry shows up everywhere without touching UI code.

import { BookOpen, Egg, Sailboat } from 'lucide-react';
import { BOOKS, BOOK_NAV } from '@/lib/books/registry';
import type { IconType } from '@/lib/books/types';
import { COMPANION_GROUPS, MAIN_BOOKS, type CompanionStatus } from './library';

export interface LibraryEntry {
  id: string;
  href: string;
  /** English index (chapters stay Czech) when the book has one. */
  enHref?: string;
  /** False for experience links (Genesis, Terra Nova) that are not readers. */
  reader: boolean;
  groupId: string;
  groupLabel: { cs: string; en: string };
  title: { cs: string; en: string };
  subtitle: { cs: string; en: string };
  description: { cs: string; en: string };
  accent: string;
  icon: IconType;
  facts: { label: { cs: string; en: string }; value: string }[];
  chapterCount: number;
  languages: 'cz' | 'cz-en';
  marker?: 'here' | 'goal';
  position?: number;
  mantra?: string;
  status?: CompanionStatus;
  kind?: 'book' | 'chapter' | 'framework';
}

// Editorial ids in library.ts do not always match the nav ids.
const MAIN_ALIAS: Record<string, string> = { 'quantum-revolution': 'qr' };
const COMPANION_ALIAS: Record<string, string> = { sulzeme: 'salt' };

const companionById = new Map(
  COMPANION_GROUPS.flatMap((g) => g.items).map((item) => [item.id, item] as const),
);
const mainById = new Map(MAIN_BOOKS.map((b) => [b.id, b] as const));

const LANDING_META: Record<
  string,
  { icon: IconType; accent: string; subtitle: { cs: string; en: string } }
> = {
  genesis: {
    icon: Egg,
    accent: '252, 209, 22',
    subtitle: {
      cs: 'Kniha Zrození — proč existujeme; vejce, které se nerozbilo, a podpis v prvním bloku.',
      en: 'The Book of Birth — why we exist; the egg that did not break and the signature in the first block.',
    },
  },
  terranova: {
    icon: Sailboat,
    accent: '52, 211, 153',
    subtitle: {
      cs: 'Loď, mapa světových stran a první trupy cesty — kam to celé směřuje.',
      en: 'The ship, the map of directions and the first hulls of the path — where it all leads.',
    },
  },
};

/** Derive the language badge from the book's own "Languages" fact. */
function languagesOf(
  facts: { label: { cs: string; en: string }; value: string }[],
): 'cz' | 'cz-en' {
  const fact = facts.find((f) => f.label.cs === 'Jazyky' || f.label.en === 'Languages');
  if (!fact) return 'cz-en';
  return /\bEN\b/.test(fact.value) ? 'cz-en' : 'cz';
}

export const LIBRARY: LibraryEntry[] = BOOK_NAV.flatMap((group) =>
  group.books.map((entry) => {
    const def = BOOKS[entry.id];
    const main = mainById.get(MAIN_ALIAS[entry.id] ?? entry.id);
    const companion = companionById.get(COMPANION_ALIAS[entry.id] ?? entry.id);
    const landing = LANDING_META[entry.id];
    const facts = def?.facts ?? [];

    const title =
      def?.title ??
      entry.label ??
      main?.title ?? { cs: entry.id, en: entry.id };
    const subtitle =
      def?.subtitle ??
      landing?.subtitle ??
      main?.role ?? { cs: '', en: '' };
    const description =
      companion?.description ?? def?.description ?? main?.role ?? subtitle;

    return {
      id: entry.id,
      href: entry.href,
      enHref: companion?.enHref,
      reader: Boolean(def),
      groupId: group.id,
      groupLabel: group.label,
      title,
      subtitle,
      description,
      accent: def?.accent ?? main?.rc ?? landing?.accent ?? '148, 163, 184',
      icon: def?.icon ?? landing?.icon ?? BookOpen,
      facts,
      chapterCount: def?.chapters.length ?? 0,
      languages: languagesOf(facts),
      marker: main?.marker,
      position: main?.position,
      mantra: main?.mantra,
      status: companion?.status,
      kind: companion?.kind,
    } satisfies LibraryEntry;
  }),
);

export const LIBRARY_GROUPS = BOOK_NAV.map((group) => ({
  id: group.id,
  label: group.label,
  entries: LIBRARY.filter((e) => e.groupId === group.id),
}));

export const READER_BOOKS = LIBRARY.filter((e) => e.reader);

export const LIBRARY_STATS = {
  books: READER_BOOKS.length,
  groups: BOOK_NAV.length,
  /** Chaptered books only — single-doc books count their chapters at read time. */
  chapters: READER_BOOKS.reduce((sum, b) => sum + b.chapterCount, 0),
};

/** Normalize for accent-insensitive search (Czech readers type without diacritics). */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Everything a library search should match for one book. */
export function searchHaystack(entry: LibraryEntry): string {
  return normalizeText(
    [
      entry.title.cs,
      entry.title.en,
      entry.subtitle.cs,
      entry.subtitle.en,
      entry.description.cs,
      entry.description.en,
      entry.groupLabel.cs,
      entry.groupLabel.en,
      entry.mantra ?? '',
      ...entry.facts.map((f) => `${f.label.cs} ${f.value}`),
    ].join(' '),
  );
}
