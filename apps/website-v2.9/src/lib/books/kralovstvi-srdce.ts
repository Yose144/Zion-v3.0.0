export interface KralChapter {
  slug: string;
  part: number; // 0 = o knize, 1 = dílna a loď, 2 = jezero a bouře, 3 = hlubina a přístav, 4 = epilog
  num: { cs: string; en: string };
  title: { cs: string; en: string };
}

export const KRAL_PARTS: { cs: string; en: string }[] = [
  { cs: 'O knize', en: 'About the book' },
  { cs: 'Dílna nad Galileou', en: 'The workshop above Galilee' },
  { cs: 'Jezero a bouře', en: 'The lake and the storm' },
  { cs: 'Hlubina a přístav', en: 'The deep and the harbor' },
  { cs: 'Epilog', en: 'Epilogue' },
];

export const KRAL_CHAPTERS: KralChapter[] = [
  { slug: '00-README', part: 0, num: { cs: 'Index', en: 'Index' }, title: { cs: 'Království srdce — loď, kterou postavil tesař', en: 'Kingdom of the Heart — the boat the carpenter built' } },
  { slug: '01-Tesar-z-Nazareta', part: 1, num: { cs: 'Kap. 1', en: 'Ch. 1' }, title: { cs: 'Tesař z Nazareta', en: 'The carpenter of Nazareth' } },
  { slug: '02-Drevo-a-Smola', part: 1, num: { cs: 'Kap. 2', en: 'Ch. 2' }, title: { cs: 'Dřevo a smola', en: 'Wood and pitch' } },
  { slug: '03-Lod-na-Kinneret', part: 2, num: { cs: 'Kap. 3', en: 'Ch. 3' }, title: { cs: 'Loď na Kinneret', en: 'The boat on Kinneret' } },
  { slug: '04-Boure-na-Jezere', part: 2, num: { cs: 'Kap. 4', en: 'Ch. 4' }, title: { cs: 'Bouře na jezeře', en: 'The storm on the lake' } },
  { slug: '05-Kralovstvi-je-Uvnitr-Vas', part: 2, num: { cs: 'Kap. 5', en: 'Ch. 5' }, title: { cs: 'Království je uvnitř vás', en: 'The kingdom is within you' } },
  { slug: '06-Nejvesti-Boure', part: 3, num: { cs: 'Kap. 6', en: 'Ch. 6' }, title: { cs: 'Největší bouře', en: 'The greatest storm' } },
  { slug: '07-Navicella', part: 3, num: { cs: 'Kap. 7', en: 'Ch. 7' }, title: { cs: 'Navicella — loď pluje stoletími', en: 'Navicella — the boat sails the centuries' } },
  { slug: '08-Nove-Nebe-a-Nova-Zeme', part: 3, num: { cs: 'Kap. 8', en: 'Ch. 8' }, title: { cs: 'Nové nebe a nová země', en: 'A new heaven and a new earth' } },
  { slug: '09-Flotila-se-Schazi', part: 3, num: { cs: 'Kap. 9', en: 'Ch. 9' }, title: { cs: 'Flotila se schází — nové zjevení', en: 'The fleet gathers — the new revelation' } },
  { slug: '10-Epilog-Kde-Lod-Kotvi', part: 4, num: { cs: 'Epilog', en: 'Epilogue' }, title: { cs: 'Kde loď kotví dnes', en: 'Where the boat anchors today' } },
];

export function kralDocPath(slug: string, lang: 'cs' | 'en'): string {
  return lang === 'cs'
    ? `/api/archive/docs/books/kralovstvi-srdce/kapitoly/${slug}.md`
    : `/api/archive/docs/en/books/kralovstvi-srdce/kapitoly/${slug}.md`;
}

export function kralChapterBySlug(slug: string) {
  const i = KRAL_CHAPTERS.findIndex((c) => c.slug === slug);
  return i >= 0 ? { chapter: KRAL_CHAPTERS[i], index: i } : null;
}
