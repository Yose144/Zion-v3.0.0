export interface NirvanaChapter {
  slug: string;
  part: number; // 0 = o knize, 1 = dvanáct zastavení, 2 = most, 3 = rozšíření
  num: { cs: string; en: string };
  title: { cs: string; en: string };
}

export const NIRVANA_PARTS: { cs: string; en: string }[] = [
  { cs: 'Kniha Západu', en: 'The Book of the West' },
  { cs: 'Dvanáct zastavení', en: 'Twelve Stations' },
  { cs: 'Most — L5 flotila', en: 'The Bridge — L5 fleet' },
  { cs: 'Hluboké rozšíření', en: 'Deep expansion' },
];

export const NIRVANA_CHAPTERS: NirvanaChapter[] = [
  { slug: '00-README', part: 0, num: { cs: 'Index', en: 'Index' }, title: { cs: 'Příběhy Nové Země', en: 'Tales of the New Earth' } },
  { slug: '01-Prvni-Paprsek', part: 1, num: { cs: 'Epizoda 1', en: 'Episode 1' }, title: { cs: 'První paprsek', en: 'The First Ray' } },
  { slug: '02-Hora-Ararat', part: 1, num: { cs: 'Epizoda 2', en: 'Episode 2' }, title: { cs: 'Hora Ararat', en: 'Mount Ararat' } },
  { slug: '03-Nova-Zeme', part: 1, num: { cs: 'Epizoda 3', en: 'Episode 3' }, title: { cs: 'Nová země', en: 'The New Earth' } },
  { slug: '04-Domov', part: 1, num: { cs: 'Epizoda 4', en: 'Episode 4' }, title: { cs: 'Domov', en: 'Home' } },
  { slug: '05-Cesta-Domu', part: 1, num: { cs: 'Epizoda 5', en: 'Episode 5' }, title: { cs: 'Cesta domů', en: 'The Way Home' } },
  { slug: '06-Mosty-Pres-Propast', part: 1, num: { cs: 'Epizoda 6', en: 'Episode 6' }, title: { cs: 'Mosty přes propast', en: 'Bridges over the Abyss' } },
  { slug: '07-Zlate-Luno-Hiranyagarbha', part: 1, num: { cs: 'Epizoda 7', en: 'Episode 7' }, title: { cs: 'Zlaté lůno Hiranyagarbha', en: 'The Golden Womb of Hiranyagarbha' } },
  { slug: '08-Hlas-Amitabha', part: 1, num: { cs: 'Epizoda 8', en: 'Episode 8' }, title: { cs: 'Hlas Amitabha', en: 'The Voice of Amitabha' } },
  { slug: '09-Krystalicke-Svety-Oasis', part: 1, num: { cs: 'Epizoda 9', en: 'Episode 9' }, title: { cs: 'Krystalické světy OASIS', en: 'The Crystalline Worlds of OASIS' } },
  { slug: '10-Prameny-Zivota', part: 1, num: { cs: 'Epizoda 10', en: 'Episode 10' }, title: { cs: 'Prameny Života', en: 'The Springs of Life' } },
  { slug: '11-Kvantovy-Ohen-Issobella', part: 1, num: { cs: 'Epizoda 11', en: 'Episode 11' }, title: { cs: 'Kvantový oheň Issobella', en: 'The Quantum Fire of Issobella' } },
  { slug: '12-Velke-Sjednoceni', part: 1, num: { cs: 'Epizoda 12', en: 'Episode 12' }, title: { cs: 'Velké Sjednocení', en: 'The Grand Unification' } },
  { slug: '13-Tres-Marias', part: 2, num: { cs: 'Epizoda 13', en: 'Episode 13' }, title: { cs: 'Tres Marías — flotila Cesty', en: 'Tres Marías — the Fleet of the Path' } },
  { slug: 'NIRVANA_GLOBAL_EXPANSION_CZ', part: 3, num: { cs: 'Rozšíření', en: 'Expansion' }, title: { cs: 'Globální expanze', en: 'Global Expansion' } },
];

export function nirvanaDocPath(slug: string, lang: 'cs' | 'en'): string {
  return lang === 'cs'
    ? `/api/archive/docs/books/nirvana/kapitoly/${slug}.md`
    : `/api/archive/docs/en/books/nirvana/kapitoly/${slug}.md`;
}

export function nirvanaChapterBySlug(slug: string) {
  const i = NIRVANA_CHAPTERS.findIndex((c) => c.slug === slug);
  if (i < 0) return null;
  return {
    chapter: NIRVANA_CHAPTERS[i],
    prev: i > 0 ? NIRVANA_CHAPTERS[i - 1] : null,
    next: i < NIRVANA_CHAPTERS.length - 1 ? NIRVANA_CHAPTERS[i + 1] : null,
  };
}
