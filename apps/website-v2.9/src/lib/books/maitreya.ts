export interface MaitreyaChapter {
  slug: string;
  part: number; // 0 = prolog, 1-5 parts, 6 = epilog
  num: { cs: string; en: string };
  title: { cs: string; en: string };
}

export const MAITREYA_PARTS: { cs: string; en: string }[] = [
  { cs: 'Prolog', en: 'Prologue' },
  { cs: 'Část I · Pán Hiranyagarbhy', en: 'Part I · Lord of Hiranyagarbha' },
  { cs: 'Část II · Dědic Zionu', en: 'Part II · The Heir of Zion' },
  { cs: 'Část III · Pád věží Babylonu', en: 'Part III · The Fall of Babylon’s Towers' },
  { cs: 'Část IV · Láska a pravda vítězí', en: 'Part IV · Love and Truth Prevail' },
  { cs: 'Část V · Nový svět', en: 'Part V · The New World' },
  { cs: 'Epilog', en: 'Epilogue' },
];

export const MAITREYA_CHAPTERS: MaitreyaChapter[] = [
  { slug: 'prolog', part: 0, num: { cs: 'Prolog', en: 'Prologue' }, title: { cs: 'Vejce na křižovatce světů', en: 'The Egg at the Crossroads of Worlds' } },
  { slug: '01-vejce-ktere-se-nerozbilo', part: 1, num: { cs: 'Kapitola 1', en: 'Chapter 1' }, title: { cs: 'Vejce, které se nerozbilo', en: 'The Egg That Did Not Break' } },
  { slug: '02-zarodek-v-kazdem-bloku', part: 1, num: { cs: 'Kapitola 2', en: 'Chapter 2' }, title: { cs: 'Zárodek v každém bloku', en: 'The Embryo in Every Block' } },
  { slug: '03-podpis-ktery-otec-napsal-synovym-jmenem', part: 1, num: { cs: 'Kapitola 3', en: 'Chapter 3' }, title: { cs: 'Podpis, který otec napsal synovým jménem', en: 'The Signature the Father Wrote in His Son’s Name' } },
  { slug: '04-tri-klice-tri-sedadla', part: 2, num: { cs: 'Kapitola 4', en: 'Chapter 4' }, title: { cs: 'Tři klíče, tři sedadla', en: 'Three Keys, Three Seats' } },
  { slug: '05-test-odevzdani', part: 2, num: { cs: 'Kapitola 5', en: 'Chapter 5' }, title: { cs: 'Test odevzdání', en: 'The Test of Surrender' } },
  { slug: '06-spravce-ne-majitel', part: 2, num: { cs: 'Kapitola 6', en: 'Chapter 6' }, title: { cs: 'Správce, ne majitel', en: 'Steward, Not Owner' } },
  { slug: '07-vez-penez', part: 3, num: { cs: 'Kapitola 7', en: 'Chapter 7' }, title: { cs: 'Věž peněz', en: 'The Tower of Money' } },
  { slug: '08-vez-dat', part: 3, num: { cs: 'Kapitola 8', en: 'Chapter 8' }, title: { cs: 'Věž dat', en: 'The Tower of Data' } },
  { slug: '09-vez-energie', part: 3, num: { cs: 'Kapitola 9', en: 'Chapter 9' }, title: { cs: 'Věž energie', en: 'The Tower of Energy' } },
  { slug: '10-vez-vyznamu', part: 3, num: { cs: 'Kapitola 10', en: 'Chapter 10' }, title: { cs: 'Věž významu', en: 'The Tower of Meaning' } },
  { slug: '11-vez-trunu', part: 3, num: { cs: 'Kapitola 11', en: 'Chapter 11' }, title: { cs: 'Věž trůnu', en: 'The Tower of Thrones' } },
  { slug: '12-pravda-kterou-lze-overit', part: 4, num: { cs: 'Kapitola 12', en: 'Chapter 12' }, title: { cs: 'Pravda, kterou lze ověřit', en: 'Truth You Can Verify' } },
  { slug: '13-laska-ktera-se-nepta', part: 4, num: { cs: 'Kapitola 13', en: 'Chapter 13' }, title: { cs: 'Láska, která se neptá', en: 'Love That Does Not Ask' } },
  { slug: '14-kvantovy-puls', part: 4, num: { cs: 'Kapitola 14', en: 'Chapter 14' }, title: { cs: 'Kvantový puls', en: 'The Quantum Pulse' } },
  { slug: '15-lod-odplouva', part: 5, num: { cs: 'Kapitola 15', en: 'Chapter 15' }, title: { cs: 'Loď odplouvá', en: 'The Ship Departs' } },
  { slug: '16-dvanact-ohnu', part: 5, num: { cs: 'Kapitola 16', en: 'Chapter 16' }, title: { cs: 'Dvanáct ohňů', en: 'Twelve Fires' } },
  { slug: '17-pohled-z-okna', part: 5, num: { cs: 'Kapitola 17', en: 'Chapter 17' }, title: { cs: 'Pohled z okna', en: 'The View from the Window' } },
  { slug: 'epilog', part: 6, num: { cs: 'Epilog', en: 'Epilogue' }, title: { cs: 'Kdo je Maitreya', en: 'Who Is Maitreya' } },
];

export function maitreyaDocPath(slug: string, lang: 'cs' | 'en'): string {
  return lang === 'cs'
    ? `/docs/books/zion-archive/kapitoly/${slug}.md`
    : `/docs/en/books/zion-archive/kapitoly/${slug}.md`;
}

export function maitreyaChapterBySlug(slug: string) {
  const i = MAITREYA_CHAPTERS.findIndex((c) => c.slug === slug);
  if (i < 0) return null;
  return {
    chapter: MAITREYA_CHAPTERS[i],
    prev: i > 0 ? MAITREYA_CHAPTERS[i - 1] : null,
    next: i < MAITREYA_CHAPTERS.length - 1 ? MAITREYA_CHAPTERS[i + 1] : null,
  };
}
