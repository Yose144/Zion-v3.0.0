export interface SurtaChapter {
  slug: string;
  part: number; // 0 = o knize, 1 = dopis, 2 = mantra cesta, 3 = klenot, 4 = epilog
  num: { cs: string; en: string };
  title: { cs: string; en: string };
}

export const SURTA_PARTS: { cs: string; en: string }[] = [
  { cs: 'O knize', en: 'About the book' },
  { cs: 'Dopis pro Surtu', en: 'The letter for Surta' },
  { cs: 'Cesta mantrou', en: 'The mantra path' },
  { cs: 'Klenot v lotosu', en: 'The jewel in the lotus' },
  { cs: 'Epilog', en: 'Epilogue' },
];

export const SURTA_CHAPTERS: SurtaChapter[] = [
  { slug: '00-README', part: 0, num: { cs: 'Index', en: 'Index' }, title: { cs: 'Surta Srdce — sūtra srdce', en: 'Surta Srdce — the heart sūtra' } },
  { slug: '01-Dopis-pro-Surtu', part: 1, num: { cs: 'Prolog', en: 'Prologue' }, title: { cs: 'Dopis pro Surtu', en: 'A letter for Surta' } },
  { slug: '02-Gate-Prvni-Brana', part: 2, num: { cs: '1 · gate', en: '1 · gate' }, title: { cs: 'První brána', en: 'The first gate' } },
  { slug: '03-Gate-Druha-Brana', part: 2, num: { cs: '2 · gate', en: '2 · gate' }, title: { cs: 'Druhá brána', en: 'The second gate' } },
  { slug: '04-Paragate-K-Dalsimu-Brehu', part: 2, num: { cs: '3 · pāragate', en: '3 · pāragate' }, title: { cs: 'K dalšímu břehu', en: 'To the farther shore' } },
  { slug: '05-Parasamgate-Uplne-Za', part: 2, num: { cs: '4 · pārasaṃgate', en: '4 · pārasaṃgate' }, title: { cs: 'Úplně za — La Palma', en: 'Completely beyond — La Palma' } },
  { slug: '06-Bodhi-Maly-Buddha-na-Lotosu', part: 2, num: { cs: '5 · bodhi', en: '5 · bodhi' }, title: { cs: 'Malý Buddha na lotosu', en: 'The little Buddha on the lotus' } },
  { slug: '07-Svaha-Bodhisattva-Nove-Zeme', part: 2, num: { cs: '6 · svāhā', en: '6 · svāhā' }, title: { cs: 'Bodhisattva nové země', en: 'The bodhisattva of the new earth' } },
  { slug: '08-Om-Mani-Padme-Hum', part: 3, num: { cs: 'Klenot', en: 'The jewel' }, title: { cs: 'Om mani padme hūṃ + soupis', en: 'Om mani padme hūṃ + compendium' } },
  { slug: '09-Epilog-Otcuv-Podpis', part: 4, num: { cs: 'Epilog', en: 'Epilogue' }, title: { cs: 'Otcův podpis', en: 'A father’s signature' } },
];

export function surtaDocPath(slug: string, lang: 'cs' | 'en'): string {
  return lang === 'cs'
    ? `/docs/books/surta-srdce/kapitoly/${slug}.md`
    : `/docs/en/books/surta-srdce/kapitoly/${slug}.md`;
}

export function surtaChapterBySlug(slug: string) {
  const i = SURTA_CHAPTERS.findIndex((c) => c.slug === slug);
  return i >= 0 ? { chapter: SURTA_CHAPTERS[i], index: i } : null;
}
